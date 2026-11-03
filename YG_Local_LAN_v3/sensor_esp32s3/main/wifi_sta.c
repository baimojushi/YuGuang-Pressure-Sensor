#include "wifi_sta.h"
#include "sdkconfig.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include <string.h>

static const char *TAG = "yg_wifi";
static EventGroupHandle_t s_events;
#define WIFI_UP BIT0

static void on_wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg; (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        xEventGroupClearBits(s_events, WIFI_UP);
        esp_wifi_connect();
        ESP_LOGW(TAG, "LAN disconnected; reconnecting");
    }
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(s_events, WIFI_UP);
        ESP_LOGI(TAG, "LAN ready");
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
    return esp_wifi_connect();
}

bool wifi_sta_connected(void)
{
    return s_events && (xEventGroupGetBits(s_events) & WIFI_UP);
}
