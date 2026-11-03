#ifndef IOT_CONTROL_LIGHT_H
#define IOT_CONTROL_LIGHT_H

#include "qm_spec_api.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* 余光 v2 物模型：siid 9 piid 1 = 情感光开关（bool 可写）。 */
#define IOT_CONTROL_LIGHT_SIID        9
#define IOT_CONTROL_LIGHT_PIID_SWITCH 1 /* bool 允许情感光 */

int iot_control_light_set_switch(qm_spec_property_t *property);
void iot_control_light_set_local(bool enable); /* explicit local voice action */
/* Reassert white owner light after transient previews finish. */
void iot_control_light_restore(void);

/* 云端灯是否处于开启状态；本地氛围动画据此让位 */
bool iot_control_light_is_on(void);
/* 开关未首次设置前沿用旧版允许灯语的默认行为。显式关灯后禁止情感灯语。 */
bool iot_control_light_care_allowed(void);

#ifdef __cplusplus
}
#endif

#endif
