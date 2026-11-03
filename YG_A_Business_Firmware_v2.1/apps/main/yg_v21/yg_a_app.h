#ifndef YG_A_APP_H
#define YG_A_APP_H
#include <stdbool.h>
#include <stdint.h>
#include "yg_iface.h"
#include "yg_guidance.h"
typedef struct {
    yg_guidance_t guidance;
    yg_breath_t breath;
    bool ble_connected, have_breath;
    uint32_t last_breath_ms;
    uint32_t sensor_boot_id;
} yg_a_snapshot_t;
void yg_a_app_init(void);
void yg_a_app_on_breath(const yg_breath_t *b);
/* event reception/dedupe must be completed in the BLE layer before call */
void yg_a_app_on_pressure(const yg_pressure_t *p);
void yg_a_app_ble_connected(bool connected, uint32_t boot_id);
void yg_a_app_get(yg_a_snapshot_t *out);
void yg_a_app_companion_enable(bool enable);
bool yg_a_app_relax_request(void);  /* voice, 13.6 or local user initiation */
void yg_a_app_focus(bool focus);
void yg_a_app_care_active(bool active);
void yg_a_app_demo_intent(bool enable);
bool yg_a_app_demo_desired(void);
/* 10.3 low-frequency owner-only shadow; returns 0 when stale */
int yg_a_app_bpm_x10(void);
#endif
