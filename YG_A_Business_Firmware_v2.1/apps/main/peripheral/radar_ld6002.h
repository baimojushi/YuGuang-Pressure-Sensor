#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

/*
 * LD6002 传感器 TX0 -> ESP32 该 GPIO（仅 RX，无 TX 回线，GND 共地，3.3V >= 1A）。
 * 本工程（ljyd_xjwb03 SDK）默认 18；原 xjwb03_lab 工程为 5（马达已让位）。
 */
#ifndef RADAR_RX_GPIO
#define RADAR_RX_GPIO 18
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    bool ready;
    int rx_gpio;
    uint32_t baud;
    float raw, lp, hil_ph;
    float br, conf, amp, cv, score, fs, lag;
    /* 模组原生的心率/距离（V1.2: 0x0A15 / 0x0A16），br 在模组直报时也走这里 */
    float heart;
    float range;
    uint8_t range_valid;
    uint32_t breath_frames;
    int human;
    uint32_t samples_in_filter;
    uint32_t phase_frames;
    uint32_t crc_errors;
    uint32_t valid_frames;
    uint32_t rx_bytes;
    uint32_t max_filter_us;
    uint32_t last_phase_ms;
    char q[24];
} radar_snapshot_t;

esp_err_t radar_ld6002_start(void);
void radar_ld6002_snapshot(radar_snapshot_t *out);

/*
 * 打印最近收到的原始字节（十六进制）到日志，用于判定"波特率错"还是"协议不同"。
 * 上电后前 64 字节会自动打印一次，此后可用 CLI `radar dump` 随时再看。
 */
void radar_ld6002_hex_dump(void);

#ifdef __cplusplus
}
#endif
