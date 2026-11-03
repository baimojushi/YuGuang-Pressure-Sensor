#ifndef BSP_VIBRATOR_H
#define BSP_VIBRATOR_H

#ifdef __cplusplus
extern "C" {
#endif

#include "qm.h"

/*
 * 振动马达/音圈开关，GPIO0 高电平开、低电平关。
 * 引脚只驱动三极管/MOS 的栅极，马达电源单独供，和板子共地。
 * ESP32 GPIO 带不动马达电流。
 * 注意：GPIO0 是 boot 脚，上电前保持高阻/低，避免影响启动。
 */
#define BSP_VIBRATOR_GPIO       0
#define BSP_VIBRATOR_PULSE_MS   500

qm_err_t bsp_vibrator_init(void);
void bsp_vibrator_on(void);
void bsp_vibrator_off(void);
void bsp_vibrator_pulse(uint32_t ms);

#ifdef __cplusplus
}
#endif

#endif
