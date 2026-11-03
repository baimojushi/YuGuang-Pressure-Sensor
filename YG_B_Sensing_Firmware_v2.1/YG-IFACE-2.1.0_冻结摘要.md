# 余光 V2.1 冻结接口（YG-IFACE-2.1.0）

> 本文件是 2026-10-31 历史会话中冻结协议的固件实施摘要。字段、字节偏移、UUID 和权限以冻结契约为准。

## 双 ESP32-S3 角色

- A（业务板）：BLE Central、VB701N 语音接口、WS2812、GPIO5 高电平红外、灵机云 MQTT；雷达不在 A 上运行。
- B（感知板）：BLE Peripheral、LD6002 雷达、v8 滤波、校准后本地三维负荷融合；不得发送原始波形、姿态关键点及压力分值到云端。
- 两板仅用加密 BLE GATT 通信；本版采用有配对窗口的 Just Works 绑定，缺少抗中间人认证，产品化前必须增加设备身份校验。

## 服务与特征

| 功能 | UUID 结尾 | 数据长度 | 方向 |
| --- | --- | --- | --- |
| 自定义服务 | `00000001` | — | — |
| Breath Stream | `00000002` | 20 B | B → A Notify |
| Pressure Event | `00000003` | 20 B | B → A Notify |
| Sensor Status | `00000004` | 20 B | B → A Read/Notify |
| Control | `00000005` | 8 B | A → B Write |
| Event ACK | `00000006` | 8 B | A → B Write |

UUID 前缀：`e78f0d10-44c0-47c5-9ae8-b051`。均使用小端整数。

**Breath（20 B）**：`version:u8@0, flags:u8@1, seq:u16@2, uptime_ms:u32@4, wave_q15:i16@8, bpm_x10:u16@10, stage:u8@12, confidence:u8@13, progress_permille:u16@14, age_ms:u16@16, reserved:u16@18`。方向未经验证时 `stage=0`、`progress=65535`；发送 5–10 Hz；超过 1500 ms 不参与同步，持续 3000 ms 失效退出引导。

**Pressure（20 B）**：`version:u8@0, type=1:u8@1, event_id:u32@2, seq:u16@6, uptime_ms:u32@8, score_x10:u16@12, conf:u8@14, flags:u8@15, ttl_ms:u16@16, reserved:u16@18`。10 s TTL，最多重试 5 次，间隔 1 s；业务板按 `设备身份 + boot_id + event_id` 去重并回写 ACK。

**Sensor Status（20 B）**：`version:u8@0, radar:u8@1, pose:u8@2, fusion:u8@3, demo_auth:u8@4, flags:u8@5, boot_id:u32@6, uptime_ms:u32@10, dropped:u16@14, phase_hz_x10:u16@16, reserved:u16@18`。

**Control（8 B）**：`version:u8@0, opcode:u8@1, param:u16@2, command_id:u32@4`。操作码 1 呼吸流、2 状态请求、3 Demo 意向。

**ACK（8 B）**：`version:u8@0, kind=1:u8@1, event_id:u32@2, result:u8@6, reserved:u8@7`。结果 0 接受 / 1 过期 / 2 拒绝。

## 云物模型

保留旧属性 `9.1`（亲友灯光）、`10.2`（专注）、`10.3`（整数呼吸率）、`10.4`（ok/no_signal）。新增 `13.1` 随息开关（rw，默认 true）、`13.2` 引导状态（ro，idle/syncing/guiding/cooldown）、`13.3` 目标周期（ro，100ms 单位）、`13.4` Demo 意向（rw，默认 false）、`13.5` 连接状态（ro，lost/negotiating/connected）、`13.6` 主动放松请求（瞬时写入自清）。

云端 10.3 至少相隔 10 s、变化 ≥0.5 BPM；60 s 保活；无效时及时将 10.4 更新为 no_signal。所有者独享，伴侣端不可读。`13.4` 只是一项意向，B 仍须单独本地授权和合法 API 配置。

## 亲友回执

GPIO5 仅在展示受理中亲友消息灯效的有效窗口处理高电平（去抖）。同一 `message_id` 只生成一个持久化的 UUID 回执事件。上报业务负载为 `schema_version / type=care_ack / event_id / message_id / device_id / source=gpio5_ir / ack_type=received / reply_text=收到了 / occurred_at_ms`。未得到服务端原子提交确认前，不标记完成、不更换事务编号。

## 本版未封闭的边界

姿态/专注负荷需要合法可用的本地模型和真实质量标签；未校准不得产生 `pressure_fall_start`。B 的 Demo HTTPS 客户端需要本地授权入口、有效的 HTTPS 身份配置与脱敏方案；默认禁用。语音 ASR 对应自然语言意图需要基线语音链路支持，目前仅留方法入口。MQTT 到签名 HTTP 回执桥接需要平台侧补齐真实的 SDK/网关映射；不能把应用级方法名字当作厂商已确认接口。
