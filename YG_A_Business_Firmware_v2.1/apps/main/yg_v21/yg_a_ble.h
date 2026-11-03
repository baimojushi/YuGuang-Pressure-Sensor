#ifndef YG_A_BLE_H
#define YG_A_BLE_H
#include <stdbool.h>
#include <stdint.h>
/* Starts only after QUMIOS BLE provisioning releases its GAP ownership. */
void yg_a_ble_start(void);
void yg_a_ble_control(uint8_t opcode,uint16_t param);
const char *yg_a_ble_state(void);
bool yg_a_ble_data_fresh(uint32_t max_age_ms);
void yg_a_ble_pair_window(uint32_t seconds);  /* physically authorized CLI only */
#endif
