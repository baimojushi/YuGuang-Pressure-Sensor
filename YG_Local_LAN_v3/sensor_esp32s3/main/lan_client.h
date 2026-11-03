#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "esp_err.h"
#include "radar_ld6002.h"

typedef struct {
    const uint8_t *frame;
    size_t frame_len;
    uint16_t width;
    uint16_t height;
    uint32_t frame_seq;
    uint32_t boot_id;
    int64_t frame_time_us;
    float servo_angle_deg;
    radar_snapshot_t radar;
    const radar_phase_sample_t *samples;
    size_t sample_count;
} yg_packet_t;

/* Packet: "YG01" + uint32LE(json_len) + uint32LE(raw_len) + utf8 json + UYVY.
   Returns command only after matching boot_id and frame_seq. */
esp_err_t lan_client_upload(const yg_packet_t *packet);
