idf_component_register(
  SRCS "main.c" "yg_b_ble.c" "yg_b_uart_fallback.c" "yg_iface.c" "yg_fusion.c" "radar_ld6002.cpp"
       "bsp_camera.c" "yolo11_pose.cpp" "pose_runtime_b.c"
  INCLUDE_DIRS "."
  REQUIRES bt esp_timer esp_driver_uart esp_driver_gpio esp_driver_pcnt nvs_flash mbedtls
           espressif__esp_video espressif__esp_cam_sensor espressif__esp_sccb_intf
           espressif__esp_new_jpeg coco_pose
)
