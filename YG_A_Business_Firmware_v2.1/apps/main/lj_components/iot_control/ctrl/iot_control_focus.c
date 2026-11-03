#include "iot_control_focus.h"

#include "ljyd_cloud.h"
#include "yg_a_app.h"

#include "qm.h"
#include "qm_iot_api.h"
#include "qm_spec_api.h"

#define LOG_TAG "focus"

static uint8_t s_on;

/* 专注的实际判定（pose/雷达/云端下发）尚未接入；当前只做状态同步与影子回报。
 * MVP 重启后不持久（平台影子保留旧值，下次置位自动对齐）；需要持久化时参照 volume 加 KV。 */
bool iot_control_focus_is_on(void)
{
    return s_on != 0;
}

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

static void focus_shadow_report(void)
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
    shadow_add_bool(op, IOT_CONTROL_FOCUS_SIID, IOT_CONTROL_FOCUS_PIID_SWITCH,
                    (bool_t)s_on);
    ret = qm_iot_report(iot, op);
    if (ret != QM_EOK) {
        qm_spec_property_operation_delete(op);
        QM_LOGW(LOG_TAG, "shadow report failed ret=%d", (int)ret);
        return;
    }
    QM_LOGI(LOG_TAG, "shadow report on=%u", (unsigned)s_on);
}

int iot_control_focus_set_switch(qm_spec_property_t *property)
{
    bool_t value = 0;

    if (property == NULL ||
        qm_spec_property_unpack_bool(property, &value) != QM_EOK) {
        return -QM_EINVAL;
    }
    QM_LOGI(LOG_TAG, "SWITCH set=%d", (int)value);

    s_on = value ? 1 : 0;
    yg_a_app_focus(s_on != 0);
    focus_shadow_report();
    return QM_EOK;
}
