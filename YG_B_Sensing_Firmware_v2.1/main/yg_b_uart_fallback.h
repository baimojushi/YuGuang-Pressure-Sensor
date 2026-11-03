#ifndef YG_B_UART_FALLBACK_H
#define YG_B_UART_FALLBACK_H

#include "esp_err.h"
#include "yg_iface.h"

#define YG_FALLBACK_TX_GPIO 17
#define YG_FALLBACK_BAUD 460800

esp_err_t yg_b_uart_fallback_start(void);
void yg_b_uart_send_breath(const yg_breath_t *value);
void yg_b_uart_send_pressure(const yg_pressure_t *value);
void yg_b_uart_send_status(const yg_status_t *value);

#endif
