# 业务板 A：文本灯语与主动朗读（服务 19）

本增量保留 GPIO5 单次回执安全窗口，新增 `care.present.light` JSON 与 `care.readText` 朗读任务。系统优先级仍为用户关闭/睡眠安全 > 专注 > 主动恢复 > 异步亲友消息。灯效参数由平台保存的受限快照下发。

## 主要源码

- `cloud/ljyd_method.c`：接收 `care.present`，严格校验 `schema=yuguang.light.v1`、颜色数组、节奏、周期、亮度 ≤ 18%、`sound=false`、`vibration=false`、`autoFade=true`；接收 `care.readText` 后创建单次播放后台任务，结果通过 `care.readPlayed` 上报。
- `yg_v21/yg_care.*`：运行期存储本条消息的灯效快照并按阶段生成 RGB；渲染成功才能允许 GPIO5 确认。
- `peripheral/led_status.c`：调用 `yg_care_render_rgb` 刷新 WS2812，保持其他灯效优先级。
- `agent/agent_app.c` + `yg_v21/yg_voice_intent.*`：仅在最终 ASR 匹配明确朗读意图时上报。
- `yg_v21/yg_voice_request.*`：使用 FreeRTOS 队列异步上报 `care.readRequested`，不在音频事件回调中阻塞网络。
- `qm_config/qm_config.h`：打开 `CONFIG_LJYD_VOICE_CONVERSATION_ENABLE=1`，关闭 MQTT 原文调试输出。

## 主机测试

```bash
gcc -std=c11 -Wall -Wextra -Werror \
  -Iapps/main/yg_v21 apps/main/yg_v21/yg_voice_intent.c \
  apps/main/yg_v21/tests/test_voice_intent.c -o /tmp/yuguang_voice_intent
/tmp/yuguang_voice_intent
```

## 云桥上下行语义

1. `care.present`：`params:{message_id,device_id,window_ms,light}`，其中 `window_ms` 至少覆盖 `light.durationMs`。
2. `care.readRequested`：设备只发送最终 ASR 原文和来源标识；云桥根据厂商验证的设备身份生成安全随机 `event_id`、服务器 `occurred_at_ms`，不得信任客户端自己声明的身份。
3. `care.readText`：仅处理经过可信适配器授权的 `request_id`、`message_id`、`device_id` 和 `text`（必须带“你收到的消息是：”前缀）；本地重复 request_id 拒绝重复播放。
4. `care.readPlayed`：播放确实完成后上报 `played`；失败上报 `failed`，端侧不保留消息文本。

**限制**：当前环境没有 IDF Xtensa 交叉编译器和设备；尚未验证 `CONFIG_LJYD_VOICE_CONVERSATION_ENABLE=1` 与 BLE、语音、内存资源同时运行。正式部署需要厂商 MQTT 适配器与音频端到端测试。语音匹配器不应取代语音识别模型或用户授权。
