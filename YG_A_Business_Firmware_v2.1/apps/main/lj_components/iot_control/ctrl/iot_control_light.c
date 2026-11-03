#include "iot_control_light.h"

#include "bsp_ws2812.h"
#include "ljyd_cloud.h"
#include "yg_care.h"
#include "iot_control_v21.h"

#include "qm.h"
#include "qm_iot_api.h"
#include "qm_spec_api.h"

#define LOG_TAG "light"

/* 白光亮度固定值。v2 物模型的 siid 9 只有开关（piid 1），没有亮度属性。 */
#define LIGHTNESS_DEFAULT 60

static uint8_t s_on;
static uint8_t s_switch_seen;
bool iot_control_light_care_allowed(void)
{
    return s_switch_seen == 0 || s_on != 0;
}


/* 供本地灯效判断：云端把灯打开时，本地氛围动画让位 */
bool iot_control_light_is_on(void)
{
    return s_on != 0;
}

static void light_apply_hw(void)
{
    uint8_t level;

    if (!s_on) {
        (void)bsp_ws2812_clear();
        QM_LOGI(LOG_TAG, "hw off");
        return;
    }

    /* 白光：固定亮度映射到 0..255。彩色灯语是下一步（见文件尾注释）。 */
    level = (uint8_t)(((uint32_t)LIGHTNESS_DEFAULT * 255u) / 100u);
    (void)bsp_ws2812_fill(level, level, level);
    QM_LOGI(LOG_TAG, "hw on level=%u", (unsigned)level);
}

void iot_control_light_restore(void){ if(s_on)light_apply_hw(); }

static void shadow_add_bool(qm_spec_property_operation_t *op,
                            uint8_t siid, uint16_t piid, bool_t value)
{
    qm_spec_property_t *prop;

    if (op == NULL) {
        return;
    }
    prop = qm_spec_property_creat();
    if (prop == NULL) {
        return;
    }
    qm_spec_property_pack_xiid(prop, siid, piid);
    qm_spec_property_pack_bool(prop, value);
    qm_spec_property_add(op, prop);
}

static void light_shadow_report(void)
{
    qm_spec_property_operation_t *op;
    void *iot;
    int32_t ret;

    iot = ljyd_cloud_get_handle();
    if (iot == NULL) {
        return;
    }
    op = qm_spec_property_operation_creat();
    if (op == NULL) {
        return;
    }
    shadow_add_bool(op, IOT_CONTROL_LIGHT_SIID, IOT_CONTROL_LIGHT_PIID_SWITCH,
                    (bool_t)s_on);
    ret = qm_iot_report(iot, op);
    if (ret != QM_EOK) {
        qm_spec_property_operation_delete(op);
        QM_LOGW(LOG_TAG, "shadow report failed ret=%d", (int)ret);
        return;
    }
    QM_LOGI(LOG_TAG, "shadow report on=%u", (unsigned)s_on);
}

void iot_control_light_set_local(bool enable)
{
    s_switch_seen=1;
    s_on=enable?1:0;
    if(!s_on){yg_care_cancel_display();yg_iot_preview_cancel();}
    light_apply_hw();
    light_shadow_report();
}

int iot_control_light_set_switch(qm_spec_property_t *property)
{
    bool_t value = 0;

    if (property == NULL ||
        qm_spec_property_unpack_bool(property, &value) != QM_EOK) {
        return -QM_EINVAL;
    }
    QM_LOGI(LOG_TAG, "SWITCH set=%d", (int)value);

    iot_control_light_set_local(value!=0);
    return QM_EOK;
}

/*
 * 余光 v2 物模型：siid 9 piid 1 = 情感光开关（bool 可写）。
 * MVP：开 = WS2812 白光常亮，关 = 熄灭；led_status 氛围动画经
 * iot_control_light_is_on() 让位（允许时白光优先，关闭时氛围呼吸继续）。
 * 情感光彩色灯语/呼吸动画与开关的联动是下一步（led_status 让位机制已具备）。
 */
