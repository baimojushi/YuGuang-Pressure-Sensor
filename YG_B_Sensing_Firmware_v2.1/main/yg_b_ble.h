#ifndef YG_B_BLE_H
#define YG_B_BLE_H
#include "esp_err.h"
#include "yg_iface.h"
esp_err_t yg_b_ble_start(void);
/* No publish if link not encrypted or peer has not subscribed. */
void yg_b_ble_send_breath(const yg_breath_t *b);
void yg_b_ble_send_status(const yg_status_t *s);
void yg_b_ble_queue_pressure(const yg_pressure_t *p);
void yg_b_ble_poll(uint32_t now_ms);
bool yg_b_ble_stream_enabled(void);
/* Local physically authorized commissioning. Off by default. */
void yg_b_ble_pair_window(uint32_t seconds);
bool yg_b_ble_demo_desired(void);
#endif
