#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/*
 * LD6002 生命体征雷达接线层：启动 UART2 接收（RX=GPIO18 @1382400）、
 * 注册 `radar` CLI 命令、并起一个 1 Hz 状态日志任务。
 */
esp_err_t radar_link_init(void);

#ifdef __cplusplus
}
#endif
