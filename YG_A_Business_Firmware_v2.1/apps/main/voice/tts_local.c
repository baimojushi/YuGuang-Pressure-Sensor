#include "tts_local.h"

#include <string.h>

#include "opus.h"
#include "qm.h"
#include "qm_log.h"
#include "qm_audio.h"
#include "qm_cli.h"
#include "voice.h"

#include "esp_tts.h"
#include "esp_tts_voice_xiaole.h"

#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

#define LOG_TAG "tts_local"

#define TTS_RATE_HZ        (16000)
#define TTS_FRAME_SAMP     (320)   /* 20 ms */
#define TTS_OPUS_MAX       (512)
#define TTS_TEXT_MAX       (128)
#define TTS_QUEUE_LEN      (3)

/* opus_encode 内部有 alloca，栈从 PSRAM 拿，和 boot_sound 一致 */
#define TTS_TASK_STACK     (30 * 1024)
#define TTS_TASK_PRIO      (5)

#define TTS_ACQUIRE_MS     (800)
#define TTS_ACQUIRE_RETRY  (4)
#define TTS_ACQUIRE_GAP_MS (250)
#define TTS_WRITE_MS       (1000)
#define TTS_DRAIN_MS       (3000)
#define TTS_SPEED          (0)

static esp_tts_voice_t *s_voice;
static esp_tts_handle_t s_tts;
static QueueHandle_t s_q;
static TaskHandle_t s_task;

static int16_t s_frame[TTS_FRAME_SAMP];
static int s_frame_n;

static esp_err_t tts_ensure(void)
{
    if (s_tts != NULL) {
        return ESP_OK;
    }
    s_voice = esp_tts_voice_set_init(&esp_tts_voice_xiaole, NULL);
    if (s_voice == NULL) {
        QM_LOGE(LOG_TAG, "voice set init failed");
        return ESP_FAIL;
    }
    s_tts = esp_tts_create(s_voice);
    if (s_tts == NULL) {
        QM_LOGE(LOG_TAG, "esp_tts_create failed");
        return ESP_FAIL;
    }
    QM_LOGI(LOG_TAG, "tts engine ready");
    return ESP_OK;
}

static int encode_and_write(OpusEncoder *enc, qm_audio_control_t *control,
                            qm_audio_operation_id_t op)
{
    uint8_t packet[TTS_OPUS_MAX];
    qm_audio_data_t data;
    int n = opus_encode(enc, s_frame, TTS_FRAME_SAMP, packet, sizeof(packet));

    if (n <= 0) {
        return n;
    }
    memset(&data, 0, sizeof(data));
    data.data = packet;
    data.size = (uint32_t)n;
    data.duration_ms = 20;
    data.flags = QM_AUDIO_DATA_DURATION_VALID;
    return qm_audio_control_stream_write_packet(control, op, &data, TTS_WRITE_MS);
}

static void tts_speak_once(const char *text)
{
    qm_audio_control_t *control = NULL;
    qm_audio_control_play_request_t req;
    qm_audio_operation_id_t operation = 0;
    OpusEncoder *enc = NULL;
    int err = 0;
    int ret;
    int attempt;
    uint32_t written = 0;

    if (!voice_audio_ready()) {
        QM_LOGW(LOG_TAG, "audio not ready, skip");
        return;
    }
    if (tts_ensure() != ESP_OK) {
        return;
    }

    esp_tts_stream_reset(s_tts);
    if (esp_tts_parse_chinese(s_tts, text) != 0) {
        QM_LOGW(LOG_TAG, "parse failed: %s", text);
        return;
    }

    ret = qm_audio_control_create(&control);
    if (ret != QM_EOK || control == NULL) {
        QM_LOGW(LOG_TAG, "control create failed ret=%d", ret);
        return;
    }

    memset(&req, 0, sizeof(req));
    req.source.type = QM_AUDIO_SOURCE_PUSH;
    req.source.value.push.buffer_bytes = 4096;
    req.codec.codec = QM_AUDIO_CODEC_OPUS;
    req.codec.framing = QM_AUDIO_CODEC_FRAMING_PACKET;
    req.codec.packet_duration_ms = 20;
    req.codec.packet_bytes = 0;
    req.codec.pcm.sample_rate_hz = TTS_RATE_HZ;
    req.codec.pcm.channels = 1;
    req.codec.pcm.sample = QM_AUDIO_PCM_S16;
    req.priority = QM_AUDIO_PRIORITY_HIGH;
    req.admission = QM_AUDIO_ADMISSION_PREEMPT_LOWER;
    req.admission_timeout_ms = TTS_ACQUIRE_MS;

    ret = qm_audio_control_play(control, &req, &operation);
    for (attempt = 1; ret != QM_EOK && attempt < TTS_ACQUIRE_RETRY; attempt++) {
        vTaskDelay(pdMS_TO_TICKS(TTS_ACQUIRE_GAP_MS));
        ret = qm_audio_control_play(control, &req, &operation);
    }
    if (ret != QM_EOK) {
        QM_LOGW(LOG_TAG, "play request failed ret=%d (give up)", ret);
        (void)qm_audio_control_shutdown(control, 1000);
        (void)qm_audio_control_destroy(control);
        return;
    }

    enc = opus_encoder_create(TTS_RATE_HZ, 1, OPUS_APPLICATION_VOIP, &err);
    if (enc == NULL) {
        QM_LOGE(LOG_TAG, "encoder create failed err=%d", err);
        (void)qm_audio_control_release(control, operation, 1000);
        (void)qm_audio_control_shutdown(control, 1000);
        (void)qm_audio_control_destroy(control);
        return;
    }

    s_frame_n = 0;
    for (;;) {
        int len = 0;
        short *pcm = esp_tts_stream_play(s_tts, &len, TTS_SPEED);
        int off = 0;

        if (pcm == NULL || len <= 0) {
            break;
        }
        while (off < len) {
            int space = TTS_FRAME_SAMP - s_frame_n;
            int take = (len - off < space) ? (len - off) : space;

            memcpy(&s_frame[s_frame_n], pcm + off, (size_t)take * sizeof(int16_t));
            s_frame_n += take;
            off += take;
            if (s_frame_n >= TTS_FRAME_SAMP) {
                s_frame_n = 0;
                if (encode_and_write(enc, control, operation) != QM_EOK) {
                    goto drain;
                }
                written++;
            }
        }
    }

    /* 末尾不足 20 ms 的尾巴用静音补齐再发一包 */
    if (s_frame_n > 0) {
        memset(&s_frame[s_frame_n], 0,
               (size_t)(TTS_FRAME_SAMP - s_frame_n) * sizeof(int16_t));
        s_frame_n = 0;
        (void)encode_and_write(enc, control, operation);
        written++;
    }

drain:
    ret = qm_audio_control_stream_finish(control, operation);
    if (ret == QM_EOK) {
        ret = qm_audio_control_wait(control, operation, TTS_DRAIN_MS);
    }
    QM_LOGI(LOG_TAG, "speak done ret=%d frames=%u text=%s",
            ret, (unsigned)written, text);

    opus_encoder_destroy(enc);
    (void)qm_audio_control_release(control, operation, 1000);
    (void)qm_audio_control_shutdown(control, 1000);
    (void)qm_audio_control_destroy(control);
}

static void tts_task(void *arg)
{
    (void)arg;
    for (;;) {
        char *text = NULL;

        if (xQueueReceive(s_q, &text, portMAX_DELAY) != pdTRUE || text == NULL) {
            continue;
        }
        tts_speak_once(text);
        heap_caps_free(text);
    }
}

static void cli_cmd_tts(char *wbuf, int wlen, int argc, char **argv)
{
    char text[TTS_TEXT_MAX];
    int off = 0;

    (void)wbuf;
    (void)wlen;

    if (argc < 2) {
        qm_cli_printf("usage: tts <中文文本>\r\n");
        return;
    }
    for (int i = 1; i < argc && off < (int)sizeof(text) - 1; ++i) {
        off += snprintf(text + off, sizeof(text) - off, "%s%s",
                        (i > 1) ? " " : "", argv[i]);
    }
    if (tts_local_speak(text) == ESP_OK) {
        qm_cli_printf("tts queued: %s\r\n", text);
    } else {
        qm_cli_printf("tts queue full\r\n");
    }
}

static const struct qm_cli_command s_tts_cli_cmd = {
    .name = "tts",
    .help = "tts <text> - offline Chinese TTS playback",
    .function = cli_cmd_tts,
};

esp_err_t tts_local_init(void)
{
    if (s_task != NULL) {
        return ESP_OK;
    }
    if (s_q == NULL) {
        s_q = xQueueCreate(TTS_QUEUE_LEN, sizeof(char *));
        if (s_q == NULL) {
            QM_LOGE(LOG_TAG, "queue create failed");
            return ESP_ERR_NO_MEM;
        }
    }
    if (xTaskCreateWithCaps(tts_task, "tts_local", TTS_TASK_STACK, NULL,
                            TTS_TASK_PRIO, &s_task,
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
        s_task = NULL;
        QM_LOGE(LOG_TAG, "task create failed");
        return ESP_ERR_NO_MEM;
    }

    (void)qm_cli_register_command(&s_tts_cli_cmd);
    QM_LOGI(LOG_TAG, "init ok (engine loads on first speak)");
    return ESP_OK;
}

esp_err_t tts_local_speak(const char *text)
{
    char *copy;
    size_t len;

    if (s_q == NULL || text == NULL || text[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }
    len = strlen(text);
    if (len >= TTS_TEXT_MAX) {
        len = TTS_TEXT_MAX - 1;
    }
    copy = heap_caps_malloc(len + 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (copy == NULL) {
        return ESP_ERR_NO_MEM;
    }
    memcpy(copy, text, len);
    copy[len] = '\0';

    if (xQueueSend(s_q, &copy, 0) != pdTRUE) {
        heap_caps_free(copy);
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}
