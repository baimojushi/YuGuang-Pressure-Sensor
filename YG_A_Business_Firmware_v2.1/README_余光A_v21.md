# 余光 V2.1 · 业务板 A 固件

**工程**：`apps/`，ESP32-S3 / ESP-IDF 5.4.1 / QUMIOS。基于用户上传的 `ljyd_xjwb03_agent_public_developer.zip` 的 `apps/main` 增量修改。

## 已修改功能

- 保留原厂 VB701N 驱动、QUMIOS 蓝牙配网及灵机云 MQTT；雷达 `radar_ld6002.cpp` 从 A 的 CMake 编译列表移除。
- 新增 `main/yg_v21/`：冻结 BLE 协议、GATT Central、有时限的本地配对、NVS 绑定 B 地址、报文校验、Event ACK、呼吸引导状态机、六项物模型适配、GPIO5 IR、NVS 持续回执及服务端确认。
- WS2812 的随息同步/渐进引导与亲友灯效按本地优先级呈现；原有情感灯光和专注开关保留。
- `10.3` 用有效 BLE 读数按限频更新，`10.4` 无信号状态及时更新；禁止上传原始呼吸波形、压力事件和负荷分值。
- A BLE Central 在云连接时启动，避免与首次配网争用；BLE 再次配网、RAM 水位、配对及多次断连仍需实机验证。

## 关键硬件/配对

| 功能 | 引脚/端口 |
| --- | --- |
| 亲友红外检测高电平 | ESP32-S3 GPIO5，输入下拉；实际传感器电平应为 3.3 V |
| WS2812 | 沿用基线 `peripheral/bsp_ws2812.c` 配置 |
| VB701N | 沿用 `qumios-dev/drivers/VB701N` 的引脚/波特率配置 |
| 感知板 B | 经加密 BLE GATT；首次仅本地串口 CLI 显式打开配对窗口：`ygble pair 120` |

B 端将 GPIO14 下拉 2 秒后打开本地配对窗口。两端需在窗口内配对并核验实际硬件地址。本次方案使用 Just Works（仅加密、无强抗中间人保护）；生产部署前必须增加认证身份校验。

## 构建

1. 使用 ESP-IDF 5.4.1 的完整工具链，激活 `export.sh`；需要 ESP32-S3 Xtensa 交叉编译器。
2. `cd apps && idf.py set-target esp32s3 && idf.py build`。
3. 在受控部署机器上单独配置 `CONFIG_XJIANG_CLOUD_SECERT` 产品密钥。仓库中的占位值故意不包含实际密钥。根据厂商要求配置产品 ID、绑定及 MQTT 凭据。
4. `idf.py -p <串口> flash monitor`，核查内部堆、BLE 配网、云连接、13.1–13.6、10.3/10.4、GPIO5 响应、VB701N 状态。

已有 QUMIOS 工程涉及 `apps/managed_components`、根目录 `qumios-dev`、`components/agora_iot_sdk`。本交付包内保留对应基线。ESP-IDF 官方工具链需在本地安装；未附带产物 `.bin`。

## 验证边界

- 本环境无 `idf.py` 和 `xtensa-esp32s3-elf-gcc`，**无法完成 IDF 整体编译/烧录**。
- VB701N 原厂驱动源保留，当前基线 `CONFIG_LJYD_VOICE_CONVERSATION_ENABLE=0`；未验证启用语音后的运行资源。`voice/intent` 方法支持字符串「我需要放松一下」映射到启动意图，真实 ASR 文本回调仍需适配。
- `care/present`、`care/ack`、`care/ackCommitted` 是现有 `ljyd_method_up()` 包络下的**应用方法约定**。需要结合厂商云网关把 `care/ack` 接入签名 HTTP/Supabase 回执桥，只有服务端确认才提交本地 ACK。
- `13.4` 仅传递 Demo 意向给 B。任何真实上传均必须由 B 另行验证本地授权和 HTTPS 密钥。

详见 `YG-IFACE-2.1.0_冻结摘要.md` 和单独交付的测试报告。
