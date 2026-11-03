#ifndef IOT_CONTROL_FOCUS_H
#define IOT_CONTROL_FOCUS_H

#include "qm_spec_api.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* 余光 v2 物模型：siid 10 piid 2 = 深度专注（bool 可写）。 */
#define IOT_CONTROL_FOCUS_SIID        10
#define IOT_CONTROL_FOCUS_PIID_SWITCH 2 /* bool 深度专注 */

int iot_control_focus_set_switch(qm_spec_property_t *property);

/* 当前专注状态；专注的实际判定（pose/雷达/云端）接入后由此读取 */
bool iot_control_focus_is_on(void);

#ifdef __cplusplus
}
#endif

#endif
