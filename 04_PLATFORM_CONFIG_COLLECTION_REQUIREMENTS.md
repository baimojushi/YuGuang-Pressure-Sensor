# 灵机平台配置采集要求

> 适用项目：余光 V2.1
> 目的：让未参与配置的人能够复现智能体行为、核对设备调用链，并在原账号不可用时重建平台配置。
> 本文件只描述平台侧材料要求，不要求泄露账号密码、AccessKey、Token、设备密钥或用户隐私数据。

---

## 总体交付原则

每一项配置至少需要同时回答四个问题：

1. **它是什么**：名称、用途、所属产品/智能体。
2. **现在是什么版本**：版本号、最后修改时间、配置负责人。
3. **具体怎么配置**：可复制的原文、结构化导出或完整截图。
4. **如何证明在用**：一条真实触发记录，能对应到返回结果和设备反馈。

### 优先交付格式

按优先级从高到低：

1. 平台原生导出文件（JSON/YAML/ZIP/CSV）
2. 可复制的配置原文（Markdown/TXT/JSON）
3. 全页面截图 + 文字转录
4. 仅截图（最后选择，必须保证字段完整、清晰、连续）

### 安全与脱敏

必须保留：字段名、URL 主机名、插件名称、参数名、模型名称、版本号、工作流结构、错误码。

必须脱敏：账号密码、AccessKey、SecretKey、Token、设备密钥、个人手机号、用户消息中的隐私内容。

脱敏写法统一：

```text
原字段：SUPABASE_SECRET_KEY
交付值：<REDACTED: server-side secret, configured>
```

不要删除整行，否则接手人不知道该配置项存在。

---

# 1. 智能体提示词

## 1.1 最低必交内容

必须导出或完整抄录以下内容：

| 字段 | 要求 |
|---|---|
| 智能体名称 | 平台中显示的完整名称 |
| 智能体 ID | 平台内部 ID；若无显示，提供智能体编辑页 URL（账号参数脱敏） |
| 所属产品 | 余光对应 PID、产品名称；当前代码使用 PID 11879 时需与平台确认一致 |
| 模型 | 模型厂商、模型名称、模型版本，如有 temperature/top_p/max_tokens 一并记录 |
| System Prompt | **完整原文**，不能只写摘要或“负责冥想引导” |
| 人设/角色设定 | 若平台单独有“人设”“角色”“欢迎语”“开场白”，分别导出 |
| 行为规则 | 禁止事项、隐私规则、设备控制规则、回复格式、语气要求 |
| 工具说明 | 智能体看到的工具名称、功能描述、参数说明、调用限制 |
| 变量 | 提示词中使用的占位符及来源，如 `{{device_name}}`、`{{user_name}}` |
| 上下文设置 | 对话轮数、记忆开关、历史消息长度、系统时间/用户资料是否注入 |
| 最后修改信息 | 修改人、修改时间、版本号或发布批次 |

## 1.2 提示词必须保留的结构

若提示词原文包含以下部分，必须原样保留标题与顺序：

```text
角色 / Role
目标 / Goal
已知设备能力
允许调用的工具
调用工具前的判断规则
安全与隐私边界
回答格式
异常与失败处理
示例对话
```

不能把多段提示词合并成一句总结，因为段落顺序可能影响模型行为。

## 1.3 工具说明需要细到什么程度

每个工具至少记录：

```yaml
tool_name: suixi_device_control
purpose: 控制余光设备属性或动作
availability: production
input_schema:
  siid: integer
  piid: integer
  value: any
required_fields: [siid, piid, value]
examples:
  - intent: 开始呼吸引导
    input: {siid: 19, piid: 2, value: true}
constraints:
  - 不能发送未在物模型注册的 siid/piid
  - 设备离线时必须明确告知失败
```

如果平台只显示自然语言工具描述，应提供完整截图和文字转录。

## 1.4 可接受的截图

若无法导出，至少截图：

1. 智能体基本信息页
2. 模型与推理参数页
3. System Prompt 全文（长内容需连续截图，截图之间保留重叠行）
4. 人设/欢迎语/变量页
5. 工具列表与每个工具详情页
6. 发布版本与更新时间

截图文件名建议：

```text
01_agent_basic.png
02_model_params.png
03_system_prompt_01.png
03_system_prompt_02.png
04_tools_list.png
04_tool_device_control.png
```

## 1.5 验收标准

合格：第三方能根据材料重建一个行为基本一致的智能体，并知道它可以调用哪些设备能力。

不合格示例：

- 只给一句“智能体负责冥想引导”
- 只给聊天截图，不给提示词原文
- 工具只写名称，不写参数
- 隐去整个配置项而不是只脱敏值

---

# 2. 工作流编排

## 2.1 最低必交内容

每个实际启用的工作流分别交付：

| 字段 | 要求 |
|---|---|
| 工作流名称 / ID | 平台显示值 |
| 状态 | 草稿 / 已发布 / 已停用；明确当前线上使用哪个版本 |
| 版本与时间 | 发布版本、最后修改时间、修改人 |
| 入口触发器 | 用户消息、关键词、按钮、定时器、设备事件、Webhook、属性变化等 |
| 输入变量 | 名称、类型、必填、默认值、来源 |
| 节点列表 | 节点 ID、节点类型、用途、输入、输出 |
| 连线关系 | 上游→下游，含条件分支与回退路径 |
| 条件表达式 | 完整表达式，不能只写“如果成功” |
| 外部调用 | URL/插件/工具名、请求方法、参数映射、超时、重试 |
| 输出 | 给用户的文本、设备命令、平台属性更新、回执写入 |
| 异常处理 | 超时、设备离线、参数非法、插件失败、模型无结果时怎么走 |

## 2.2 推荐导出结构

```yaml
workflow_name: 呼吸引导启动
workflow_id: <platform-id>
version: 2026-11-01-v1
status: published
trigger:
  type: user_intent
  examples:
    - 开始呼吸训练
    - 带我呼吸三分钟
inputs:
  duration_sec:
    type: integer
    default: 180
nodes:
  - id: classify_intent
    type: llm
    output: intent
  - id: check_device_online
    type: condition
    expression: device.online == true
  - id: start_guide
    type: device_property_write
    mapping:
      siid: 19
      piid: 2
      value: true
branches:
  - from: check_device_online.true
    to: start_guide
  - from: check_device_online.false
    to: reply_offline
error_policy:
  timeout_ms: 10000
  retries: 1
```

## 2.3 图形工作流截图要求

若平台只能截图：

1. 先截一张完整画布总览
2. 再按左上→右下顺序逐节点放大
3. 每个条件节点必须拍到完整条件表达式
4. 每个插件/设备调用节点必须拍到参数映射
5. 每个分支必须能看清连线去向
6. 同一工作流多个版本时，标注线上版本

不要只拍画布远景，节点文字看不清等于没交。

## 2.4 余光项目应重点核对的工作流

如平台实际存在，至少检查：

- 呼吸引导开始 / 暂停 / 结束
- 设备在线状态判断
- 语音意图→灯光或引导动作
- 亲友消息→灯语预览 / 真机试播
- 显示回执 / 已读回执
- 设备离线、超时、属性写失败的回退
- 定时提醒、闹钟、番茄钟相关流程

不存在的工作流要明确写“未配置”，不要空着。

## 2.5 验收标准

合格：可以从触发器一路追到最终设备动作，并知道每个分支的条件、参数和失败处理。

不合格示例：

- 只有工作流名字，没有节点内容
- 截图看得到节点框，看不到配置
- 条件分支只写“成功/失败”，没有表达式
- 没说明线上究竟使用哪个版本

---

# 3. 插件配置

## 3.1 最低必交内容

每个被智能体或工作流实际引用的插件，逐个记录：

| 字段 | 要求 |
|---|---|
| 插件名称 / ID | 平台完整名称及内部 ID |
| 插件版本 | 当前发布版本 |
| 来源 | 官方、第三方、自建；附链接或仓库地址 |
| 使用位置 | 哪个智能体 / 工作流 / 节点在调用 |
| 能力列表 | 实际使用的 action/API，不必列未使用能力 |
| 请求参数 | 参数名、类型、必填、默认值、枚举值 |
| 参数映射 | 工作流变量 / 模型输出如何映射到插件参数 |
| 返回字段 | 成功与失败响应结构、状态码 |
| 鉴权方式 | API Key/OAuth/签名；**只写方式和变量名，不交真实密钥** |
| 网络信息 | 基础 URL、路径、方法、超时、重试、IP/域名白名单 |
| 权限 | 读/写哪些设备属性、能否触发实体动作 |
| 风险控制 | 设备离线、重复调用、幂等、防重放、限流 |

## 3.2 参数映射必须具体到字段

不合格：

```text
“将用户意图传给设备控制插件”
```

合格：

```yaml
intent_to_property:
  start_breath:
    plugin_action: setProperty
    product_id: 11879
    params:
      siid: 19
      piid: 2
      value: true
  set_period:
    plugin_action: setProperty
    params:
      siid: 19
      piid: 3
      value: "round(period_sec / 0.1)"  # unit=100ms
```

余光项目特别要记录：

- siid 19 的 piid 映射
- `GuidePeriod` 的单位换算（正式注册版为 unit=100ms）
- 19.7 灯语试播的门禁与参数结构
- 云→Web / Web→设备的签名回执变量名
- 设备在线、离线、属性写失败时插件返回什么

## 3.3 鉴权信息怎么交

只交“配置方式”，不交真实值：

```text
Auth type: HMAC-SHA256
Header: X-Yuguang-Signature
Secret source: environment variable CARE_ACK_BRIDGE_SECRET
Secret value: <REDACTED, configured in production>
Rotation owner: 张三
```

如果没有密钥轮换与负责人，也要明确写“未建立”。

## 3.4 验收标准

合格：接手人能用测试凭据复现一次插件调用，并根据返回结构判断成功或失败。

不合格示例：

- 只给插件列表截图
- 没有参数映射
- 把真实 Token 明文发出
- 没写插件被哪个工作流使用

---

# 4. 知识库

## 4.1 最低必交内容

实际挂载到智能体或工作流的每个知识库，提供：

| 字段 | 要求 |
|---|---|
| 知识库名称 / ID | 平台显示值 |
| 用途 | 设备问答、冥想文案、故障排查、产品说明等 |
| 挂载对象 | 哪个智能体 / 哪个工作流节点 |
| 文档清单 | 文件名、版本、日期、页数/大小、来源 |
| 当前生效版本 | 线上用的是哪一版；旧版是否仍在库中 |
| 文档原文件 | PDF/DOCX/MD/TXT 等，必须随交付包或给可靠下载地址 |
| 切片设置 | chunk size、overlap、分段方式（平台可见时） |
| 检索设置 | top_k、相似度阈值、rerank、混合检索等（平台可见时） |
| 更新方式 | 谁上传、多久更新、废弃文档怎么下线 |
| 权限与隐私 | 是否含用户数据、内部资料、版权限制 |

## 4.2 文档清单模板

```csv
kb_name,kb_id,file_name,version,date,source,status,notes
余光产品知识库,<id>,余光项目概念10.29.docx,v1,2026-10-29,项目内部,active,概念与体验目标
余光硬件知识库,<id>,HLK-LD6002协议V1.2.pdf,v1.2,<date>,海凌科官方,active,雷达协议
余光硬件知识库,<id>,旧版雷达协议.pdf,v1.0,<date>,厂商,deprecated,不要继续检索
```

## 4.3 必须区分“本地有”与“平台实际挂载”

本项目目录里已有很多 PDF/DOCX/README，但**本地存在不等于已进入平台知识库**。

交付时必须标明：

- `local-only`：文件在项目目录，平台没上传
- `uploaded-active`：已上传且当前使用
- `uploaded-deprecated`：平台仍有但不应命中
- `unknown`：无法确认，需平台负责人核查

## 4.4 知识库效果证据

每个知识库至少给 1 个真实检索示例：

```text
提问：LD6002 雷达用哪个 GPIO？
命中文档：HLK-LD6002协议V1.2.pdf + B板接线说明
返回摘要：GPIO18，UART2，1382400 baud
是否正确：是
```

若平台能显示引用来源或召回片段，截图必须包含来源文件名。

## 4.5 验收标准

合格：文档原件、版本、挂载关系、检索设置、一次命中证据都能对应起来。

不合格示例：

- 只说“用了产品知识库”
- 只有文件名，没有原文件或版本
- 把本地目录文件全部算成已上传
- 没有说明旧版文档是否仍会被检索

---

# 5. 四项材料的推荐目录结构

```text
platform_config/
├── 01_agent/
│   ├── agent_config.json              # 能导出时
│   ├── system_prompt.md
│   ├── persona.md
│   ├── tool_descriptions.yaml
│   └── screenshots/
├── 02_workflows/
│   ├── workflow_index.csv
│   ├── breathing_guide.yaml
│   ├── light_message.yaml
│   └── screenshots/
├── 03_plugins/
│   ├── plugin_index.csv
│   ├── device_control.yaml
│   ├── cloud_bridge.yaml
│   └── screenshots/
├── 04_knowledge_base/
│   ├── knowledge_base_index.csv
│   ├── documents/                     # 实际上传的原文件
│   ├── retrieval_settings.md
│   └── screenshots/
└── 05_real_call/
    ├── trigger.txt
    ├── agent_response.txt
    ├── platform_trace.json
    ├── device_serial.log
    └── device_feedback.jpg
```

---

# 6. 最小可接受交付（时间紧时）

若平台没有导出能力，至少提供以下 10 项：

1. System Prompt 完整原文
2. 智能体模型名称与主要参数
3. 智能体工具列表
4. 每个实际使用工具的参数截图
5. 每个线上工作流的一张总览图
6. 条件节点与设备调用节点的放大截图
7. 插件列表及参数映射表
8. 知识库文件清单及实际上传文件
9. 一次真实调用：触发文本 + 返回原文
10. 对应的设备串口日志 + 灯/音频结果照片或视频

缺少第 9、10 项时，只能证明“配置存在”，不能证明端到端功能真实跑通。

---

# 7. 当前余光包中已有 / 尚缺

| 项 | 当前已有 | 仍需平台负责人补 |
|---|---|---|
| 智能体提示词 | `panel/agent.md` 仅是代码项目速览 | 平台 System Prompt、人设、模型参数、平台工具说明 |
| 工作流 | 代码中的本地流程与接口逻辑 | 平台线上工作流导出/截图、版本、触发器、分支 |
| 插件 | `xjiang-sdk` 调用代码、物模型字段、云桥接口 | 平台插件列表、action 参数映射、鉴权配置说明 |
| 知识库 | 本地 PDF/DOCX/README | 平台实际上传清单、版本、检索设置、命中示例 |
| 真实调用 | 部分本地/串口实测日志 | 一条平台触发→智能体→插件→设备反馈的完整记录 |

完成上述缺项后，将整个 `platform_config/` 目录放入 `YG_ABC_src_20261101.zip` 根目录，即可闭环清单第④条。
