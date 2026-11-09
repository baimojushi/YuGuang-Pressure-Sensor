#include "lan_client.h"
#include "servo_tracking.h"
#include "sdkconfig.h"
#include "cJSON.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *TAG = "yg_lan";

/* Deliberately accept RFC1918 literal IPv4 only. Prevent accidental upload of
   images to a public URL when this product is configured for a closed LAN. */
static bool rfc1918_http_url(const char *url)
{
    unsigned a, b, c, d;
    int n = 0;
    if (strncmp(url, "http://", 7) != 0 ||
        sscanf(url + 7, "%u.%u.%u.%u%n", &a, &b, &c, &d, &n) != 4 || n <= 0) {
        return false;
    }
    if (a > 255 || b > 255 || c > 255 || d > 255) return false;
    const char delimiter = url[7 + n];
    if (delimiter != ':' && delimiter != '/' && delimiter != '\0') return false;
    return a == 10 || (a == 172 && b >= 16 && b <= 31) ||
           (a == 192 && b == 168);
}

static void u32le(uint8_t *p, uint32_t v)
{
    p[0] = (uint8_t)v;
    p[1] = (uint8_t)(v >> 8);
    p[2] = (uint8_t)(v >> 16);
    p[3] = (uint8_t)(v >> 24);
}

static int write_all(esp_http_client_handle_t c, const char *data, size_t len)
{
    size_t written = 0;
    while (written < len) {
        int n = esp_http_client_write(c, data + written, (int)(len - written));
        if (n <= 0) return -1;
        written += (size_t)n;
    }
    return 0;
}

static char *make_metadata(const yg_packet_t *p)
{
    cJSON *root = cJSON_CreateObject();
    if (!root) return NULL;
    cJSON_AddStringToObject(root, "device_id", CONFIG_YG_DEVICE_ID);
    cJSON_AddNumberToObject(root, "boot_id", p->boot_id);
    cJSON_AddNumberToObject(root, "frame_seq", p->frame_seq);
    cJSON_AddNumberToObject(root, "frame_timestamp_us", (double)p->frame_time_us);
    cJSON_AddNumberToObject(root, "width", p->width);
    cJSON_AddNumberToObject(root, "height", p->height);
    cJSON_AddStringToObject(root, "pixel_format", "UYVY422");
    cJSON_AddNumberToObject(root, "servo_angle_deg", p->servo_angle_deg);

    cJSON *r = cJSON_AddObjectToObject(root, "radar");
    cJSON_AddNumberToObject(r, "human", p->radar.human);
    if (isfinite(p->radar.br)) cJSON_AddNumberToObject(r, "bpm_module", p->radar.br);
    if (isfinite(p->radar.conf)) cJSON_AddNumberToObject(r, "confidence", p->radar.conf);
    if (isfinite(p->radar.cv)) cJSON_AddNumberToObject(r, "cv_device", p->radar.cv);
    cJSON_AddStringToObject(r, "quality", p->radar.q);
    cJSON_AddNumberToObject(r, "last_phase_ms", p->radar.last_phase_ms);
    cJSON_AddNumberToObject(r, "phase_frames", p->radar.phase_frames);
    cJSON_AddNumberToObject(r, "parser_errors", p->radar.crc_errors);
    cJSON_AddNumberToObject(r, "valid_frames", p->radar.valid_frames);

    cJSON *arr = cJSON_AddArrayToObject(root, "phase_samples");
    for (size_t i = 0; i < p->sample_count; ++i) {
        const radar_phase_sample_t *s = &p->samples[i];
        if (!isfinite(s->phase)) continue;
        cJSON *one = cJSON_CreateArray();
        if (!one) break;
        cJSON_AddItemToArray(one, cJSON_CreateNumber(s->seq));
        cJSON_AddItemToArray(one, cJSON_CreateNumber((double)s->timestamp_us));
        cJSON_AddItemToArray(one, cJSON_CreateNumber(s->phase));
        cJSON_AddItemToArray(arr, one);
    }
    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json;
}

esp_err_t lan_client_upload(const yg_packet_t *p)
{
    if (!p || !p->frame || p->frame_len != (size_t)p->width * p->height * 2U) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!rfc1918_http_url(CONFIG_YG_SERVER_URL)) {
        ESP_LOGE(TAG, "URL must be an explicit private IPv4 http:// LAN endpoint");
        return ESP_ERR_INVALID_ARG;
    }
    if (!strcmp(CONFIG_YG_DEVICE_TOKEN, "REPLACE_WITH_RANDOM_TOKEN")) {
        ESP_LOGE(TAG, "Set device token in menuconfig before network upload");
        return ESP_ERR_INVALID_ARG;
    }
    char *json = make_metadata(p);
    if (!json) return ESP_ERR_NO_MEM;
    const size_t meta_len = strlen(json);
    if (meta_len > 30000 || p->frame_len > 1000000) {
        cJSON_free(json);
        return ESP_ERR_INVALID_SIZE;
    }
    uint8_t head[12] = {'Y','G','0','1',0,0,0,0,0,0,0,0};
    u32le(head + 4, (uint32_t)meta_len);
    u32le(head + 8, (uint32_t)p->frame_len);
    esp_http_client_config_t conf = {
        .url = CONFIG_YG_SERVER_URL, .timeout_ms = 10000,
        .keep_alive_enable = true,
    };
    esp_http_client_handle_t client = esp_http_client_init(&conf);
    if (!client) { cJSON_free(json); return ESP_ERR_NO_MEM; }
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/octet-stream");
    esp_http_client_set_header(client, "X-Device-Token", CONFIG_YG_DEVICE_TOKEN);
    const size_t total = sizeof(head) + meta_len + p->frame_len;
    esp_err_t err = esp_http_client_open(client, (int)total);
    if (err == ESP_OK) {
        if (write_all(client, (const char *)head, sizeof(head)) ||
            write_all(client, json, meta_len) ||
            write_all(client, (const char *)p->frame, p->frame_len)) {
            err = ESP_FAIL;
        }
    }
    if (err == ESP_OK) {
        const int64_t header_len = esp_http_client_fetch_headers(client);
        const int status = esp_http_client_get_status_code(client);
        if (header_len < 0 || status != 200) {
            ESP_LOGW(TAG, "server HTTP status=%d header_len=%lld", status, (long long)header_len);
            err = ESP_FAIL;
        } else {
            char reply[2048] = {0};
            int n = esp_http_client_read_response(client, reply, sizeof(reply) - 1);
            bool ack_valid = false;
            if (n > 0 && n < (int)sizeof(reply)) {
                cJSON *obj = cJSON_ParseWithLength(reply, (size_t)n);
                if (obj) {
                    const cJSON *boot = cJSON_GetObjectItemCaseSensitive(obj, "boot_id");
                    const cJSON *seq = cJSON_GetObjectItemCaseSensitive(obj, "frame_seq");
                    const cJSON *dev = cJSON_GetObjectItemCaseSensitive(obj, "device_id");
                    const cJSON *servo = cJSON_GetObjectItemCaseSensitive(obj, "servo");
                    const cJSON *mode = cJSON_GetObjectItemCaseSensitive(servo, "mode");
                    const cJSON *angle = cJSON_GetObjectItemCaseSensitive(servo, "target_angle_deg");
                    const cJSON *ttl = cJSON_GetObjectItemCaseSensitive(servo, "ttl_ms");
                    ack_valid = cJSON_IsNumber(boot) && (uint32_t)boot->valuedouble == p->boot_id &&
                        cJSON_IsNumber(seq) && (uint32_t)seq->valuedouble == p->frame_seq &&
                        cJSON_IsString(dev) && strcmp(dev->valuestring, CONFIG_YG_DEVICE_ID) == 0 &&
                        cJSON_IsString(mode) &&
                        (strcmp(mode->valuestring, "hold") == 0 || strcmp(mode->valuestring, "track") == 0);
                    if (ack_valid && strcmp(mode->valuestring, "track") == 0) {
                        ack_valid = cJSON_IsNumber(angle) && cJSON_IsNumber(ttl) &&
                                    servo_tracking_command((float)angle->valuedouble,
                                                           (unsigned)ttl->valuedouble);
                    } else if (ack_valid && strcmp(mode->valuestring, "hold") == 0) {
                        servo_tracking_hold();
                    }
                    if (ack_valid) ESP_LOGD(TAG, "acked seq=%u mode=%s", (unsigned)p->frame_seq, mode->valuestring);
                    cJSON_Delete(obj);
                }
            }
            if (!ack_valid) {
                ESP_LOGW(TAG, "invalid/stale/missing LAN ACK for seq=%u", (unsigned)p->frame_seq);
                err = ESP_FAIL;
            }
        }
    }
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    cJSON_free(json);
    return err;
}
