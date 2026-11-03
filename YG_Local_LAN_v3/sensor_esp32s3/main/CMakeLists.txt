idf_component_register(
    SRCS "app_main.c" "wifi_sta.c" "lan_client.c" "servo_tracking.c"
         "bsp_camera.c" "radar_ld6002.cpp"
    INCLUDE_DIRS "."
    REQUIRES esp_wifi esp_netif esp_event esp_http_client esp_timer
             esp_driver_gpio esp_driver_uart esp_driver_ledc esp_driver_pcnt
             nvs_flash json
             espressif__esp_video espressif__esp_cam_sensor
             espressif__esp_sccb_intf espressif__esp_new_jpeg
)
