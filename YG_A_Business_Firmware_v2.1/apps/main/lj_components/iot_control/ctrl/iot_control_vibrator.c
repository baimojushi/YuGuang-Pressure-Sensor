#include "iot_control_vibrator.h"

#include "bsp_vibrator.h"
#include "ljyd_cloud.h"

#include "qm.h"
#include "qm_iot_api.h"
#include "qm_spec_api.h"

#define LOG_TAG "vibrator"

#define VIB_DURATION_MS   3000
#define VIB_TASK_STACK    2048
#define VIB_TASK_PRIO     5

static uint8_t s_on;
static uint8_t s_busy;
static uint8_t s_abort;
static qm_task_t s_vib_task;

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

static void vibrator_shadow_report(void)
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
    shadow_add_bool(op, IOT_CONTROL_VIBRATOR_SIID,
                    IOT_CONTROL_VIBRATOR_PIID_SWITCH, (bool_t)s_on);
    ret = qm_iot_report(iot, op);
    if (ret != QM_EOK) {
        qm_spec_property_operation_delete(op);
        QM_LOGW(LOG_TAG, "shadow report failed ret=%d", (int)ret);
        return;
    }
    QM_LOGI(LOG_TAG, "shadow report on=%u", (unsigned)s_on);
}

static void vibrator_pulse_task(void *arg)
{
    (void)arg;
    bsp_vibrator_on();
    qm_msleep(VIB_DURATION_MS);
    if (!s_abort) {
        bsp_vibrator_off();
        s_on = 0;
        vibrator_shadow_report();
        QM_LOGI(LOG_TAG, "auto stop after %u ms", (unsigned)VIB_DURATION_MS);
    }
    s_busy = 0;
    qm_task_exit(NULL);
}

int iot_control_vibrator_set_switch(qm_spec_property_t *property)
{
    bool_t value = 0;

    if (property == NULL ||
        qm_spec_property_unpack_bool(property, &value) != QM_EOK) {
        return -QM_EINVAL;
    }

    QM_LOGI(LOG_TAG, "SWITCH set=%d", (int)value);

    if (!value) {
        s_abort = 1;
        bsp_vibrator_off();
        s_on = 0;
        vibrator_shadow_report();
        return QM_EOK;
    }

    if (s_busy) {
        QM_LOGW(LOG_TAG, "busy, drop on");
        return QM_EOK;
    }

    s_abort = 0;
    s_busy = 1;
    s_on = 1;
    vibrator_shadow_report();
    if (qm_task_new(&s_vib_task, "vib_pulse", vibrator_pulse_task, NULL,
                    VIB_TASK_STACK, VIB_TASK_PRIO) != 0) {
        s_busy = 0;
        s_on = 0;
        bsp_vibrator_off();
        vibrator_shadow_report();
        QM_LOGE(LOG_TAG, "pulse task create fail");
        return -QM_EIO;
    }
    return QM_EOK;
}
