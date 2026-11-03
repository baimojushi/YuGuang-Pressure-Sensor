# 余光 AB 无加密 BLE 联调模式

2026-11-01：用户接受明文通信及 MAC 冒充风险，授权用于设备联调。

## 当前配置

两个工程的 `main/Kconfig.projbuild` 均定义 `YG_BLE_UNENCRYPTED_DEBUG`，干净配置默认 `n`。本次两端现有 `sdkconfig` 显式设置：

```ini
CONFIG_YG_BLE_UNENCRYPTED_DEBUG=y
```

- A 只连接 B 的 BLE 地址 `68:EE:8F:44:B5:AE`。
- B 只允许 A 的 BLE 地址 `68:EE:8F:44:BD:B6`。
- 两端不主动发起加密、配对或绑定；应用数据不再等待认证成功。
- B 的特征值及 CCCD 使用普通 GATT 读写权限，A 写操作使用 `ESP_GATT_AUTH_REQ_NONE`。
- 全局 SMP 不关闭，NVS、Wi-Fi、已有绑定记录不擦除。
- UUID、帧格式、解析、数据新鲜度、质量标志及事件去重保持原协议。
- 启动打印 `UNENCRYPTED DEBUG`。地址检查不等于密码学身份认证；监听与冒充风险仍存在。

## 恢复安全模式

在**两端**运行 `idf.py menuconfig`，进入 `Yuguang BLE`，关闭 `Allow unencrypted fixed-peer BLE debugging (unsafe)`。确认两端 sdkconfig 中该选项为未设置，再分别构建和烧录应用。

不要只修改 sdkconfig.defaults：现有 sdkconfig 的显式配置优先。

关闭后恢复原 SC_BOND 和加密 GATT 权限，但此前 SMP `0x55` 认证失败的根因尚未修复，不能承诺安全模式可正常配对。

## 验证

静态策略检查：

```cmd
python D:\yuguang_review\YG_A_Business_Firmware_v2.1\tests\test_ble_config.py
python D:\yuguang_review\YG_B_Sensing_Firmware_v2.1\tests\test_ble_authorization.py
```

实机判据：无需 `ygble pair` 或 GPIO14 操作，A 自动发现服务，输出 `status RX valid`，且 `breath RX count` 持续增加。有效协议帧不等于有效呼吸测量：仍必须核对 flags、sample_age、BPM 和置信度，不能伪造缺失传感值。
