# 余光 V2.1 · 灯语真机试播、呼吸联动与实际显示回执

适配基线：灵机云 `productKey=11879`、服务 `siid=19`。保留原有 19.1–19.6 和 BLE 冻结报文。

## 1. 灵机云需要单独新增的物模型属性

| 配置 | 值 |
|---|---|
| 所属服务 Key | `suixi` |
| 服务编号 | `19` |
| 属性编号 | **`7`**（必须检查平台最终生成的实际编号） |
| 属性 Key | `LightPreviewCommand` |
| 属性名称 | `灯语试播命令` |
| 类型 | 字符串，最大长度 `128` |
| 权限 | 读写 |
| 语控指令和 VA | 建议留空；该属性仅供 H5 用户主动试播。语音指令由 A 板本地 ASR 解析 |

下行命令示例：

```json
{"v":1,"preset":"meal","nonce":"preview202611010001"}
```

`preset` 只允许 `miss / meal / rest / cheer`；`nonce` 为 8–40 位英文字母、数字或连字符。设备校验后按预设低亮度执行，重复 nonce 不会重复启动。它是**临时试播**，没有心意消息 ID，绝不生成“收到了”回执。

在云平台完成 19.7 注册、重新导出并确认 H5 键确实为 `suixi_LightPreviewCommand`、真实 `piid=7` 之前，保持：

```env
VITE_YG_ENABLE_SIID19=true
VITE_YG_ENABLE_SIID19_LIGHT_PREVIEW=false
```

确认后才将第二项改为 `true`，重新执行面板生产构建。若云平台分配不同的 piid，须同步调整 C 端映射与 A 板 `YG_LIGHT_PREVIEW_PIID`。

**注意：** `contracts/thing_model/siid19_light_preview_extension.json` 是待注册提案，已注册的 `siid19_registered.json` 仍保留六项原始属性，避免把云端尚未创建的字段误标为已注册。

## 2. 本地语音 → 灯带

业务板复用 VB701N/Agent **最终**语音识别事件，异步处理：

- “余光打开灯光” / “关闭灯光” → 本地情感光开关与云影子上报。
- “余光播放想念灯语” / “试播吃饭灯语” / “试播休息灯语” / “播放加油灯语” → 本地受限试播。
- 明确朗读心意的语音意图继续进入 `care.readRequested`；“不要打开”等否定句拒绝执行。

当前仍未实现语音的任意亮度、自由颜色和复杂模式。唤醒词识别、麦克风资源与语音会话必须实机验证；主机 C11 测试只证明本地文本分类正确。

## 3. 呼吸与 WS2812

`yg_breath_led_frame` 使用业务板收到的感知板 BLE 样本，检查在线、采样年龄、呼吸有效标志、置信度。同步阶段使用有效测量频率（可优先采用同步波形）；引导阶段使用 `yg_guidance_period_100ms`，按引导启动时间生成周期性低亮度暖光。输入失效立即退出动态节律。LED 逻辑恢复“主动呼吸引导优先于异步心意与 H5 试播”。

显示最大亮度 16%。H5 使用云端 `10.3` 与 `19.3` 展示**周期近似预览**；云端低频属性不包含真实呼吸相位，不能把网页波形声称为精确同步。

## 4. 亲友文本灯语：真实下发与回执

平台原有 `text-light.mjs` 在提交文本时保存受限 JSON。新增：

- `GET /api/hardware/{deviceId}/pending_single`：一次只预留 **一条消息**，避免业务板只能接受一个 `message_id` 时错误合并。
- `webapp/shared/care-downlink.mjs`：可注入可信厂商方法发送函数，整理出 `care.present` 所需的 `command_id / message_id / device_id / window_ms / light`。云方法发送成功**不代表**设备显示成功。
- 业务板首次 **WS2812 刷新成功**后异步上报 `care.displayed`（包含 `command_id`、`message_id`、真实时间戳）。
- 可信厂商适配器完成厂商侧的设备身份与签名认证后，用**独立密钥**签名请求 `POST /api/bridge/care-displayed`；平台事务校验设备、配对、消息、指令、时间，才更新 `delivered` 和灯效记录。
- GPIO5 的 `care.ack` 与服务器确认 `care.ackCommitted` 维持原有幂等回执流程。

需要在服务端独立设置：

```env
CARE_DISPLAY_BRIDGE_SECRET=<独立生成的至少32字符密钥>
```

**仍缺少**厂商实际 MQTT Topic、鉴权回调和云端设备方法发送实现。`care-downlink.mjs` 是经测试的协议适配核心，需要用实际厂商接口提供 `sendMethod`；此交付没有声称联网运行成功。适配器必须验证云回调中的设备身份、保留命令幂等键，不允许将 A 板的自报设备 ID 直接视作已认证。

目前 `care.displayed` 的运行期指令关联信息尚未在重启时持久化。断网、断电后显示确认的补偿对账与真实云网关重试需要继续联调。

## 5. 本机原位补丁及复验

从含有两个已解压 `siid19_text_light_voice` 工程的父目录运行：

```bash
cd YG_A_Business_Firmware_v2.1
git apply --check ../YG_V21_A_灯语与呼吸闭环_增量.patch
git apply ../YG_V21_A_灯语与呼吸闭环_增量.patch
cd ../YG_C_Platform_Web_v2.1
git apply --check ../YG_V21_C_云桥与面板19_7_增量.patch
git apply ../YG_V21_C_云桥与面板19_7_增量.patch
cd webapp
npm run sync:hosting
npm run check:sync
node --test $(find tests -maxdepth 1 -name '*.test.js' ! -name 'http.test.js' | sort)
```

在 ESP-IDF 5.4.1 环境安装并初始化后才执行 `cd apps && idf.py build`。面板依赖安装齐全后执行 `cd panel && npm run build:prod`。完整 `vue-tsc` 仍有原仓库类型与私有依赖问题，不能据此称全仓类型已通过。
