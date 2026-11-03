/* XJWB03 / ESP32-S3 sensing-only runtime.
 * BF3901 UYVY frames + LD6002 phase/rate -> authenticated LAN PC;
 * validated PC vision tracks a person by local servo GPIO48.
 * No Lingji account/PID, MQTT cloud, BLE A/B, Tailscale, agent or LLM on-device.
 */
#include "bsp_camera.h"
#include "lan_client.h"
#include "radar_ld6002.h"
#include "servo_tracking.h"
#include "wifi_sta.h"
#include "sdkconfig.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdint.h>

#define FRAME_CAP (320U * 240U * 2U)
#define RADAR_BATCH_CAP 128U
static const char *TAG = "yg_sensor";

static void upload_task(void *arg)
{
    (void)arg;
    uint8_t *frame = heap_caps_malloc(FRAME_CAP, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    radar_phase_sample_t *samples = heap_caps_malloc(
        RADAR_BATCH_CAP * sizeof(radar_phase_sample_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!frame || !samples) {
        ESP_LOGE(TAG, "no PSRAM: cannot allocate UYVY frame + radar samples");
        vTaskDelete(NULL);
        return;
    }
    const uint32_t boot_id = esp_random() | 1U;
    uint32_t last_frame = 0, last_phase = 0;
    int64_t next_time = esp_timer_get_time();
    while (true) {
        const int64_t now = esp_timer_get_time();
        if (now < next_time) {
            vTaskDelay(pdMS_TO_TICKS(20));
            continue;
        }
        next_time = now + (int64_t)CONFIG_YG_UPLOAD_INTERVAL_MS * 1000;
        if (!wifi_sta_connected() || !bsp_camera_stream_is_on()) continue;
        size_t used = 0;
        uint16_t width = 0, height = 0;
        int64_t frame_timestamp_us = 0;
        esp_err_t e = bsp_camera_frame_copy(frame, FRAME_CAP, &used,
                                            &width, &height, &last_frame, 350,
                                            &frame_timestamp_us);
        if (e != ESP_OK) {
            ESP_LOGW(TAG, "camera frame unavailable: %s", esp_err_to_name(e));
            continue;
        }
        if (used != (size_t)width * height * 2U || used > FRAME_CAP) {
            ESP_LOGE(TAG, "camera buffer has headers or unexpected size: got=%u expect=%u",
                     (unsigned)used, (unsigned)(width * height * 2U));
            /* DO NOT upload malformed samples as valid UYVY. Confirm driver preprocessing. */
            continue;
        }
        radar_snapshot_t radar = {0};
        radar_ld6002_snapshot(&radar);
        uint32_t newest = last_phase;
        const size_t count = radar_ld6002_copy_phase_since(
            last_phase, samples, RADAR_BATCH_CAP, &newest);
        yg_packet_t p = {
            .frame = frame, .frame_len = used, .width = width, .height = height,
            .frame_seq = last_frame, .boot_id = boot_id,
            .frame_time_us = frame_timestamp_us,
            .servo_angle_deg = servo_tracking_angle(),
            .radar = radar, .samples = samples, .sample_count = count
        };
        e = lan_client_upload(&p);
        /* A sent frame may be retried with identical data; here we skip after failure,
           explicitly exposing the gap in phase_seq and PC report, not inventing samples. */
        if (e == ESP_OK) last_phase = newest;
        else ESP_LOGW(TAG, "LAN post failed: %s; servo holds", esp_err_to_name(e));
    }
}

void app_main(void)
{
    esp_err_t e = nvs_flash_init();
    if (e == ESP_ERR_NVS_NO_FREE_PAGES || e == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        e = nvs_flash_init();
    }
    ESP_ERROR_CHECK(e);
    /* BF3901 and LD6002 survive without either other subsystem. */
    ESP_ERROR_CHECK(servo_tracking_start());
    if (bsp_camera_early_init() != ESP_OK) ESP_LOGE(TAG, "BF3901 init failed");
    else if (bsp_camera_stream_start() != ESP_OK) ESP_LOGE(TAG, "BF3901 stream failed");
    ESP_ERROR_CHECK(radar_ld6002_start());
    ESP_ERROR_CHECK(wifi_sta_start());
    if (xTaskCreate(upload_task, "lan_upload", 12288, NULL, 4, NULL) != pdPASS)
        ESP_LOGE(TAG, "LAN task creation failed");
    ESP_LOGI(TAG, "LAN-only sensor ready: BF3901 + LD6002 GPIO%d + SG90 GPIO%d",
             RADAR_RX_GPIO, CONFIG_YG_SERVO_GPIO);
}
