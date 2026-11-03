#include "radar_link.h"

#include "radar_ld6002.h"
#include "qm_log.h"
#include "qm_cli.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <string.h>
#include <stdio.h>

#define LOG_TAG "radar"
#define RADAR_STATUS_INTERVAL_MS 1000
#define RADAR_STATUS_TASK_STACK  4096
#define RADAR_STATUS_TASK_PRIO   3

static const char *kRadarFmt =
    "ready=%d gpio=%d baud=%u q=%s human=%d br=%.2f hr=%.2f range=%.0f conf=%.2f amp=%.3f "
    "cv=%.3f score=%.2f lag=%.0f n=%u frames=%u brf=%u bad=%u rx=%u filt_us=%u last_ms=%u";

static int format_snapshot(char *buf, size_t len)
{
    radar_snapshot_t s = {0};
    radar_ld6002_snapshot(&s);
    return snprintf(buf, len, kRadarFmt,
                    s.ready ? 1 : 0, s.rx_gpio, (unsigned)s.baud,
                    s.q[0] ? s.q : "not_started", s.human,
                    (double)s.br, (double)s.heart, (double)s.range,
                    (double)s.conf, (double)s.amp,
                    (double)s.cv, (double)s.score, (double)s.lag,
                    (unsigned)s.samples_in_filter, (unsigned)s.phase_frames,
                    (unsigned)s.breath_frames,
                    (unsigned)s.crc_errors, (unsigned)s.rx_bytes,
                    (unsigned)s.max_filter_us, (unsigned)s.last_phase_ms);
}

static void radar_status_task(void *arg)
{
    (void)arg;
    char line[256];
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(RADAR_STATUS_INTERVAL_MS));
        format_snapshot(line, sizeof(line));
        QM_LOGI(LOG_TAG, "%s", line);
    }
}

static void cli_cmd_radar(char *wbuf, int wlen, int argc, char **argv)
{
    (void)wbuf;
    (void)wlen;

    if (argc >= 2 && strcmp(argv[1], "dump") == 0) {
        radar_ld6002_hex_dump();
        qm_cli_printf("radar hex dump -> log\r\n");
        return;
    }

    if (argc >= 2 && strcmp(argv[1], "status") != 0) {
        qm_cli_printf("usage: radar [status|dump]\r\n");
        return;
    }

    char line[256];
    format_snapshot(line, sizeof(line));
    qm_cli_printf("radar %s\r\n", line);
}

static const struct qm_cli_command s_radar_cli_cmd = {
    .name = "radar",
    .help = "radar [status] - LD6002 phase/respiration telemetry",
    .function = cli_cmd_radar,
};

esp_err_t radar_link_init(void)
{
    esp_err_t err = radar_ld6002_start();
    if (err != ESP_OK) {
        QM_LOGE(LOG_TAG, "start fail rx=gpio%d baud=1382400 err=%d",
                RADAR_RX_GPIO, (int)err);
        return err;
    }

    if (xTaskCreate(radar_status_task, "radar_status",
                    RADAR_STATUS_TASK_STACK, NULL,
                    RADAR_STATUS_TASK_PRIO, NULL) != pdPASS) {
        QM_LOGE(LOG_TAG, "status task create fail");
    }

    (void)qm_cli_register_command(&s_radar_cli_cmd);

    QM_LOGI(LOG_TAG, "init ok uart2 rx=gpio%d baud=1382400", RADAR_RX_GPIO);
    return ESP_OK;
}
