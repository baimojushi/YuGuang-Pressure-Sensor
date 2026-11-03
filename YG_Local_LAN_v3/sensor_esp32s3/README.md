# XJWB03 ESP32-S3 局域网传感固件

基于原 B 板相机和雷达驱动构建的全新独立 ESP-IDF 5.4.1 工程。删掉了 BLE GATT、端侧 YOLO11 ESP-DL、A 板 MQTT / 云端 PIDs / agent 业务；保留 BF3901 SPI/UYVY、LD6002 雷达 v8、GPIO48 SG90，增加本地 Wi-Fi HTTP 上传与闭环 servo ACK。完整烧录说明见 `../README.md`。

**`components/` 是原用户工程随包提供的 Espressif 驱动副本**，没有重新下载。这里保留了可能被 esp_video 使用的 `usb_host_uvc` 与 `esp_new_jpeg` 组件，尽管应用层只启用 SPI 摄像头。源码未实机编译验证；在当地配置 IDF 5.4.1 后执行 `idf.py build` 检查。

注意 Kconfig 中 `YG_SERVER_URL` 必须是可信 LAN 地址 `http://PC_IP:8000/v1/ingest`；HTTP 不含 TLS，切勿直接做公网端口映射。`sdkconfig` 文件中的 SSID/密码/token 是私密信息。
