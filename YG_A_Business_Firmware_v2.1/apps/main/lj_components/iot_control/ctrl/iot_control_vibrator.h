#ifndef IOT_CONTROL_VIBRATOR_H
#define IOT_CONTROL_VIBRATOR_H

#include "qm_spec_api.h"

#ifdef __cplusplus
extern "C" {
#endif

#define IOT_CONTROL_VIBRATOR_SIID         10
#define IOT_CONTROL_VIBRATOR_PIID_SWITCH  1 /* bool 开关 */

int iot_control_vibrator_set_switch(qm_spec_property_t *property);

#ifdef __cplusplus
}
#endif

#endif
