/* YG-IFACE-2.1.0 frozen BLE wire protocol; little-endian, portable C11. */
#ifndef YG_IFACE_H
#define YG_IFACE_H
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#define YG_INTERFACE_VERSION 1u
#define YG_BREATH_BYTES 20u
#define YG_PRESSURE_BYTES 20u
#define YG_STATUS_BYTES 20u
#define YG_CONTROL_BYTES 8u
#define YG_ACK_BYTES 8u
#define YG_FLAG_WAVE 1u
#define YG_FLAG_BPM 2u
#define YG_FLAG_STAGE 4u
#define YG_FLAG_CONFIDENCE 8u
#define YG_EVENT_PRESSURE_FALL 1u
#define YG_ACK_PRESSURE 1u
/* GATT UUID: e78f0d10-44c0-47c5-9ae8-b051000000{01..06}. 128-bit LE. */
#define YG_UUID_LE(last) {last,0x00,0x00,0x00,0x51,0xb0,0xe8,0x9a,0xc5,0x47,0xc0,0x44,0x10,0x0d,0x8f,0xe7}
#define YG_SERVICE_UUID YG_UUID_LE(0x01)
#define YG_BREATH_UUID YG_UUID_LE(0x02)
#define YG_PRESSURE_UUID YG_UUID_LE(0x03)
#define YG_STATUS_UUID YG_UUID_LE(0x04)
#define YG_CONTROL_UUID YG_UUID_LE(0x05)
#define YG_ACK_UUID YG_UUID_LE(0x06)
typedef struct {
    uint8_t flags;
    uint16_t seq;
    uint32_t uptime_ms;
    int16_t wave_q15;
    uint16_t bpm_x10;
    uint8_t stage;
    uint8_t confidence_pct;
    uint16_t progress_permille;
    uint16_t sample_age_ms;
} yg_breath_t;
typedef struct {
    uint32_t event_id;
    uint16_t seq;
    uint32_t uptime_ms;
    uint16_t score_x10;
    uint8_t confidence_pct;
    uint8_t flags;
    uint16_t ttl_ms;
} yg_pressure_t;
/* Sensor Status offset layout: version, radar, pose, fusion, demo_auth,
 * flags, boot_id:u32, uptime_ms:u32, dropped:u16, phase_hz_x10:u16,
 * reserved:u16. The frozen contract fixed size/content, not its offsets. */
typedef struct {
    uint8_t radar,pose,fusion,demo_auth,flags;
    uint32_t boot_id,uptime_ms;
    uint16_t dropped,phase_hz_x10;
} yg_status_t;
typedef struct {uint8_t opcode;uint16_t param;uint32_t command_id;} yg_control_t;
typedef struct {uint8_t kind;uint32_t event_id;uint8_t result;} yg_ack_t;
bool yg_breath_pack(uint8_t out[20],const yg_breath_t *v);
bool yg_breath_unpack(yg_breath_t *out,const uint8_t *p,size_t n);
bool yg_pressure_pack(uint8_t out[20],const yg_pressure_t *v);
bool yg_pressure_unpack(yg_pressure_t *out,const uint8_t *p,size_t n);
bool yg_status_pack(uint8_t out[20],const yg_status_t *v);
bool yg_status_unpack(yg_status_t *out,const uint8_t *p,size_t n);
bool yg_control_pack(uint8_t out[8],const yg_control_t *v);
bool yg_control_unpack(yg_control_t *out,const uint8_t *p,size_t n);
bool yg_ack_pack(uint8_t out[8],const yg_ack_t *v);
bool yg_ack_unpack(yg_ack_t *out,const uint8_t *p,size_t n);
/* Remote event uptime is evaluated against latest B status uptime; modulo-safe. */
bool yg_event_expired(uint32_t event_uptime,uint16_t ttl,uint32_t status_uptime);
#endif
