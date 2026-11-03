#ifndef LED_STATUS_H
#define LED_STATUS_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/*
 * 氛围灯联动：把雷达有人/无人、姿态好坏、唤醒事件映射到 WS2812。
 * 云端把灯打开时自动让位，不做本地动画。
 */
esp_err_t led_status_start(void);

#ifdef __cplusplus
}
#endif

#endif
