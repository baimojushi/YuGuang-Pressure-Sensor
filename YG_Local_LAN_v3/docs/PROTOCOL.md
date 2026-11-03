# YG Local LAN v1 二进制通信协议（仅局域网）

## 设备上传

`POST http://<PC_LAN_IP>:8000/v1/ingest`

Headers:
- `Content-Type: application/octet-stream`
- `X-Device-Token: <same secret as PC env>`

Body:

| Offset | Length | Format | Purpose |
|---:|---:|---|---|
| 0 | 4 | ASCII | `YG01` |
| 4 | 4 | uint32 little-endian | JSON metadata byte count |
| 8 | 4 | uint32 little-endian | UYVY raw image byte count |
| 12 | metadata bytes | UTF8 JSON | below |
| 12 + meta bytes | raw bytes | UYVY 4:2:2 | 240×320×2 = 153600 bytes |

Example metadata (**only an example, not a measured trace**):

```json
{
  "device_id": "sensor01",
  "boot_id": 34671,
  "frame_seq": 251,
  "frame_timestamp_us": 125001234,
  "width": 240,
  "height": 320,
  "pixel_format": "UYVY422",
  "servo_angle_deg": 92,
  "radar": {
    "human": 1,
    "bpm_module": 13.2,
    "confidence": 0.7,
    "cv_device": 0.14,
    "quality": "module",
    "last_phase_ms": 124980,
    "phase_frames": 3042,
    "parser_errors": 0,
    "valid_frames": 3061
  },
  "phase_samples": [
    [3041, 124950000, 0.124],
    [3042, 125000000, 0.120]
  ]
}
```

`phase_samples` 每项为 `[uint32 sample_seq, esp_timer_timestamp_us, raw_phase_float]`。不会从 HTTP 到达时间伪造硬件帧同步。PC 端拒绝错误设备、错误帧长、无效 token 和序列倒退。若网络失败，传感端不会伪造 ACK；相位重试受 512 点环形缓存大小限制。

## PC 应答

每帧响应一个 JSON (HTTPS 未启用，可信 LAN 测试)：

```json
{
  "schema": "yg.local.ack.v1",
  "device_id": "sensor01",
  "boot_id": 34671,
  "frame_seq": 251,
  "pose_status": "ok",
  "report_ready": false,
  "servo": {
    "mode": "track",
    "target_angle_deg": 95,
    "reason": "follow_upper_body",
    "ttl_ms": 1200
  }
}
```

无有效人物 / 模型 / 错帧 / 视场中心死区时下发 `{ "mode": "hold", "reason": "...", "ttl_ms":1200 }`，S3 保持。S3 **必须校验 ACK 的 device_id、boot_id、frame_seq，目标角度与 TTL 都有限幅**；没有有效 ACK 不转动。

## 5 秒报告

PC 每当收到一帧且距上次报告至少 5s 时，在 `reports/sensor01_latest.json` 与 `reports/sensor01.jsonl` 写一个 JSON。请求 `GET /v1/report/sensor01` 并携带相同 token，可取得最新报告。包含 `pose.landmarks_coco17`、`respiration.breath_interval_cv`（若已累计至少 60s 有效相位数据）、`posture_observations`、可选 `eyes`、`fusion_features` 与 `psychological_state`。默认后者为 `unknown`，不能凭姿态直接推断疾病或人的真实意图。
