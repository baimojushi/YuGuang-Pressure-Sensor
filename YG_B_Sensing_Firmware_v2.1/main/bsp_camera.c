#include "bsp_camera.h"

#include "esp_cam_ctlr_spi.h"
#include "esp_cam_sensor_xclk.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_video_device.h"
#include "esp_video_init.h"
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "driver/pulse_cnt.h"
#include "driver/spi_master.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <linux/videodev2.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

#define LOG_TAG "bsp_camera"

#define CAM_BUF_NUM             2
#define CAM_I2C_FREQ_HZ         50000  /* 50 kHz：排线接触裕量比 100 kHz 好得多 */
#define CAM_INIT_RETRY          3      /* esp_video_init 失败路径会清理 I2C/SCCB，可安全重试 */
#define CAM_STREAM_PRIO         12
#define CAM_STREAM_CORE         1
#define CAM_DQBUF_POLL_MS       20
#define CAM_LOG_EVERY_FRAMES    30
#define CAM_STREAM_STACK        (6 * 1024)
#define CAM_STACK_CAPS          (MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)
#define CAM_GPIO_PROBE_MS       1500
#define CAM_GPIO_PROBE_STACK    (3 * 1024)
#define CAM_GPIO_PROBE_PRIO     3
#define CAM_GPIO_PROBE_CORE     0

typedef struct {
    int fd;
    uint8_t *buffer[CAM_BUF_NUM];
    size_t buffer_len[CAM_BUF_NUM];
    uint32_t width;
    uint32_t height;
    uint32_t pixel_format;
    bool stream_on;
} bsp_cam_t;

static bsp_cam_t s_cam = {
    .fd = -1,
};
static bool s_available;
static bool s_video_ready;
static TaskHandle_t s_stream_task;
static TaskHandle_t s_gpio_probe_task;

/* 帧出口：cam_stream_task 每收满一帧就拷进这块 PSRAM 常驻缓冲 */
static uint8_t *s_frame_buf;
static size_t s_frame_cap;
static size_t s_frame_used;
static uint16_t s_frame_w;
static uint16_t s_frame_h;
static uint32_t s_frame_seq;
static SemaphoreHandle_t s_frame_lock;

static void cam_pwdn_hold_low(void)
{
    gpio_config_t conf = {
        .pin_bit_mask = 1ULL << BSP_CAM_PWDN_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    ESP_ERROR_CHECK(gpio_config(&conf));
    ESP_ERROR_CHECK(gpio_set_level(BSP_CAM_PWDN_GPIO, 1));
    vTaskDelay(pdMS_TO_TICKS(20));
    ESP_ERROR_CHECK(gpio_set_level(BSP_CAM_PWDN_GPIO, 0));
    vTaskDelay(pdMS_TO_TICKS(50));
    ESP_LOGI(LOG_TAG, "PWDN GPIO%d pulsed then held low", BSP_CAM_PWDN_GPIO);
}

static void cam_teardown(void)
{
    int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;

    if (s_cam.fd >= 0 && s_cam.stream_on) {
        ioctl(s_cam.fd, VIDIOC_STREAMOFF, &type);
        s_cam.stream_on = false;
    }
    for (int i = 0; i < CAM_BUF_NUM; i++) {
        if (s_cam.buffer[i] && s_cam.buffer[i] != MAP_FAILED) {
            munmap(s_cam.buffer[i], s_cam.buffer_len[i]);
            s_cam.buffer[i] = NULL;
            s_cam.buffer_len[i] = 0;
        }
    }
    if (s_cam.fd >= 0) {
        close(s_cam.fd);
        s_cam.fd = -1;
    }
}

static esp_err_t cam_video_init(void)
{
    /* 没有示波器时，把相机链路的驱动日志开到 DEBUG，让驱动自己报出卡点 */
    esp_log_level_set("esp_cam_ctlr", ESP_LOG_DEBUG);
    esp_log_level_set("esp_video", ESP_LOG_DEBUG);
    esp_log_level_set("bf3901", ESP_LOG_DEBUG);
    esp_log_level_set("sccb", ESP_LOG_DEBUG);

    static const esp_video_init_spi_config_t spi_config = {
        .sccb_config = {
            .init_sccb = true,
            .i2c_config = {
                .port = BSP_CAM_I2C_PORT,
                .scl_pin = BSP_CAM_SCL_GPIO,
                .sda_pin = BSP_CAM_SDA_GPIO,
            },
            .freq = CAM_I2C_FREQ_HZ,
        },
        .intf = ESP_CAM_CTLR_SPI_CAM_INTF_SPI,
        .io_mode = ESP_CAM_CTLR_SPI_CAM_IO_MODE_1BIT,
        .spi_port = SPI2_HOST,
        .spi_cs_pin = BSP_CAM_CS_GPIO,
        .spi_sclk_pin = BSP_CAM_SCLK_GPIO,
        .spi_data0_io_pin = BSP_CAM_DATA0_GPIO,
        .spi_data1_io_pin = -1,
        .spi_data2_io_pin = -1,
        .spi_data3_io_pin = -1,
        .reset_pin = BSP_CAM_RESET_GPIO,
        .pwdn_pin = -1,
        .xclk_source = ESP_CAM_SENSOR_XCLK_LEDC,
        .xclk_freq = 20000000,  /* 与 12fps/40M_pclk 档的 20Minput 表一致 */
        .xclk_pin = BSP_CAM_XCLK_GPIO,
#if CONFIG_CAMERA_XCLK_USE_LEDC
        .xclk_ledc_cfg = {
            .timer = LEDC_TIMER_3,
            .clk_cfg = LEDC_AUTO_CLK,
            .channel = LEDC_CHANNEL_7,
        },
#endif
    };
    const esp_video_init_config_t cam_config = {
        .spi = &spi_config,
    };

    ESP_LOGI(LOG_TAG,
             "pins SDA=%d SCL=%d CS=%d SCLK=%d DATA0=%d PWDN=%d SPI_HOST=%d",
             BSP_CAM_SDA_GPIO, BSP_CAM_SCL_GPIO, BSP_CAM_CS_GPIO,
             BSP_CAM_SCLK_GPIO, BSP_CAM_DATA0_GPIO, BSP_CAM_PWDN_GPIO,
             (int)SPI2_HOST);

    esp_err_t err = ESP_FAIL;
    for (int attempt = 1; attempt <= CAM_INIT_RETRY; ++attempt) {
        err = esp_video_init(&cam_config);
        if (err == ESP_OK) {
            ESP_LOGI(LOG_TAG, "video init ok on attempt %d/%d", attempt, CAM_INIT_RETRY);
            return ESP_OK;
        }
        ESP_LOGW(LOG_TAG, "video init attempt %d/%d failed err=%d (%s)",
                 attempt, CAM_INIT_RETRY, (int)err, esp_err_to_name(err));
        if (attempt < CAM_INIT_RETRY) {
            (void)esp_video_deinit();
            cam_pwdn_hold_low();
            vTaskDelay(pdMS_TO_TICKS(150));
        }
    }
    ESP_LOGE(LOG_TAG, "video init failed after %d attempts", CAM_INIT_RETRY);
    return err;
}

static esp_err_t cam_setup_buffers(void)
{
    struct v4l2_format format;
    struct v4l2_requestbuffers req;

    if (s_cam.fd >= 0 && s_cam.buffer[0] != NULL) {
        return ESP_OK;
    }

    if (s_cam.fd < 0) {
        s_cam.fd = open(ESP_VIDEO_SPI_DEVICE_NAME, O_RDWR);
        ESP_RETURN_ON_FALSE(s_cam.fd >= 0, ESP_ERR_NOT_FOUND, LOG_TAG,
                            "open %s failed, errno=%d", ESP_VIDEO_SPI_DEVICE_NAME, errno);
    }

    memset(&format, 0, sizeof(format));
    format.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    ESP_RETURN_ON_ERROR(ioctl(s_cam.fd, VIDIOC_G_FMT, &format) == 0 ? ESP_OK : ESP_FAIL,
                        LOG_TAG, "VIDIOC_G_FMT failed, errno=%d", errno);
    s_cam.width = format.fmt.pix.width;
    s_cam.height = format.fmt.pix.height;
    s_cam.pixel_format = format.fmt.pix.pixelformat;
    ESP_LOGI(LOG_TAG, "format %" PRIu32 "x%" PRIu32 " fourcc=0x%08" PRIx32,
             s_cam.width, s_cam.height, s_cam.pixel_format);

    memset(&req, 0, sizeof(req));
    req.count = CAM_BUF_NUM;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;
    ESP_RETURN_ON_ERROR(ioctl(s_cam.fd, VIDIOC_REQBUFS, &req) == 0 ? ESP_OK : ESP_FAIL,
                        LOG_TAG, "VIDIOC_REQBUFS failed, errno=%d", errno);

    for (int i = 0; i < CAM_BUF_NUM; i++) {
        struct v4l2_buffer buf;

        memset(&buf, 0, sizeof(buf));
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;
        ESP_RETURN_ON_ERROR(ioctl(s_cam.fd, VIDIOC_QUERYBUF, &buf) == 0 ? ESP_OK : ESP_FAIL,
                            LOG_TAG, "VIDIOC_QUERYBUF[%d] failed, errno=%d", i, errno);
        s_cam.buffer[i] = mmap(NULL, buf.length, PROT_READ | PROT_WRITE, MAP_SHARED,
                               s_cam.fd, buf.m.offset);
        ESP_RETURN_ON_FALSE(s_cam.buffer[i] != MAP_FAILED, ESP_ERR_NO_MEM, LOG_TAG,
                            "mmap[%d] failed, errno=%d", i, errno);
        s_cam.buffer_len[i] = buf.length;
        ESP_RETURN_ON_ERROR(ioctl(s_cam.fd, VIDIOC_QBUF, &buf) == 0 ? ESP_OK : ESP_FAIL,
                            LOG_TAG, "VIDIOC_QBUF[%d] failed, errno=%d", i, errno);
    }

    ESP_LOGI(LOG_TAG, "buffers ready, STREAMON deferred");
    return ESP_OK;
}

static esp_err_t cam_stream_on(void)
{
    int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;

    if (s_cam.stream_on) {
        return ESP_OK;
    }
    ESP_RETURN_ON_ERROR(ioctl(s_cam.fd, VIDIOC_STREAMON, &type) == 0 ? ESP_OK : ESP_FAIL,
                        LOG_TAG, "VIDIOC_STREAMON failed, errno=%d", errno);
    s_cam.stream_on = true;
    ESP_LOGI(LOG_TAG, "stream on, %s", ESP_VIDEO_SPI_DEVICE_NAME);
    return ESP_OK;
}

/*
 * 无示波器诊断：保持 SPI slave 和 GPIO matrix 原样工作，旁路读取 PAD 输入电平；
 * 同时把 GPIO13 路由到 PCNT，硬件统计 PCLK 上升沿。GPIO matrix 支持一脚多路输入，
 * 因此不会抢走 SPI slave 的 SCLK 路由。PCNT 不启用毛刺滤波，以免滤掉 40 MHz 时钟。
 */
static void cam_gpio_probe_task(void *arg)
{
    pcnt_unit_handle_t pcnt_unit = NULL;
    pcnt_channel_handle_t pcnt_chan = NULL;
    bool pcnt_enabled = false;
    bool pcnt_started = false;
    esp_err_t pcnt_err;

    pcnt_unit_config_t unit_config = {
        .low_limit = -30000,
        .high_limit = 30000,
        .flags.accum_count = true,
    };
    pcnt_chan_config_t chan_config = {
        .edge_gpio_num = BSP_CAM_SCLK_GPIO,
        .level_gpio_num = -1,
        .flags.virt_level_io_level = 1,
    };

    pcnt_err = pcnt_new_unit(&unit_config, &pcnt_unit);
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_new_channel(pcnt_unit, &chan_config, &pcnt_chan);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_channel_set_edge_action(
            pcnt_chan, PCNT_CHANNEL_EDGE_ACTION_INCREASE, PCNT_CHANNEL_EDGE_ACTION_HOLD);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_channel_set_level_action(
            pcnt_chan, PCNT_CHANNEL_LEVEL_ACTION_KEEP, PCNT_CHANNEL_LEVEL_ACTION_KEEP);
    }
    /* accum_count 依赖上下限 watch point，在硬件计数器回绕时累加到软件计数。 */
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_unit_add_watch_point(pcnt_unit, unit_config.low_limit);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_unit_add_watch_point(pcnt_unit, unit_config.high_limit);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_unit_enable(pcnt_unit);
        pcnt_enabled = (pcnt_err == ESP_OK);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_unit_clear_count(pcnt_unit);
    }
    if (pcnt_err == ESP_OK) {
        pcnt_err = pcnt_unit_start(pcnt_unit);
        pcnt_started = (pcnt_err == ESP_OK);
    }

    const int64_t start_us = esp_timer_get_time();
    const int64_t end_us = start_us + (int64_t)CAM_GPIO_PROBE_MS * 1000;
    uint32_t samples = 0;
    uint32_t vsync_edges = 0;
    uint32_t pclk_edges = 0;
    uint32_t data_edges = 0;
    uint32_t vsync_high = 0;
    uint32_t pclk_high = 0;
    uint32_t data_high = 0;
    int last_vsync = gpio_get_level(BSP_CAM_CS_GPIO);
    int last_pclk = gpio_get_level(BSP_CAM_SCLK_GPIO);
    int last_data = gpio_get_level(BSP_CAM_DATA0_GPIO);
    const int first_vsync = last_vsync;
    const int first_pclk = last_pclk;
    const int first_data = last_data;

    (void)arg;
    ESP_LOGW(LOG_TAG,
             "GPIO+PCNT probe begin: %d ms (VSYNC=%d PCLK=%d DATA0=%d pcnt=%s)",
             CAM_GPIO_PROBE_MS, BSP_CAM_CS_GPIO, BSP_CAM_SCLK_GPIO, BSP_CAM_DATA0_GPIO,
             pcnt_started ? "on" : esp_err_to_name(pcnt_err));

    while (esp_timer_get_time() < end_us) {
        const int vsync = gpio_get_level(BSP_CAM_CS_GPIO);
        const int pclk = gpio_get_level(BSP_CAM_SCLK_GPIO);
        const int data = gpio_get_level(BSP_CAM_DATA0_GPIO);

        vsync_edges += (vsync != last_vsync);
        pclk_edges += (pclk != last_pclk);
        data_edges += (data != last_data);
        vsync_high += (vsync != 0);
        pclk_high += (pclk != 0);
        data_high += (data != 0);
        last_vsync = vsync;
        last_pclk = pclk;
        last_data = data;
        samples++;

        /* 给 idle/WDT 和网络任务运行机会；PCNT 在延时期间仍持续硬件计数。 */
        if ((samples & 0x3ffU) == 0) {
            vTaskDelay(1);
        }
    }

    const int64_t elapsed_us = esp_timer_get_time() - start_us;
    int pcnt_edges = -1;
    if (pcnt_started) {
        (void)pcnt_unit_stop(pcnt_unit);
        pcnt_started = false;
        if (pcnt_unit_get_count(pcnt_unit, &pcnt_edges) != ESP_OK) {
            pcnt_edges = -1;
        }
    }

    const uint32_t vsync_permille = samples ? (uint32_t)(((uint64_t)vsync_high * 1000U) / samples) : 0;
    const uint32_t pclk_permille = samples ? (uint32_t)(((uint64_t)pclk_high * 1000U) / samples) : 0;
    const uint32_t data_permille = samples ? (uint32_t)(((uint64_t)data_high * 1000U) / samples) : 0;
    const uint32_t elapsed_us_u32 = elapsed_us > 0 ? (uint32_t)elapsed_us : 0;
    const uint32_t pcnt_avg_hz = (pcnt_edges >= 0 && elapsed_us_u32 > 0)
                                     ? (uint32_t)(((uint64_t)pcnt_edges * 1000000U) / elapsed_us_u32)
                                     : 0;

    ESP_LOGW(LOG_TAG,
             "GPIO probe result: samples=%u VSYNC edges=%u high=%u/1000 level=%d->%d; "
             "PCLK(sw) edges=%u high=%u/1000 level=%d->%d; "
             "DATA0 edges=%u high=%u/1000 level=%d->%d",
             (unsigned)samples,
             (unsigned)vsync_edges, (unsigned)vsync_permille, first_vsync, last_vsync,
             (unsigned)pclk_edges, (unsigned)pclk_permille, first_pclk, last_pclk,
             (unsigned)data_edges, (unsigned)data_permille, first_data, last_data);
    ESP_LOGW(LOG_TAG,
             "PCLK PCNT result: edges=%d elapsed_us=%u avg=%u Hz (window average, expected MHz range)",
             pcnt_edges, (unsigned)elapsed_us_u32, (unsigned)pcnt_avg_hz);

    if (vsync_edges == 0) {
        ESP_LOGE(LOG_TAG, "GPIO probe verdict: VSYNC SILENT on GPIO%d", BSP_CAM_CS_GPIO);
    } else if (pcnt_edges <= 0) {
        ESP_LOGE(LOG_TAG,
                 "GPIO probe verdict: VSYNC PRESENT but PCLK has no hardware-counted edges on GPIO%d",
                 BSP_CAM_SCLK_GPIO);
    } else if (pcnt_avg_hz < 1000000U) {
        ESP_LOGE(LOG_TAG,
                 "GPIO probe verdict: VSYNC PRESENT but PCLK is only %u Hz average; too low/intermittent for video",
                 (unsigned)pcnt_avg_hz);
    } else {
        ESP_LOGW(LOG_TAG,
                 "GPIO probe verdict: VSYNC and MHz-rate PCLK PRESENT; inspect SPI polarity/framing/DMA next");
    }

    if (pcnt_enabled) {
        (void)pcnt_unit_disable(pcnt_unit);
    }
    if (pcnt_chan != NULL) {
        (void)pcnt_del_channel(pcnt_chan);
    }
    if (pcnt_unit != NULL) {
        (void)pcnt_del_unit(pcnt_unit);
    }

    s_gpio_probe_task = NULL;
    vTaskDelete(NULL);
}

static void cam_stream_task(void *arg)
{
    uint32_t frames = 0;
    uint32_t good = 0;
    uint32_t empty = 0;
    TickType_t t0 = xTaskGetTickCount();
    const uint32_t expect = s_cam.width * s_cam.height * 2;

    (void)arg;
    ESP_LOGI(LOG_TAG, "stream task on core %d", (int)xPortGetCoreID());

    for (;;) {
        struct v4l2_buffer buf;

        memset(&buf, 0, sizeof(buf));
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        if (ioctl(s_cam.fd, VIDIOC_DQBUF, &buf) != 0) {
            if (errno != EAGAIN && errno != EINTR) {
                ESP_LOGE(LOG_TAG, "VIDIOC_DQBUF failed, errno=%d", errno);
                vTaskDelay(pdMS_TO_TICKS(1000));
            } else {
                vTaskDelay(pdMS_TO_TICKS(CAM_DQBUF_POLL_MS));
            }
            continue;
        }

        frames++;
        /* 放宽判定：auto_decode 关闭时交付字节含行头/帧头，bytesused 会大于裸像素。
         * 拷贝仍按缓冲上限截断，实际长度见每帧日志的 bytesused。 */
        if (buf.bytesused >= expect) {
            good++;
            if (s_frame_buf != NULL && s_frame_lock != NULL &&
                xSemaphoreTake(s_frame_lock, pdMS_TO_TICKS(50)) == pdTRUE) {
                size_t used = buf.bytesused;
                if (used > s_frame_cap) {
                    used = s_frame_cap;
                }
                memcpy(s_frame_buf, s_cam.buffer[buf.index], used);
                s_frame_used = used;
                s_frame_seq++;
                xSemaphoreGive(s_frame_lock);
            }
        } else {
            empty++;
        }
        if (frames <= 10 || (frames % CAM_LOG_EVERY_FRAMES) == 0) {
            TickType_t now = xTaskGetTickCount();
            uint32_t ms = (uint32_t)((now - t0) * portTICK_PERIOD_MS);
            ESP_LOGI(LOG_TAG,
                     "frame %u good=%u empty=%u bytesused=%u expect=%u idx=%u dt=%u ms",
                     (unsigned)frames, (unsigned)good, (unsigned)empty,
                     (unsigned)buf.bytesused, (unsigned)expect,
                     (unsigned)buf.index, (unsigned)ms);
            t0 = now;
        }

        if (ioctl(s_cam.fd, VIDIOC_QBUF, &buf) != 0) {
            ESP_LOGE(LOG_TAG, "VIDIOC_QBUF return failed, errno=%d", errno);
        }
    }
}

esp_err_t bsp_camera_early_init(void)
{
    cam_pwdn_hold_low();

    if (!s_video_ready) {
        if (cam_video_init() != ESP_OK) {
            ESP_LOGE(LOG_TAG, "esp_video_init failed (check 3V3/GND/I2C/PWDN wiring)");
            return ESP_FAIL;
        }
        s_video_ready = true;
    }
    if (cam_setup_buffers() != ESP_OK) {
        ESP_LOGE(LOG_TAG, "camera buffer alloc failed");
        cam_teardown();
        return ESP_FAIL;
    }
    if (s_frame_lock == NULL) {
        s_frame_lock = xSemaphoreCreateMutex();
        if (s_frame_lock == NULL) {
            ESP_LOGE(LOG_TAG, "frame lock create failed");
            return ESP_ERR_NO_MEM;
        }
    }
    if (s_frame_buf == NULL) {
        const size_t need = (size_t)s_cam.width * s_cam.height * 2;
        s_frame_buf = heap_caps_malloc(need, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (s_frame_buf == NULL) {
            ESP_LOGW(LOG_TAG, "frame export buffer alloc failed (%u bytes)", (unsigned)need);
        } else {
            s_frame_cap = need;
            s_frame_w = (uint16_t)s_cam.width;
            s_frame_h = (uint16_t)s_cam.height;
            ESP_LOGI(LOG_TAG, "frame export buffer %u bytes in PSRAM", (unsigned)need);
        }
    }
    s_available = true;
    ESP_LOGI(LOG_TAG, "early init ok, wait for stream_start");
    return ESP_OK;
}

esp_err_t bsp_camera_stream_start(void)
{
    if (s_stream_task != NULL) {
        return ESP_OK;
    }
    if (!s_available) {
        ESP_LOGE(LOG_TAG, "stream_start before early_init");
        return ESP_ERR_INVALID_STATE;
    }
    if (cam_stream_on() != ESP_OK) {
        return ESP_FAIL;
    }
    if (xTaskCreatePinnedToCoreWithCaps(cam_stream_task, "cam_stream", CAM_STREAM_STACK,
                                        NULL, CAM_STREAM_PRIO, &s_stream_task,
                                        CAM_STREAM_CORE, CAM_STACK_CAPS) != pdPASS) {
        s_stream_task = NULL;
        ESP_LOGE(LOG_TAG, "camera task create failed");
        return ESP_FAIL;
    }
    ESP_LOGI(LOG_TAG, "stream task in PSRAM, stack=%d", CAM_STREAM_STACK);

    if (s_gpio_probe_task == NULL &&
        xTaskCreatePinnedToCore(cam_gpio_probe_task, "cam_gpio_probe", CAM_GPIO_PROBE_STACK,
                                NULL, CAM_GPIO_PROBE_PRIO, &s_gpio_probe_task,
                                CAM_GPIO_PROBE_CORE) != pdPASS) {
        s_gpio_probe_task = NULL;
        ESP_LOGW(LOG_TAG, "GPIO probe task create failed; capture continues normally");
    }
    return ESP_OK;
}

esp_err_t bsp_camera_start(void)
{
    if (bsp_camera_early_init() != ESP_OK) {
        return ESP_FAIL;
    }
    return bsp_camera_stream_start();
}

bool bsp_camera_is_available(void)
{
    return s_available;
}

bool bsp_camera_stream_is_on(void)
{
    return s_cam.stream_on && s_stream_task != NULL;
}

esp_err_t bsp_camera_frame_copy(uint8_t *dst, size_t dst_len,
                                size_t *out_len, uint16_t *out_w, uint16_t *out_h,
                                uint32_t *inout_seq, uint32_t wait_ms)
{
    if (dst == NULL || inout_seq == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!s_available || s_frame_buf == NULL || s_frame_lock == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    const uint32_t start_seq = *inout_seq;
    const TickType_t deadline = xTaskGetTickCount() + pdMS_TO_TICKS(wait_ms);

    for (;;) {
        if (s_frame_seq != start_seq) {
            if (xSemaphoreTake(s_frame_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
                return ESP_ERR_TIMEOUT;
            }
            size_t used = s_frame_used;
            if (used > dst_len) {
                used = dst_len;
            }
            memcpy(dst, s_frame_buf, used);
            const uint32_t done_seq = s_frame_seq;
            const uint16_t width = s_frame_w;
            const uint16_t height = s_frame_h;
            xSemaphoreGive(s_frame_lock);

            if (out_len) {
                *out_len = used;
            }
            if (out_w) {
                *out_w = width;
            }
            if (out_h) {
                *out_h = height;
            }
            *inout_seq = done_seq;
            return ESP_OK;
        }
        if ((int32_t)(xTaskGetTickCount() - deadline) >= 0) {
            return ESP_ERR_TIMEOUT;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
