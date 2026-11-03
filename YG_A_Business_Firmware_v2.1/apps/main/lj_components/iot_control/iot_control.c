#include "iot_control.h"

#include "iot_control_breath.h"
#include "iot_control_focus.h"
#include "iot_control_light.h"
#include "iot_control_volume.h"
#include "iot_control_v21.h"
#include "ljyd_cloud.h"

#include "qm.h"

#define LOG_TAG "iot_control"

/*
 * 物模型下行表（对齐余光平台物模型 v2, productKey 11879「余光」）：
 *   2.1 / 2.2  音量 / 音量增减
 *   9.1        情感光开关（WS2812 白光；v2 的 siid 9 只有 piid 1）
 *   10.2       深度专注开关
 * 只读属性不在本表：10.3 呼吸频率 / 10.4 采集状态由 iot_control_breath 周期上报。
 * 舵机（原 9.1）和振动马达（原 10.1）在 v2 里没有对应属性，已摘出表外；
 * 代码保留在 ctrl/，平台后续加属性时再登记，不要与本表现有绑定重复。
 * 新增控制项加一行。
 */

typedef int (*iot_control_fn)(qm_spec_property_t *property);

typedef struct {
    uint8_t siid;
    uint16_t piid;
    iot_control_fn action;
} iot_control_entry_t;

static const iot_control_entry_t s_table[] = {
    {IOT_CONTROL_VOLUME_SIID, IOT_CONTROL_VOLUME_PIID, iot_control_volume_set_value},
    {IOT_CONTROL_VOLUME_SIID, IOT_CONTROL_VOLUME_PIID_ADJ, iot_control_volume_set_adjust},
    {IOT_CONTROL_LIGHT_SIID, IOT_CONTROL_LIGHT_PIID_SWITCH, iot_control_light_set_switch},
    {IOT_CONTROL_FOCUS_SIID, IOT_CONTROL_FOCUS_PIID_SWITCH, iot_control_focus_set_switch},
    {YG_SIID, 1, iot_control_v21_set},
    {YG_SIID, 4, iot_control_v21_set},
    {YG_SIID, 6, iot_control_v21_set},
    {YG_SIID, YG_LIGHT_PREVIEW_PIID, iot_control_v21_set},
};

int iot_control_init(void *iot_handle)
{
    if (iot_handle == NULL) {
        return -QM_EINVAL;
    }

    ljyd_cloud_set_prop_cb(iot_control_on_set);

    /* 只读遥测（10.3 呼吸频率 / 10.4 采集状态）周期上报 */
    if (iot_control_breath_start() != QM_EOK) {
        QM_LOGW(LOG_TAG, "breath report task not started");
    }
    return QM_EOK;
}

void iot_control_on_set(qm_spec_property_t *property)
{
    size_t i;

    if (property == NULL) {
        return;
    }
    for (i = 0; i < QM_ARRAY_SIZE(s_table); i++) {
        if (s_table[i].siid != property->siid ||
            s_table[i].piid != property->piid) {
            continue;
        }
        if (s_table[i].action != NULL) {
            (void)s_table[i].action(property);
        }
        return;
    }
}
