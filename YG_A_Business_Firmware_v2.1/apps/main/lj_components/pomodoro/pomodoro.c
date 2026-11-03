#include "pomodoro.h"
#include "ljyd_method.h"

#include "cJSON.h"
#include "qm.h"
#include "qm_iot_api.h"
#include "qm_iot_mqtt.h"
#include "qm_pomodoro.h"

#include <string.h>

#if CONFIG_QM_CLI_SUPPORT
#include "qm_cli.h"
#endif

#define LOG_TAG "pomodoro"

static qm_pomodoro_t g_pomodoro;

#if CONFIG_QM_CLI_SUPPORT
static int pomodoro_cli_register(void);
#endif

static void on_pomodoro_event(qm_pomodoro_t t, const qm_pomodoro_event_data_t *e)
{
    (void)t;
    if (e == NULL) {
        return;
    }
    switch (e->event) {
    case QM_POMODORO_EVENT_TICK:
        /* Remaining time was updated. */
        QM_LOGI(LOG_TAG, "remain=%us", (unsigned)e->status.remaining_sec);
        break;
    case QM_POMODORO_EVENT_STATE_CHANGED:
        /* Phase changed. */
        break;
    case QM_POMODORO_EVENT_PHASE_DONE:
        /* Current focus or break phase completed. */
        break;
    case QM_POMODORO_EVENT_PAUSED:
        /* Timer was paused. */
        break;
    case QM_POMODORO_EVENT_RESUMED:
        /* Timer resumed from pause. */
        break;
    case QM_POMODORO_EVENT_STOPPED:
        /* Timer was stopped and reset to idle. */
        break;
    case QM_POMODORO_EVENT_FINISHED:
        /* Target focus count completed. */
        break;
    default:
        /* Unknown event. */
        break;
    }
}

static int pomodoro_start(void)
{
    return qm_pomodoro_start(g_pomodoro);
}

static int pomodoro_stop(void)
{
    return qm_pomodoro_stop(g_pomodoro);
}

static int pomodoro_pause(void)
{
    return qm_pomodoro_pause(g_pomodoro);
}

static int pomodoro_resume(void)
{
    return qm_pomodoro_resume(g_pomodoro);
}

static inline int pomodoro_skip(void)
{
    return qm_pomodoro_skip(g_pomodoro);
}

static inline int pomodoro_get_status(qm_pomodoro_status_t *status)
{
    return qm_pomodoro_get_status(g_pomodoro, status);
}

void pomodoro_init(void)
{
    qm_pomodoro_config_t cfg = {0};

    cfg.focus_sec           = CONFIG_QM_POMODORO_FOCUS_SEC;
    cfg.short_break_sec     = CONFIG_QM_POMODORO_SHORT_BREAK_SEC;
    cfg.long_break_sec      = CONFIG_QM_POMODORO_LONG_BREAK_SEC;
    cfg.long_break_interval = CONFIG_QM_POMODORO_LONG_BREAK_INTERVAL;
    cfg.focus_target        = CONFIG_QM_POMODORO_FOCUS_TARGET;
    cfg.tick_ms             = CONFIG_QM_POMODORO_TICK_MS;
    cfg.event_cb            = on_pomodoro_event;

    g_pomodoro = qm_pomodoro_create(&cfg);
    if (g_pomodoro == NULL) {
        QM_LOGE(LOG_TAG, "create failed");
        return;
    }
#if CONFIG_APP_POMODORO_AUTO_START
    (void)qm_pomodoro_start(g_pomodoro);
#endif
#if CONFIG_QM_CLI_SUPPORT
    if (pomodoro_cli_register() != 0) {
        QM_LOGE(LOG_TAG, "cli register failed");
    }
#endif
}

static void handle_pomodoro_cloud_down(void *handle,
                                       const qm_iot_mqtt_recv_t *packet,
                                       void *userdata)
{
    cJSON *root;
    cJSON *sub;
    const char *subMethod;
    int ret;

    (void)handle;
    (void)userdata;
    if (packet == NULL || packet->type != QM_IOT_MQTTRECV_PUB ||
        packet->data.pub.payload == NULL) {
        return;
    }

    root = cJSON_ParseWithLength((const char *)packet->data.pub.payload,
                                 packet->data.pub.payload_len);
    if (root == NULL) {
        return;
    }

    sub = cJSON_GetObjectItem(root, "subMethod");
    if (!cJSON_IsString(sub) || sub->valuestring == NULL) {
        sub = cJSON_GetObjectItem(root, "submethod");
    }
    subMethod = cJSON_IsString(sub) ? sub->valuestring : "";

    if (g_pomodoro == NULL) {
        QM_LOGW(LOG_TAG, "not created, ignore %s", subMethod);
        cJSON_Delete(root);
        return;
    }

    if (strcmp(subMethod, "start") == 0) {
        ret = pomodoro_start();
    } else if (strcmp(subMethod, "stop") == 0) {
        ret = pomodoro_stop();
    } else if (strcmp(subMethod, "pause") == 0) {
        ret = pomodoro_pause();
    } else if (strcmp(subMethod, "resume") == 0) {
        ret = pomodoro_resume();
    } else {
        QM_LOGW(LOG_TAG, "unknown subMethod=%s", subMethod);
        cJSON_Delete(root);
        return;
    }

    if (ret != QM_EOK) {
        QM_LOGW(LOG_TAG, "%s failed ret=%d", subMethod, ret);
    } else {
        QM_LOGI(LOG_TAG, "%s ok", subMethod);
    }
    cJSON_Delete(root);
}

int pomodoro_on_connected(void *iot_handle)
{
    int ret;

    if (iot_handle == NULL) {
        return -QM_EINVAL;
    }
    ret = qm_iot_down_register(iot_handle, "pomodoro",
                               handle_pomodoro_cloud_down, NULL);
    if (ret != QM_EOK) {
        QM_LOGW(LOG_TAG, "down reg failed ret=%d", ret);
        return ret;
    }
    QM_LOGI(LOG_TAG, "down registered: pomodoro");
    return QM_EOK;
}

#if CONFIG_QM_CLI_SUPPORT
static int cli_up_and_run(const char *submethod, int (*run)(void))
{
    int ret;
    int up_ret;

    up_ret = ljyd_method_up("pomodoro", submethod, NULL);
    ret = run();
    qm_cli_printf("pomodoro %s up=%d local=%d\r\n", submethod, up_ret, ret);
    return 0;
}

static void cli_cmd_pomodoro(char *wbuf, int wlen, int argc, char **argv)
{
    (void)wbuf;
    (void)wlen;

    if (argc < 2) {
        qm_cli_printf("usage: pomodoro start|stop|pause|resume\r\n");
        return;
    }
    if (g_pomodoro == NULL) {
        qm_cli_printf("pomodoro: not created\r\n");
        return;
    }
    if (strcmp(argv[1], "start") == 0) {
        (void)cli_up_and_run("start", pomodoro_start);
    } else if (strcmp(argv[1], "stop") == 0) {
        (void)cli_up_and_run("stop", pomodoro_stop);
    } else if (strcmp(argv[1], "pause") == 0) {
        (void)cli_up_and_run("pause", pomodoro_pause);
    } else if (strcmp(argv[1], "resume") == 0) {
        (void)cli_up_and_run("resume", pomodoro_resume);
    } else {
        qm_cli_printf("usage: pomodoro start|stop|pause|resume\r\n");
    }
}

static const struct qm_cli_command s_pomodoro_cli_cmd = {
    .name = "pomodoro",
    .help = "pomodoro start|stop|pause|resume",
    .function = cli_cmd_pomodoro,
};

static int pomodoro_cli_register(void)
{
    return qm_cli_register_command(&s_pomodoro_cli_cmd);
}
#endif
