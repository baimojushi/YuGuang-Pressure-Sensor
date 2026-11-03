/* Breathing LEDs follow validated B-board samples and the A-board guide period.
 * Pure C11 module: no drivers, cloud, GPIO or global state. */
#ifndef YG_BREATH_LED_H
#define YG_BREATH_LED_H
#include <stdbool.h>
#include <stdint.h>
#include "yg_a_app.h"
/* Returns false on stale/untrusted samples, disabled/focused/care-only states. */
bool yg_breath_led_frame(const yg_a_snapshot_t *snapshot, uint32_t now_ms,
                         uint8_t rgb[3], uint16_t *period_100ms);
#endif
