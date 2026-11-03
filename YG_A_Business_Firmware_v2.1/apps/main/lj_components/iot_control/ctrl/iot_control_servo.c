#include "iot_control_servo.h"

#include "bsp_servo.h"

#include "qm.h"
#include "qm_spec_api.h"

#define LOG_TAG "servo"

/* 云端一次转动命令：偏转后再回零位。 */
#define SERVO_STEP_DEG      30
#define SERVO_NUDGE_STACK   2048
#define SERVO_NUDGE_PRIO    5
/* 单程等待：步进 5°/40ms，30° 约 6 步，再留余量。 */
#define SERVO_LEG_WAIT_MS   \
    (((SERVO_STEP_DEG / BSP_SERVO_MOVE_STEP_DEG) + 3) * BSP_SERVO_MOVE_STEP_MS)

static qm_task_t s_nudge_task;
static uint8_t s_busy;
static int16_t s_peak;

static int16_t servo_home_angle(void)
{
    return (int16_t)(((int32_t)(BSP_SERVO_ZERO_PULSE_US - BSP_SERVO_PULSE_MIN_US) *
                      BSP_SERVO_PULSE_ANGLE_MAX) /
                     (BSP_SERVO_PULSE_MAX_US - BSP_SERVO_PULSE_MIN_US));
}

static int16_t clamp_angle(int16_t angle)
{
    if (angle < BSP_SERVO_PULSE_ANGLE_MIN) {
        return BSP_SERVO_PULSE_ANGLE_MIN;
    }
    if (angle > BSP_SERVO_PULSE_ANGLE_MAX) {
        return BSP_SERVO_PULSE_ANGLE_MAX;
    }
    return angle;
}

static void servo_nudge_task(void *arg)
{
    int16_t home = servo_home_angle();
    int16_t peak = s_peak;

    (void)arg;
    QM_LOGI(LOG_TAG, "nudge %d -> home %d", (int)peak, (int)home);
    bsp_servo_set_angle(peak);
    qm_msleep(SERVO_LEG_WAIT_MS);
    bsp_servo_set_angle(home);
    qm_msleep(SERVO_LEG_WAIT_MS);
    s_busy = 0;
    qm_task_exit(NULL);
}

int iot_control_servo_set_rotate(qm_spec_property_t *property)
{
    int value = 0;
    int16_t home;
    int16_t peak;

    if (property == NULL ||
        qm_spec_property_unpack_number(property, &value) != QM_EOK) {
        return -QM_EINVAL;
    }

    home = servo_home_angle();
    QM_LOGI(LOG_TAG, "ROTATE cmd=%d home=%d", value, (int)home);

    switch (value) {
    case 1: /* 1 号舵机顺时针 */
        peak = clamp_angle((int16_t)(home + SERVO_STEP_DEG));
        break;
    case 2: /* 1 号舵机逆时针 */
        peak = clamp_angle((int16_t)(home - SERVO_STEP_DEG));
        break;
    case 3:
    case 4:
        QM_LOGW(LOG_TAG, "servo2 cmd=%d ignored, no hw", value);
        return QM_EOK;
    default:
        QM_LOGW(LOG_TAG, "ROTATE unknown=%d", value);
        return QM_EOK;
    }

    if (s_busy) {
        QM_LOGW(LOG_TAG, "nudge busy, drop cmd=%d", value);
        return QM_EOK;
    }

    s_peak = peak;
    s_busy = 1;
    if (qm_task_new(&s_nudge_task, "servo_nudge", servo_nudge_task, NULL,
                    SERVO_NUDGE_STACK, SERVO_NUDGE_PRIO) != 0) {
        s_busy = 0;
        QM_LOGE(LOG_TAG, "nudge task create fail");
        return -QM_EIO;
    }
    return QM_EOK;
}
