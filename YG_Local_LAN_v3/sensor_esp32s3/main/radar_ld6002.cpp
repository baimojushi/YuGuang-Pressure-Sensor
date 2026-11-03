/*
 * HLK-LD6002 RX-only adapter for ESP-IDF on ESP32-S3.
 * Uses exact user-supplied radar_resp_filter_v8.h with NO algorithm changes.
 * TF parsing/checksum adapted from Radar_Filter_v8/src/main.cpp.
 * B-board radar UART RX is GPIO18 (see radar_ld6002.h).
 * Sensor TX0 -> ESP GPIO18, RX0 unconnected; GND shared, supply per module spec.
 */
#include "radar_ld6002.h"
#include "radar_resp_filter_v8.h"
#include "radar_tf_parser.hpp"
#include "driver/uart.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include <stdio.h>
#include <string.h>
#include <math.h>

namespace {
static const uart_port_t kPort = UART_NUM_2;
static const gpio_num_t kRx = (gpio_num_t)RADAR_RX_GPIO;
static const int kBaud = 1382400;
static portMUX_TYPE g_lock = portMUX_INITIALIZER_UNLOCKED;
static radar_snapshot_t g_state = {};
static constexpr size_t kPhaseHistory = 512;
static radar_phase_sample_t g_phase_ring[kPhaseHistory] = {};
static uint32_t g_phase_sample_seq = 0;
static radar_v8::Filter g_filter;
static ld6002_tf::Parser g_parser;
static uint32_t g_phase_frames = 0;
static uint32_t g_rx_bytes = 0;
static uint32_t g_max_filter_us = 0;

/* 模组原生上报值（V1.2: 0x0A14 呼吸率 / 0x0A15 心率 / 0x0A16 距离） */
static float g_mod_br = 0.0f;
static uint32_t g_mod_br_ms = 0;
static float g_mod_heart = 0.0f;
static uint32_t g_mod_heart_ms = 0;
static float g_mod_range = 0.0f;
static uint32_t g_mod_range_ms = 0;
static bool g_mod_range_valid = false;
static uint32_t g_breath_frames = 0;
static const uint32_t kModStaleMs = 3000;

/* 原始字节取证：上电后前 64 字节自动打印一次；另有 32 字节滚动环供 CLI 随时 dump */
static const char* kTag = "ld6002";
static uint8_t g_hex_first[64];
static size_t g_hex_first_len = 0;
static uint8_t g_hex_ring[32];
static uint32_t g_hex_ring_pos = 0;

static uint32_t ms(void) { return (uint32_t)(esp_timer_get_time() / 1000ULL); }

static void log_hex(const char* label, const uint8_t* buf, size_t len) {
    char line[3 * 16 + 8];
    for (size_t off = 0; off < len; off += 16) {
        const size_t n = (len - off > 16) ? 16 : (len - off);
        int p = 0;
        for (size_t i = 0; i < n; ++i) {
            p += snprintf(line + p, sizeof(line) - (size_t)p, "%02X ", buf[off + i]);
        }
        ESP_LOGW(kTag, "%s +%u: %s", label, (unsigned)off, line);
    }
}
static float unpack_f32(const uint8_t* p) {
    const uint32_t value = (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
        ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    float result = 0.0f;
    memcpy(&result, &value, sizeof(result));
    return result;
}
static void on_frame(const ld6002_tf::Frame &f, uint32_t now) {
    if (f.type == ld6002_tf::TYPE_HUMAN && f.length >= 2) {
        const uint16_t value = (uint16_t)f.payload[0] | ((uint16_t)f.payload[1] << 8);
        g_filter.on_human(value == 1);
    } else if (f.type == ld6002_tf::TYPE_PHASE && f.length >= 12) {
        // Keep v8's original input choice: the FIRST float, i.e. total phase.
        const float phase = unpack_f32(f.payload);
        const int64_t start_us = esp_timer_get_time();
        g_filter.add(phase, now);
        if (isfinite(phase)) {
            const int64_t sample_time_us = esp_timer_get_time();
            portENTER_CRITICAL(&g_lock);
            const uint32_t seq = ++g_phase_sample_seq;
            g_phase_ring[(seq - 1U) % kPhaseHistory] = {seq, sample_time_us, phase};
            portEXIT_CRITICAL(&g_lock);
        }
        const uint32_t duration_us = (uint32_t)(esp_timer_get_time() - start_us);
        if (duration_us > g_max_filter_us) g_max_filter_us = duration_us;
        ++g_phase_frames;
    } else if (f.type == ld6002_tf::TYPE_BREATH && f.length >= 4) {
        /* V1.2 0x0A14：模组直接给出呼吸率（1×float） */
        g_mod_br = unpack_f32(f.payload);
        g_mod_br_ms = now;
        ++g_breath_frames;
    } else if (f.type == ld6002_tf::TYPE_HEART && f.length >= 4) {
        /* V1.2 0x0A15：心率 */
        g_mod_heart = unpack_f32(f.payload);
        g_mod_heart_ms = now;
    } else if (f.type == ld6002_tf::TYPE_DISTANCE && f.length >= 4) {
        /* V1.2 0x0A16：uint32 flag(4B) [+ float range(4B)]。
         * 本模组实测发的是 LEN=4 只有 flag，不带 range。 */
        const uint32_t flag = (uint32_t)f.payload[0] | ((uint32_t)f.payload[1] << 8) |
            ((uint32_t)f.payload[2] << 16) | ((uint32_t)f.payload[3] << 24);
        g_mod_range_valid = (flag != 0U);
        g_mod_range = (f.length >= 8) ? unpack_f32(f.payload + 4) : 0.0f;
        g_mod_range_ms = now;
    }
}
static void publish(void) {
    const radar_v8::Result &r = g_filter.result();
    radar_snapshot_t snap = {};
    snap.ready = true;
    snap.rx_gpio = (int)kRx;
    snap.baud = (uint32_t)kBaud;
    snap.raw = r.raw;
    snap.lp = r.lp;
    snap.hil_ph = r.hil_ph;
    snap.conf = r.conf;
    snap.amp = r.amp;
    snap.cv = r.cv;
    snap.score = r.score;
    snap.fs = r.fs;
    snap.lag = r.lag;
    snap.human = (int)r.human;
    snap.samples_in_filter = (uint32_t)r.count;
    snap.phase_frames = g_phase_frames;
    snap.crc_errors = g_parser.errors();
    snap.valid_frames = g_parser.good_frames();
    snap.rx_bytes = g_rx_bytes;
    snap.max_filter_us = g_max_filter_us;
    snap.last_phase_ms = r.last_sample_ms;

    /* 模组原生值优先（3 s 内有效）；否则退回 v8 滤波器 */
    const uint32_t now_ms = ms();
    const bool br_fresh = (g_mod_br_ms != 0) && ((uint32_t)(now_ms - g_mod_br_ms) <= kModStaleMs);
    const bool hr_fresh = (g_mod_heart_ms != 0) && ((uint32_t)(now_ms - g_mod_heart_ms) <= kModStaleMs);
    const bool rg_fresh = (g_mod_range_ms != 0) && ((uint32_t)(now_ms - g_mod_range_ms) <= kModStaleMs);

    snap.br = br_fresh ? g_mod_br : r.br;
    snap.heart = hr_fresh ? g_mod_heart : 0.0f;
    snap.range = (rg_fresh && g_mod_range_valid) ? g_mod_range : 0.0f;
    snap.range_valid = (rg_fresh && g_mod_range_valid) ? 1 : 0;
    snap.breath_frames = g_breath_frames;

    if (r.human >= 0) {
        snap.human = (int)r.human;                 /* 0x0F09 有就优先 */
    } else if (br_fresh) {
        snap.human = (g_mod_br > 0.0f) ? 1 : 0;    /* 由模组呼吸率推导 */
    } else {
        snap.human = -1;
    }

    (void)snprintf(snap.q, sizeof(snap.q), "%s",
                   br_fresh ? "module" : radar_v8::status_name(r.status));
    portENTER_CRITICAL(&g_lock);
    g_state = snap;
    portEXIT_CRITICAL(&g_lock);
}
static void rx_task(void*) {
    uint8_t bytes[512];
    uint32_t last_publish = 0;
    for (;;) {
        int n = uart_read_bytes(kPort, bytes, sizeof(bytes), pdMS_TO_TICKS(20));
        if (n > 0) {
            g_rx_bytes += (uint32_t)n;
            for (int i = 0; i < n; ++i) {
                if (g_hex_first_len < sizeof(g_hex_first)) {
                    g_hex_first[g_hex_first_len++] = bytes[i];
                    if (g_hex_first_len == sizeof(g_hex_first)) {
                        log_hex("first64", g_hex_first, g_hex_first_len);
                    }
                }
                g_hex_ring[g_hex_ring_pos % sizeof(g_hex_ring)] = bytes[i];
                g_hex_ring_pos++;

                ld6002_tf::Frame frame = {};
                const uint32_t now = ms();
                if (g_parser.feed(bytes[i], now, &frame)) on_frame(frame, now);
            }
        }
        uint32_t now = ms();
        g_filter.tick(now);
        if ((uint32_t)(now - last_publish) >= 100) {
            last_publish = now;
            publish();
        }
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}
}
extern "C" esp_err_t radar_ld6002_start(void) {
    uart_config_t conf = {};
    conf.baud_rate = kBaud;
    conf.data_bits = UART_DATA_8_BITS;
    conf.parity = UART_PARITY_DISABLE;
    conf.stop_bits = UART_STOP_BITS_1;
    conf.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
    conf.source_clk = UART_SCLK_DEFAULT;
    esp_err_t e = uart_param_config(kPort, &conf);
    if (e != ESP_OK) return e;
    // Only RX attached. No physical TX assigned or used by firmware.
    e = uart_set_pin(kPort, UART_PIN_NO_CHANGE, kRx,
                     UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);
    if (e != ESP_OK) return e;
    e = uart_driver_install(kPort, 16384, 0, 0, nullptr, 0);
    if (e != ESP_OK) return e;
    if (xTaskCreate(rx_task, "ld6002_uart", 8192, nullptr, 5, nullptr) != pdPASS) {
        uart_driver_delete(kPort);
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}
extern "C" void radar_ld6002_snapshot(radar_snapshot_t *out) {
    if (!out) return;
    portENTER_CRITICAL(&g_lock);
    *out = g_state;
    portEXIT_CRITICAL(&g_lock);
}
extern "C" void radar_ld6002_hex_dump(void) {
    const uint32_t total = g_hex_ring_pos;
    if (total == 0) {
        ESP_LOGW(kTag, "hex dump: no rx bytes yet (check wiring / power / baud)");
        return;
    }
    const size_t cap = sizeof(g_hex_ring);
    const size_t len = (total < cap) ? (size_t)total : cap;
    const uint32_t start = total - (uint32_t)len;
    uint8_t tmp[32];
    for (size_t i = 0; i < len; ++i) {
        tmp[i] = g_hex_ring[(start + (uint32_t)i) % cap];
    }
    ESP_LOGW(kTag, "hex dump: total_rx=%u last=%u bytes", (unsigned)total, (unsigned)len);
    log_hex("recent", tmp, len);
}

extern "C" size_t radar_ld6002_copy_phase_since(uint32_t after_seq,
                                                  radar_phase_sample_t *dst,
                                                  size_t cap, uint32_t *out_latest_seq)
{
    if (!dst || cap == 0) return 0;
    portENTER_CRITICAL(&g_lock);
    const uint32_t latest = g_phase_sample_seq;
    uint32_t available = latest - after_seq;
    if (available > kPhaseHistory) available = kPhaseHistory;
    if (available > cap) available = (uint32_t)cap;
    for (uint32_t i = 0; i < available; ++i) {
        const uint32_t seq = latest - available + 1U + i;
        dst[i] = g_phase_ring[(seq - 1U) % kPhaseHistory];
    }
    portEXIT_CRITICAL(&g_lock);
    if (out_latest_seq) *out_latest_seq = latest;
    return available;
}
