#include "wake_word.h"

#include "qm_log.h"
#include "esp_afe_sr_iface.h"
#include "esp_afe_sr_models.h"
#include "esp_afe_config.h"
#include "esp_wn_iface.h"
#include "model_path.h"
#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/task.h"

#include <string.h>

#define LOG_TAG "wake_word"

#define WW_TASK_STACK   (6 * 1024)
#define WW_TASK_PRIO    4
#define WW_ACC_MAX      4096   /* samples */

static const esp_afe_sr_iface_t *s_afe;
static esp_afe_sr_data_t *s_afe_data;
static afe_config_t *s_cfg;
static srmodel_list_t *s_models;
static int s_chunk;
static int16_t s_acc[WW_ACC_MAX];
static int s_acc_n;
static volatile uint32_t s_wake_count;
static wake_word_cb_t s_cb;

/* 由 VB701N 麦克风路径经弱符号调用：16 kHz / 单声道 / S16 原始 PCM */
void qm_audio_local_wake_feed(const uint8_t *pcm, uint16_t len)
{
    if (s_afe == NULL || s_afe_data == NULL || s_chunk <= 0 || s_chunk > WW_ACC_MAX) {
        return;
    }
    if (pcm == NULL || len < 2) {
        return;
    }

    const int16_t *src = (const int16_t *)pcm;
    int n = (int)(len / 2);

    while (n > 0) {
        int space = s_chunk - s_acc_n;
        int take = (n < space) ? n : space;
        memcpy(&s_acc[s_acc_n], src, (size_t)take * sizeof(int16_t));
        s_acc_n += take;
        src += take;
        n -= take;
        if (s_acc_n >= s_chunk) {
            s_afe->feed(s_afe_data, s_acc);
            s_acc_n = 0;
        }
    }
}

static void fetch_task(void *arg)
{
    (void)arg;
    for (;;) {
        afe_fetch_result_t *res = s_afe->fetch(s_afe_data);
        if (res == NULL || res->ret_value == -1) {
            vTaskDelay(pdMS_TO_TICKS(5));
            continue;
        }
        if (res->wakeup_state == WAKENET_DETECTED) {
            s_wake_count++;
            QM_LOGI(LOG_TAG, "WAKE word=%d count=%u",
                    res->wake_word_index, (unsigned)s_wake_count);
            if (s_cb != NULL) {
                s_cb(res->wake_word_index);
            }
        }
    }
}

esp_err_t wake_word_init(void)
{
    if (s_afe_data != NULL) {
        return ESP_OK;
    }

    s_models = esp_srmodel_init("model");
    if (s_models == NULL) {
        QM_LOGE(LOG_TAG, "srmodel init failed (model partition empty?)");
        return ESP_FAIL;
    }

    char *wn = esp_srmodel_filter(s_models, ESP_WN_PREFIX, NULL);
    if (wn == NULL) {
        QM_LOGE(LOG_TAG, "no wakenet model in srmodels.bin");
        return ESP_ERR_NOT_FOUND;
    }
    QM_LOGI(LOG_TAG, "wakenet model=%s", wn);

    /* "M" = 单麦克风输入。低功耗模式给姿态推理留出内部 RAM。 */
    s_cfg = afe_config_init("M", s_models, AFE_TYPE_SR, AFE_MODE_LOW_COST);
    if (s_cfg == NULL) {
        QM_LOGE(LOG_TAG, "afe_config_init failed");
        return ESP_FAIL;
    }
    s_cfg->wakenet_model_name = wn;

    s_afe = esp_afe_handle_from_config(s_cfg);
    if (s_afe == NULL) {
        QM_LOGE(LOG_TAG, "afe handle lookup failed");
        return ESP_FAIL;
    }

    s_afe_data = s_afe->create_from_config(s_cfg);
    if (s_afe_data == NULL) {
        QM_LOGE(LOG_TAG, "afe create failed (not enough internal RAM?)");
        return ESP_ERR_NO_MEM;
    }

    s_chunk = s_afe->get_feed_chunksize(s_afe_data);
    if (s_chunk <= 0 || s_chunk > WW_ACC_MAX) {
        QM_LOGE(LOG_TAG, "unexpected chunksize=%d", s_chunk);
        return ESP_ERR_INVALID_STATE;
    }
    QM_LOGI(LOG_TAG, "afe ready chunksize=%d samples rate=%d",
            s_chunk, s_afe->get_samp_rate(s_afe_data));

    if (xTaskCreateWithCaps(fetch_task, "ww_fetch", WW_TASK_STACK, NULL,
                            WW_TASK_PRIO, NULL,
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
        QM_LOGE(LOG_TAG, "fetch task create failed");
        return ESP_ERR_NO_MEM;
    }

    QM_LOGI(LOG_TAG, "init ok, waiting for mic pcm");
    return ESP_OK;
}

void wake_word_set_cb(wake_word_cb_t cb)
{
    s_cb = cb;
}

uint32_t wake_word_count(void)
{
    return s_wake_count;
}
