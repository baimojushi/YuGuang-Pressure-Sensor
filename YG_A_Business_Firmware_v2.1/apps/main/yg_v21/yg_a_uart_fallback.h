#ifndef YG_A_UART_FALLBACK_H
#define YG_A_UART_FALLBACK_H

#include "esp_err.h"
#include <stdbool.h>

#define YG_FALLBACK_RX_GPIO 17
#define YG_FALLBACK_BAUD 460800

esp_err_t yg_a_uart_fallback_start(void);
bool yg_a_uart_fallback_active(void);

#endif
