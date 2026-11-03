#include "qm.h"
#include "qm_work.h"
#include "bsp_io.h"
/* #include "bsp_mpu6050.h" */
#include "bsp_vibrator.h"
#include "bsp_ws2812.h"
#include "led_status.h"
#include "esp_heap_caps.h"
#include "yg_a_app.h"
#include "yg_a_ble.h"
#include "yg_a_uart_fallback.h"
#include "yg_ir_gpio.h"
#include "voice.h"
#if defined(CONFIG_LJYD_LOCAL_VOICE_SUPPORT) && CONFIG_LJYD_LOCAL_VOICE_SUPPORT
#include "wake_word.h"
#include "tts_local.h"
#endif
#include "agent_app.h"
#include "agent_arbiter.h"
#include "ljyd_cloud.h"
#include "ljyd_provision.h"
#include "iot_control.h"
#include "pomodoro.h"
#include "ljyd_course.h"
#if defined(CONFIG_QM_POSE_SUPPORT) && CONFIG_QM_POSE_SUPPORT
#include "example_pose.h"
#if defined(CONFIG_APP_CAMERA_TEST) && CONFIG_APP_CAMERA_TEST
#include "pose_runtime.h"
#endif
#endif

#if defined(CONFIG_APP_CAMERA_TEST) && CONFIG_APP_CAMERA_TEST
#include "bsp_camera.h"
#endif

#if defined(CONFIG_QM_ALARM_SUPPORT) && CONFIG_QM_ALARM_SUPPORT
#include "app_alarm.h"
#endif

#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
#include "playback.h"
#endif

#include <stdio.h>
#include <stdarg.h>

int qm_vsnprintf(char *str, size_t count, const char *fmt, va_list ap)
{
    return vsnprintf(str, count, fmt, ap);
}

void app_main(void)
{
    qm_main();
}

void qm_application_start(void)
{
#if defined(CONFIG_QM_POSE_SUPPORT) && CONFIG_QM_POSE_SUPPORT
#if defined(CONFIG_APP_CAMERA_TEST) && CONFIG_APP_CAMERA_TEST
    /* 摄像头实时姿态：先读模型（早于开流），再等摄像头开流后循环推理 */
    if (pose_runtime_init() != ESP_OK) {
        QM_LOGE("main", "pose runtime init failed");
    }
#else
    example_pose_run();
#endif
#endif

#if defined(CONFIG_LJYD_LOCAL_VOICE_SUPPORT) && CONFIG_LJYD_LOCAL_VOICE_SUPPORT
    /* 本地唤醒词：模型从 model 分区读，早于联网与摄像头开流 */
    if (wake_word_init() != ESP_OK) {
        QM_LOGE("main", "wake word init failed");
    }
    /* 离线 TTS：只建队列与任务，语音库首次播报时才加载 */
    if (tts_local_init() != ESP_OK) {
        QM_LOGE("main", "tts local init failed");
    }
#endif
    if (qm_work_on_init() != QM_EOK) {
        QM_LOGE("main", "qm_work_on_init failed");
        return;
    }
    if (bsp_vibrator_init() != QM_EOK) {
        QM_LOGE("main", "vibrator init failed");
    }
    if (bsp_ws2812_init() != QM_EOK) {
        QM_LOGE("main", "ws2812 init failed");
    }
    if (bsp_io_init() != QM_EOK) {
        QM_LOGE("main", "io init failed");
    }
    /* V2.1：雷达移至感知板 B；GPIO5 分配给亲友红外确认。 */
    yg_a_app_init();
    if (yg_a_uart_fallback_start() != ESP_OK) QM_LOGE("main", "UART fallback init failed");
    /* Start LED animation only after state initialization. */
    if (led_status_start() != ESP_OK) QM_LOGE("main", "LED status init failed");
    if (yg_ir_gpio_start() != ESP_OK) QM_LOGE("main", "GPIO5 IR init failed");
#if defined(CONFIG_APP_CAMERA_TEST) && CONFIG_APP_CAMERA_TEST
    if (bsp_camera_early_init() != ESP_OK) {
        QM_LOGE("main", "camera early init failed");
    }
#endif
    /* if (bsp_mpu6050_init() != QM_EOK) {
        QM_LOGE("main", "mpu6050 init failed");
    } */
    /* 资源让位仲裁层：先于一切会出声的模块初始化 */
    (void)agent_arbiter_init();
#if defined(CONFIG_LJYD_VOICE_CONVERSATION_ENABLE) && CONFIG_LJYD_VOICE_CONVERSATION_ENABLE
    if (voice_start() != QM_EOK) {
        QM_LOGE("main", "audio init failed");
        return;
    }
#endif
#if defined(CONFIG_LJYD_PLAYBACK_SUPPORT) && CONFIG_LJYD_PLAYBACK_SUPPORT
    if (playback_init() != QM_EOK) {
        QM_LOGE("main", "playback init failed");
    }
#endif

    if (ljyd_cloud_init() != QM_EOK) {
        QM_LOGE("main", "ljyd_cloud_init failed");
        return;
    }
    if (iot_control_init(ljyd_cloud_get_handle()) != QM_EOK) {
        QM_LOGE("main", "iot_control_init failed");
    }
    if (ljyd_course_init(ljyd_cloud_get_handle()) != QM_EOK) {
        QM_LOGE("main", "ljyd_course_init failed");
    }
    /* BLE Central 在云接入成功/配网 BLE 释放后启动，避免冲突。 */
    if (ljyd_provision_init() != QM_EOK) {
        QM_LOGE("main", "ljyd_provision_init failed");
    }
#if defined(CONFIG_LJYD_VOICE_CONVERSATION_ENABLE) && CONFIG_LJYD_VOICE_CONVERSATION_ENABLE
    if (agent_app_init(ljyd_cloud_get_handle()) != QM_EOK) {
        QM_LOGE("main", "agent_app_init failed");
    }
#endif

#if defined(CONFIG_QM_ALARM_SUPPORT) && CONFIG_QM_ALARM_SUPPORT
    /* 闹钟：开机即初始化（不要求已联网）。云端同步与响铃行为注册都在模块内部完成。 */
    if (app_alarm_init(ljyd_cloud_get_handle()) != QM_EOK) {
        QM_LOGE("main", "app_alarm_init failed");
    }
#endif

#if defined(CONFIG_QM_POMODORO_SUPPORT) && CONFIG_QM_POMODORO_SUPPORT
    pomodoro_init();
#endif

    /* 内存水位：内部 RAM 是配网成败的关键，留一行便于剪裁前后对照 */
    QM_LOGI("main", "app init done: internal free=%u, largest=%u, psram free=%u",
            (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
            (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL),
            (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
}
