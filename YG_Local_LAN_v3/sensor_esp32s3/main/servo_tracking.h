#pragma once
#include <stdbool.h>
#include "esp_err.h"
#ifdef __cplusplus
extern "C" {
#endif
esp_err_t servo_tracking_start(void);
float servo_tracking_angle(void);
/* Only valid LAN responses may call this. Hold when tracking is lost.
 * ttl_ms is bounded; the command is not a continual remote motor drive. */
bool servo_tracking_command(float angle_deg, unsigned ttl_ms);
void servo_tracking_hold(void);
#ifdef __cplusplus
}
#endif
