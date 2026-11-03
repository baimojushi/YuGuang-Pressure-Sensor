#include "pose_runtime.h"

#include "bsp_camera.h"
#include "yolo11_pose.h"
#include "video_stream.h"
#include "qm_log.h"
#include "qm_cli.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include <stdio.h>
#include <string.h>

#define LOG_TAG "pose_rt"

/* BF3901 竖图 240x320，UYVY 每像素 2 字节 */
#define POSE_FRAME_BYTES   (240 * 320 * 2)
/* esp-dl 推理在 PSRAM 栈上跑，8KB 会在首帧就爆栈（double exception），给 32KB */
#define POSE_TASK_STACK    (32 * 1024)
#define POSE_TASK_PRIO     5
#define POSE_LOG_EVERY     10
#define POSE_WAIT_MS       2000

static uint8_t *s_uyvy;
static SemaphoreHandle_t s_lock;
static yolo11_pose_frame_result_t s_result;
static uint32_t s_seq;
static uint32_t s_analyzed;
static TaskHandle_t s_task;

static void pose_task(void *arg)
{
    (void)arg;

    uint32_t cam_seq = 0;
    uint16_t w = 0;
    uint16_t h = 0;
    size_t len = 0;

    while (!bsp_camera_stream_is_on()) {
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    QM_LOGI(LOG_TAG, "camera stream on, pose loop start");

    /* HTTP 服务必须在 lwIP 初始化之后才能起：此处已联网开流，TCPIP 线程已就绪。
     * 早期启动会在 sys_mbox_post 上解引用未初始化的邮箱（崩溃）。 */
    if (video_stream_start() != ESP_OK) {
        QM_LOGW(LOG_TAG, "video stream start failed, continue headless");
    }

    for (;;) {
        int64_t t0 = esp_timer_get_time();
        esp_err_t err = bsp_camera_frame_copy(s_uyvy, POSE_FRAME_BYTES,
                                              &len, &w, &h, &cam_seq, POSE_WAIT_MS);
        int64_t t1 = esp_timer_get_time();
        if (err != ESP_OK) {
            QM_LOGW(LOG_TAG, "#%u wait=%dms err=%d seq=%u (no new frame)",
                    (unsigned)s_analyzed, (int)((t1 - t0) / 1000), (int)err,
                    (unsigned)cam_seq);
            continue;
        }
        if (len != (size_t)w * h * 2) {
            QM_LOGW(LOG_TAG, "short frame len=%u %ux%u", (unsigned)len, w, h);
            continue;
        }

        uint8_t *rgb = NULL;
        uint16_t rw = 0;
        uint16_t rh = 0;
        err = yolo11_pose_uyvy_to_rgb888_cw90(s_uyvy, len, w, h, &rgb, &rw, &rh);
        int64_t t2 = esp_timer_get_time();
        if (err != ESP_OK) {
            QM_LOGE(LOG_TAG, "uyvy->rgb888 failed err=%d conv=%dms",
                    (int)err, (int)((t2 - t1) / 1000));
            continue;
        }

        yolo11_pose_frame_result_t res;
        err = yolo11_pose_analyze_rgb888(rgb, rw, rh, "cam", &res);
        int64_t t3 = esp_timer_get_time();
        if (err != ESP_OK) {
            QM_LOGE(LOG_TAG, "analyze failed err=%d infer=%dms",
                    (int)err, (int)((t3 - t2) / 1000));
            continue;
        }

        /* 有网页客户端时才叠加骨架并编码；会就地绘制 rgb，故放在推理之后 */
        video_stream_publish(rgb, rw, rh, &res);
        int64_t t4 = esp_timer_get_time();

        if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(200)) == pdTRUE) {
            s_result = res;
            s_seq = cam_seq;
            s_analyzed++;
            xSemaphoreGive(s_lock);
        }

        /* 每帧都打：各段耗时 + 结果，用于判定"慢"还是"卡在等帧" */
        QM_LOGI(LOG_TAG,
                "#%u seq=%u %ux%u wait=%d conv=%d infer=%d pub=%d ms | status=%d "
                "score=%.2f kp0=(%d,%d) box=(%d,%d,%d,%d)",
                (unsigned)s_analyzed, (unsigned)cam_seq, rw, rh,
                (int)((t1 - t0) / 1000), (int)((t2 - t1) / 1000),
                (int)((t3 - t2) / 1000), (int)((t4 - t3) / 1000),
                (int)res.status, (double)res.score,
                res.keypoint[0], res.keypoint[1],
                res.box[0], res.box[1], res.box[2], res.box[3]);
    }
}

static void cli_cmd_pose(char *wbuf, int wlen, int argc, char **argv)
{
    (void)wbuf;
    (void)wlen;

    if (argc >= 2 && strcmp(argv[1], "status") != 0) {
        qm_cli_printf("usage: pose [status]\r\n");
        return;
    }

    yolo11_pose_frame_result_t res;
    uint32_t seq = 0;
    uint32_t analyzed = 0;
    if (!pose_runtime_get(&res, &seq, &analyzed)) {
        qm_cli_printf("pose no result yet (camera stream off?)\r\n");
        return;
    }

    qm_cli_printf("pose status=%d err=%d score=%.2f yaw=%.2f roll=%.2f "
                  "shoulder=%.2f lean=%.2f head=%.2f box=(%d,%d,%d,%d) "
                  "seq=%u n=%u\r\n",
                  (int)res.status, (int)res.err_type, (double)res.score,
                  (double)res.yaw, (double)res.roll, (double)res.shoulder_diff,
                  (double)res.lean, (double)res.head_down_ratio,
                  res.box[0], res.box[1], res.box[2], res.box[3],
                  (unsigned)seq, (unsigned)analyzed);

    char kp[192];
    int off = 0;
    for (int i = 0; i < 17 && off < (int)sizeof(kp) - 12; ++i) {
        off += snprintf(kp + off, sizeof(kp) - off, "%d:(%d,%d) ",
                        i, res.keypoint[2 * i], res.keypoint[2 * i + 1]);
    }
    qm_cli_printf("pose kpt %s\r\n", kp);
}

static const struct qm_cli_command s_pose_cli_cmd = {
    .name = "pose",
    .help = "pose [status] - realtime YOLO11n-pose result and keypoints",
    .function = cli_cmd_pose,
};

esp_err_t pose_runtime_init(void)
{
    if (s_task != NULL) {
        return ESP_OK;
    }

    if (s_lock == NULL) {
        s_lock = xSemaphoreCreateMutex();
        if (s_lock == NULL) {
            QM_LOGE(LOG_TAG, "mutex create failed");
            return ESP_ERR_NO_MEM;
        }
    }
    if (s_uyvy == NULL) {
        s_uyvy = heap_caps_malloc(POSE_FRAME_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (s_uyvy == NULL) {
            QM_LOGE(LOG_TAG, "uyvy buffer alloc failed");
            return ESP_ERR_NO_MEM;
        }
    }

    /* 先从 Flash 读模型：必须早于摄像头开流，避免读 Flash 与取流并发 */
    yolo11_pose_prealloc_buffers();
    esp_err_t err = yolo11_pose_init();
    if (err != ESP_OK) {
        QM_LOGE(LOG_TAG, "yolo11_pose_init failed err=%d", (int)err);
        return err;
    }

    if (xTaskCreateWithCaps(pose_task, "pose_rt", POSE_TASK_STACK, NULL,
                            POSE_TASK_PRIO, &s_task,
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
        s_task = NULL;
        QM_LOGE(LOG_TAG, "task create failed");
        return ESP_ERR_NO_MEM;
    }

    (void)qm_cli_register_command(&s_pose_cli_cmd);
    QM_LOGI(LOG_TAG, "init ok, waiting for camera stream");
    return ESP_OK;
}

bool pose_runtime_get(yolo11_pose_frame_result_t *out, uint32_t *out_seq,
                      uint32_t *out_analyzed)
{
    if (out == NULL || s_lock == NULL) {
        return false;
    }
    if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return false;
    }
    const bool has = (s_analyzed > 0);
    if (has) {
        *out = s_result;
        if (out_seq) {
            *out_seq = s_seq;
        }
        if (out_analyzed) {
            *out_analyzed = s_analyzed;
        }
    }
    xSemaphoreGive(s_lock);
    return has;
}
