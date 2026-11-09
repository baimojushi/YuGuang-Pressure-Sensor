#include "wifi_sta.h"
#include "sdkconfig.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include <stdlib.h>
#include <string.h>

static const char *TAG = "yg_wifi";
static EventGroupHandle_t s_events;
#define WIFI_UP BIT0

static void on_wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        /* 打印断开原因码：201=NO_AP_FOUND(扫不到/5GHz) 15=4WAY_HANDSHAKE_TIMEOUT(密码/WPA3)
         * 202=AUTH_FAIL 205=CONNECTION_FAIL；缺这个码就只能盲猜。 */
        const wifi_event_sta_disconnected_t *d = (const wifi_event_sta_disconnected_t *)data;
        xEventGroupClearBits(s_events, WIFI_UP);
        if (d) {
            ESP_LOGW(TAG, "disconnected reason=%d rssi=%d ssid_len=%u; reconnecting",
                     d->reason, d->rssi, (unsigned)d->ssid_len);
        } else {
            ESP_LOGW(TAG, "disconnected (no event data); reconnecting");
        }
        esp_wifi_connect();
    }
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *e = (const ip_event_got_ip_t *)data;
        xEventGroupSetBits(s_events, WIFI_UP);
        if (e) {
            ESP_LOGI(TAG, "LAN ready ip=" IPSTR, IP2STR(&e->ip_info.ip));
        } else {
            ESP_LOGI(TAG, "LAN ready");
        }
    }
}

esp_err_t wifi_sta_start(void)
{
    if (!strcmp(CONFIG_YG_WIFI_SSID, "REPLACE_ME")) {
        ESP_LOGE(TAG, "Configure Wi-Fi under idf.py menuconfig");
        return ESP_ERR_INVALID_ARG;
    }
    s_events = xEventGroupCreate();
    if (!s_events) return ESP_ERR_NO_MEM;
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_wifi_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_wifi_event, NULL));
    wifi_config_t conf = {0};
    strlcpy((char *)conf.sta.ssid, CONFIG_YG_WIFI_SSID, sizeof(conf.sta.ssid));
    strlcpy((char *)conf.sta.password, CONFIG_YG_WIFI_PASSWORD, sizeof(conf.sta.password));
    conf.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &conf));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));

    /* 诊断：主动扫描并列出所有可见 AP（Gate A 观测）。
     * 用于定位 reason=201 NO_AP_FOUND 到底是"射频扫不到"还是"SSID 不匹配"。 */
    {
        wifi_scan_config_t scan_cfg = { .show_hidden = true };
        esp_err_t se = esp_wifi_scan_start(&scan_cfg, true);
        if (se != ESP_OK) {
            ESP_LOGW(TAG, "scan start failed: %s", esp_err_to_name(se));
        } else {
            uint16_t ap_num = 0;
            esp_wifi_scan_get_ap_num(&ap_num);
            wifi_ap_record_t *aps = (ap_num > 0) ? calloc(ap_num, sizeof(*aps)) : NULL;
            if (aps) {
                uint16_t got = ap_num;
                esp_wifi_scan_get_ap_records(&got, aps);
                ESP_LOGW(TAG, "scan: %u APs visible; target ssid_len=%u",
                         (unsigned)got, (unsigned)strlen(CONFIG_YG_WIFI_SSID));
                for (uint16_t i = 0; i < got; i++) {
                    ESP_LOGW(TAG, "  [%u] ssid='%s' rssi=%d auth=%d ch=%u",
                             (unsigned)i, (char *)aps[i].ssid, aps[i].rssi,
                             (int)aps[i].authmode, (unsigned)aps[i].primary);
                }
                free(aps);
            } else {
                ESP_LOGW(TAG, "scan: 0 APs visible");
            }
        }
    }

    return esp_wifi_connect();
}

bool wifi_sta_connected(void)
{
    return s_events && (xEventGroupGetBits(s_events) & WIFI_UP);
}
