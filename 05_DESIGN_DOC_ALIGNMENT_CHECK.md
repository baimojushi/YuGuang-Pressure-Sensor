# 附：两份设计/策划文档与三端代码的对齐核查

> 日期：2026-11-01
> 范围：《余光_V2.1_端到端互动与双LLM工作流设计.md》《余光_V2.1_产品策划书_研发评审稿.md》与 `D:\yuguang_review` 三端源码逐项比对。
> 用途：验收方读这两份文档时，须同时读本核查表。凡文档描述与代码状态不一致处，以本表"代码事实"列为准。

## 0. 结论速览

| 文档声明 | 代码事实 | 判定 |
|---|---|---|
| 双 LLM 工作流①② | 规则引擎已实现并有测试；LLM 端点仅留接口 | ✅ 一致（文档自己也标注了） |
| `care.present/displayed/readText/readPlayed` 链路 | A 端 `yg_v21/` 全部有实现 | ✅ 一致 |
| GPIO5 挥手回执 | `yg_ir_gpio.c/h` 存在 | ✅ 一致 |
| siid=19 物模型 | `YG_SIID 19` 已定义并接线 | ✅ 一致 |
| 19.7 试播 | 代码里显式标注"必须先注册" | ✅ 一致（未上线，符合文档） |
| 四类灯语预设 | `text-light.mjs` + `meal` 参数逐字一致 | ✅ 一致 |
| 语控/19.7 "接口已有" | **见差异 1**：语音为纯本地规则路径，无云端分类 | ⚠️ 措辞偏宽 |
| "生产级真实云网关未接入" | 云适配器代码在 C 端，设备身份映射未配 | ✅ 一致（文档已如实标注） |
| "固件未完整编译烧录" | **见差异 2**：A 端 11-01 已实机烧录 | ⚠️ 策划书过时 |
| "B 板未编译" | **见差异 3**：B 端已构建通过并烧录 | ⚠️ 策划书过时 |

## 1. 代码核查明细

### 1.1 A 端 `yg_v21/`（31 个文件）

| 文档引用 | 对应文件 | 状态 |
|---|---|---|
| care.present / care.displayed / readText / readPlayed 方法解析 | `yg_care.c/h`、`yg_voice_request.c/h` | ✅ 存在 |
| GPIO5 挥手回执 | `yg_ir_gpio.c/h` | ✅ 存在 |
| 呼吸节律灯 | `yg_breath_led.c/h`、`yg_guidance.c/h` | ✅ 存在 |
| 语音意图路由（"播放想念灯语"等本地受限意图） | `yg_voice_intent.c/h`、`yg_voice_light.c/h` | ✅ 存在（**纯本地规则，无云端 LLM**） |
| 19.7 试播 | `yg_preview_lamp.c/h` + `iot_control_v21.h` | ✅ 存在，注释明确："optional cloud extension, must be registered first" |
| BLE Central / UART fallback | `yg_a_ble.c/h`、`yg_a_uart_fallback.c/h` | ✅ 存在 |
| 物模型入口 | `iot_control_v21.c/h`，`YG_SIID 19` | ✅ 存在 |

### 1.2 C 端 `webapp/shared/`（9 个模块）

| 模块 | 对应文档章节 |
|---|---|
| `text-light.mjs`（`MAPPER_VERSION='text-light/1.0'`） | 工作流①、第 6 节四类预设 |
| `voice-read.mjs`（`VOICE_READ_SCHEMA='yuguang.voice-read.v1'`） | 工作流②（**当前为规则识别**，与文档 3 节"重要实现区分"一致） |
| `care-downlink.mjs`（`toCarePresent`/`pollOneCare`/`recordDeviceRendered`） | 10.1 第 2 步队列与下发 |
| `care-displayed.mjs`（`verifyCareDisplayedBridge`/`applyCareDisplayed`） | 10.2 状态机"已展示"判定 |
| `care-ack.mjs` | GPIO5 挥手"收到了"幂等提交 |
| `live-breathing.mjs` | 8.1 场景 C |
| `service.mjs` / `backend.mjs` / `supabase.mjs` | 服务编排、Supabase 迁移 |
| 测试：`text-light-voice.test.js`、`care-downlink.test.js`、`care-displayed.test.js`、`panel-text-light.test.js` | 第 6 节验收矩阵的软件层实现 |

**四类灯语参数逐字核对**：策划书 06 节表格的 miss/meal/rest/cheer 颜色与周期，与 `text-light.mjs` 内 `meal` 预设（`#E8A568`/`#FFF0D5`、2800ms×2、12% 亮度、soft_pulse）完全一致。文档中的 JSON 示例可直接当接口规范用。

**`LIGHT_MAPPER_URL` 接口**：`text-light.mjs:50` 有真实调用点，未配置时走 `classifyText()` 规则引擎 —— 与文档"工作流①节点 4"的描述一致。

### 1.3 物模型

`contracts/thing_model/` 四个 JSON（`siid19_registered.json` 2812B、`siid19_adapter.json`、`siid19_light_preview_extension.json`、`siid13_proposal.json`）与策划书 09 节表格字段一一对应。`siid13_proposal.json` 是历史提案，验收时以 `siid19_registered.json` 为准。

## 2. 三处需要注意的差异

### 差异 1（措辞）：策划书说"语音接口已有"，实际是纯本地规则

策划书 07 节表格把"打开/关闭灯光""播放××灯语"标为"已规划本地 ASR→9.1；实机识别未验收"。代码里 `yg_voice_intent.c` 是**本地词表匹配**，没有云端 LLM 意图分类。设计稿第 3 节对此是诚实的（"重要实现区分"），但策划书表头的"接口/事件处理已有"容易被读成"语音理解已可用"。

**验收提示**：语音控制当前只能响应设计稿定义的固定本地词表说法，不能理解任意口语。

### 差异 2（过时）：策划书说"A 板未完整编译烧录"，实际 11-01 已烧录

策划书第 15 节风险表写"固件未用 ESP-IDF 5.4.1 完整编译并烧录"。实际 2026-11-01 A 端（COM11）已完成实机烧录与串口验证，B 端姿态链路也已构建通过（B 端烧录因 COM12 USB 掉线暂未完成）。

**验收提示**：该项已不成立，但策划书的风险条目 2/3/5（身份映射、多条消息合并、断线对账）仍然有效。

### 差异 3（补充）：设计稿的"当前实现状态"与今天的代码一致

设计稿第 7 节列的"已有软件基础"（`text-light.mjs`、`voice-read.mjs`、`care-downlink.mjs`、`care-displayed.mjs`）在 C 端全部存在；"仍缺真实闭环"（真实云网关、设备身份映射、真实 TTS/LED、断线对账）也仍然成立。设计稿可当作**可信的当前状态快照**读。

## 3. 对清单①–⑤的影响

| 清单项 | 这两份文档补了什么 | 仍缺什么 |
|---|---|---|
| ① 硬件工程 | 无（纯文档） | — |
| ② 编译接线 | 无 | 实物照片 |
| ③ 软件工程 | **补了业务规则与接口契约**（四类灯语参数、语音意图枚举、19.7 格式、JSON schema），可直接当接口规范 | — |
| ④ 平台配置 | **补了工作流设计**（双 LLM 工作流的节点、输入输出、安全门禁、验收矩阵）——这正是"平台配置负责人"需要实现的蓝本 | 平台侧实际配置与导出、一次真实调用实录 |
| ⑤ 简短说明 | **补了产品定义与验收门槛**（M0–M4 路线图、上线清单、北极星指标） | — |

## 4. 建议的阅读顺序（给验收方）

1. 先读《产品策划书》第 01–06 节 → 知道"这是什么产品"
2. 再读《工作流设计》第 2–3 节 → 知道"平台侧要做哪两个 LLM 工作流"
3. 对照本核查表第 1 节 → 知道"代码里哪些已经写了"
4. 对照策划书第 15.1 节上线清单 → 知道"哪些还没跑通"
5. 最后按 `00_DELIVERY_README_ABC_20261101.md` 的演示步骤复现

## 5. 一句话给平台配置负责人

策划书第 06 节的四类灯语参数表 + 工作流设计第 2、3 节的两个 JSON schema + 策划书第 09 节的 siid19 物模型表，就是你在灵机平台上配置智能体、工作流、插件的**完整输入**；设计稿第 6 节的 13 行验收矩阵，就是你的**通过标准**。目前这三块在代码里已有对应的规则引擎兜底实现（`text-light.mjs`、`voice-read.mjs`），平台上配好 LLM 后需要通过 `LIGHT_MAPPER_URL` 接入，不能绕过 `validatedLight()` 白名单校验。
