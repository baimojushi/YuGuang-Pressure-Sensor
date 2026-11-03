#include "pose_runtime_b.h"

#include "bsp_camera.h"

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include <stddef.h>

#define TAG "pose_rt"

/* BF3901 竖图 240x320，UYVY 每像素 2 字节 */
#define POSE_FRAME_BYTES   (240 * 320 * 2)
/* esp-dl 推理在 PSRAM 栈上跑，8KB 会在首帧就爆栈（double exception），给 32KB */
#define POSE_TASK_STACK    (32 * 1024)
#define POSE_TASK_PRIO     5
#define POSE_WAIT_MS       2000
#define POSE_LOG_EVERY     10

static uint8_t *s_uyvy;
static SemaphoreHandle_t s_lock;
static yolo11_pose_frame_result_t s_result;
static uint32_t s_seq;
static uint32_t s_analyzed;
static uint32_t s_result_ms;
static TaskHandle_t s_task;

static uint32_t now_ms(void)
{
    return (uint32_t)(esp_timer_get_time() / 1000ULL);
}

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
    ESP_LOGI(TAG, "camera stream on, pose loop start");

    for (;;) {
        esp_err_t err = bsp_camera_frame_copy(s_uyvy, POSE_FRAME_BYTES,
                                             &len, &w, &h, &cam_seq, POSE_WAIT_MS);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "#%u no new frame err=%d seq=%u",
                     (unsigned)s_analyzed, (int)err, (unsigned)cam_seq);
            continue;
        }
        if (len != (size_t)w * h * 2) {
            ESP_LOGW(TAG, "short frame len=%u %ux%u", (unsigned)len, w, h);
            continue;
        }

        uint8_t *rgb = NULL;
        uint16_t rw = 0;
        uint16_t rh = 0;
        err = yolo11_pose_uyvy_to_rgb888_cw90(s_uyvy, len, w, h, &rgb, &rw, &rh);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "uyvy->rgb888 failed err=%d", (int)err);
            continue;
        }

        yolo11_pose_frame_result_t res;
        err = yolo11_pose_analyze_rgb888(rgb, rw, rh, "cam", &res);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "analyze failed err=%d", (int)err);
            continue;
        }

        if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(200)) == pdTRUE) {
            s_result = res;
            s_seq = cam_seq;
            s_result_ms = now_ms();
            s_analyzed++;
            xSemaphoreGive(s_lock);
        }

        if ((s_analyzed % POSE_LOG_EVERY) == 0) {
            ESP_LOGI(TAG, "#%u seq=%u %ux%u status=%d score=%.2f "
                     "yaw=%.2f roll=%.2f lean=%.2f head=%.2f",
                     (unsigned)s_analyzed, (unsigned)cam_seq, rw, rh,
                     (int)res.status, (double)res.score,
                     (double)res.yaw, (double)res.roll,
                     (double)res.lean, (double)res.head_down_ratio);
        }
    }
}

esp_err_t pose_runtime_b_init(void)
{
    if (s_task != NULL) {
        return ESP_OK;
    }

    if (s_lock == NULL) {
        s_lock = xSemaphoreCreateMutex();
        if (s_lock == NULL) {
            ESP_LOGE(TAG, "mutex create failed");
            return ESP_ERR_NO_MEM;
        }
    }
    if (s_uyvy == NULL) {
        s_uyvy = heap_caps_malloc(POSE_FRAME_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (s_uyvy == NULL) {
            ESP_LOGE(TAG, "uyvy buffer alloc failed (%u bytes)",
                     (unsigned)POSE_FRAME_BYTES);
            return ESP_ERR_NO_MEM;
        }
    }

    /* 先从 Flash 读模型：必须早于摄像头开流，避免读 Flash 与取流并发 */
    yolo11_pose_prealloc_buffers();
    esp_err_t err = yolo11_pose_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "yolo11_pose_init failed err=%d", (int)err);
        return err;
    }

    if (xTaskCreateWithCaps(pose_task, "pose_rt", POSE_TASK_STACK, NULL,
                            POSE_TASK_PRIO, &s_task,
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
        s_task = NULL;
        ESP_LOGE(TAG, "task create failed");
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "init ok, waiting for camera stream");
    return ESP_OK;
}

bool pose_runtime_b_get(yolo11_pose_frame_result_t *out, uint32_t *out_seq,
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

bool pose_runtime_b_indicator(float *p, uint32_t max_age_ms)
{
    if (p == NULL || s_lock == NULL) {
        return false;
    }
    if (xSemaphoreTake(s_lock, pdMS_TO_TICKS(50)) != pdTRUE) {
        return false;
    }
    const bool has = (s_analyzed > 0);
    const yolo11_pose_frame_result_t res = s_result;
    const uint32_t stamp = s_result_ms;
    xSemaphoreGive(s_lock);

    if (!has) {
        return false;
    }
    if ((uint32_t)(now_ms() - stamp) > max_age_ms) {
        return false;
    }

    switch (res.status) {
    case YOLO11_POSE_FRAME_OK:
        *p = 100.0f;
        return true;
    case YOLO11_POSE_FRAME_BAD_POSTURE:
        *p = 30.0f;
        return true;
    default:
        /* NO_PERSON / UNKNOWN：没有可信姿态判定，禁止伪造。 */
        return false;
    }
}
