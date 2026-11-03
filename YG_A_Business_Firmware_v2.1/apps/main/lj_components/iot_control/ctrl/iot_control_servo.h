#ifndef IOT_CONTROL_SERVO_H
#define IOT_CONTROL_SERVO_H

#include "qm_spec_api.h"

#ifdef __cplusplus
extern "C" {
#endif

#define IOT_CONTROL_SERVO_SIID         9
#define IOT_CONTROL_SERVO_PIID_ROTATE  1 /* 1/2 舵机1顺/逆；3/4 舵机2暂无 */

int iot_control_servo_set_rotate(qm_spec_property_t *property);

#ifdef __cplusplus
}
#endif

#endif
