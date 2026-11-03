## 项目介绍

这是一个运行在微信小程序 web-view 内的 H5 插件项目，核心是设备控制与设备衍生能力页面。

## Skill：private-cloud-h5 项目速览

### 1. 项目定位

- 技术栈是 Vue 3 + Vite + TypeScript + Vue Router + Pinia + Element Plus。
- 当前主入口实际切到 AI 闹钟场景，路由首页指向 AIClock Home 页面。
- 这是“宿主容器 + H5 插件”模式，不是独立纯 H5 站点。
- H5 页面会被微信小程序 web-view 嵌套运行，同时代码里也兼容 RN WebView 场景。

### 2. 运行与宿主环境判断

- 小程序环境通过 `window.__wxjs_environment === "miniprogram"` 判断。
- RN WebView 环境通过 `window.ReactNativeWebView?.postMessage` 判断。
- 页面内很多导航栏、回退、标题设置逻辑，都依赖“当前是否在宿主中”。
- 开发调试模式会走 `import.meta.env.MODE === "debug"`，并使用 mock device info。

关键代码：

- [stores/index.ts](file:///Users/cole/app/private-cloud-h5/src/stores/index.ts#L25-L46)
- [nativeRouter.ts](file:///Users/cole/app/private-cloud-h5/src/utils/nativeRouter.ts#L9-L23)

### 3. 项目主结构

- `src/` 是主业务代码目录。
- `src/views/` 按设备/业务拆页面，例如 AIClock、AILamp、AUPU_S2S、AUPULight。
- `src/config/` 放设备配置 JSON，当前 `stores/index.ts` 中实际引入哪个配置，就决定当前运行的设备插件类型。
- `xjiang-sdk` 是宿主通信与设备能力 SDK（npm 依赖，按裸包名引入）。
- `xjiang-ui` 提供 UI 组件、主题、多语言、弹窗、toast 等基础能力（npm 依赖，按裸包名引入）。

### 4. 当前入口与设备切换方式

- Vue 应用入口在 [main.ts](file:///Users/cole/app/private-cloud-h5/src/main.ts#L1-L18)。
- 页面根组件在 [App.vue](file:///Users/cole/app/private-cloud-h5/src/App.vue#L1-L60)。
- 路由入口在 [router/index.ts](file:///Users/cole/app/private-cloud-h5/src/router/index.ts#L1-L249)。
- 当前首页使用的是 [AIClock/HomeView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/HomeView.vue#L1-L281)。
- 当前设备配置使用的是 [stores/index.ts](file:///Users/cole/app/private-cloud-h5/src/stores/index.ts#L21-L22) 中的 `config_AIAlarm.json`。

结论：

- 如果后面 agent 看到页面逻辑和 AI 闹钟强相关，不是巧合，而是当前项目就是切在 AIClock 配置和路由入口上。
- 如果要切到 AI 灯、奥普灯具等场景，通常先看 `src/stores/index.ts` 与 `src/router/index.ts` 里当前启用的是哪套配置与首页。

### 5. 宿主通信模式

这个项目最关键的不是 Vue 本身，而是“如何和小程序宿主通信”。

#### 导航通信

- H5 内部页面跳转使用 Vue Router。
- H5 跳出当前 H5、返回宿主页、打开宿主原生页时，走 `nativeRouter`。
- RN 场景调用 `xj.msgToNative("navigateTo", payload)`。
- 小程序场景调用 `xj._weappApi.webSocketSend("navigateTo", payload)`。

关键代码：

- [nativeRouter.ts](file:///Users/cole/app/private-cloud-h5/src/utils/nativeRouter.ts#L25-L87)
- [AIClock/HomeView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/HomeView.vue#L129-L130)
- [AIClock/SettingsView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/SettingsView.vue#L7-L17)

#### 请求头注入通信

- 所有业务接口统一基于 axios 封装。
- 请求发出前，会向宿主请求 headers，再注入到接口请求里。
- RN 通过 `xj.msgToNative("getReqHeaders")` 获取。
- 小程序不能走 RN 那套通道，因为注释明确说明小程序路径下 ws 未初始化，消息会卡住。
- 小程序必须走 `weappApi.webSocketSend("getReqHeaders")`。

关键代码：

- [request.ts](file:///Users/cole/app/private-cloud-h5/src/utils/request.ts#L42-L66)
- [nativeApiRequestHeaders.ts](file:///Users/cole/app/private-cloud-h5/src/utils/nativeApiRequestHeaders.ts#L23-L55)

这个点对后续 agent 非常重要：

- 只要是接口异常、鉴权丢失、某环境下请求没带 token，优先检查是不是宿主 headers 获取链路有问题。
- 小程序与 RN 的 headers 获取通道不同，不能混用。

### 6. 设备数据生命周期

- 全局状态由 `XJIotSDK` 初始化。
- `stores/index.ts` 中创建 `xj` 实例，并暴露 `xj、status、info、device、data、initData`。
- `onPageInit` 用于拿宿主初始化信息。
- `onDeviceInfoChange`、`onDeviceDataChange` 用于实时同步设备信息和设备数据。
- 小程序环境下会把 `deviceName` 写到 `document.title`。

关键代码：

- [stores/index.ts](file:///Users/cole/app/private-cloud-h5/src/stores/index.ts#L48-L89)

理解方式：

- `info` 更偏设备基础信息，如 `did/pid/deviceName`。
- `data` 更偏设备功能态与属性值。
- 多数页面真正依赖的是 `info.did` 作为业务接口主键，以及 `data.xxx` 作为设备展示状态。

### 7. 当前 AI 闹钟页面结构

AI 闹钟首页由 3 个 tab 组成：

- `alarm`：今日闹钟与设备概览。
- `chat`：设备对话记录。
- `growth`：成长资源与学习内容。

关键代码：

- [AIClock/HomeView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/HomeView.vue#L28-L54)
- [AIClock/HomeView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/HomeView.vue#L270-L281)

补充理解：

- tab 状态会持久化在 `localStorage`，key 是 `ai-clock-active-tab`。
- 首页 mounted 后会调用 `xj.pageInit()`，并在 `info.did` 就绪后拉取闹钟列表。

### 8. ChatView 的业务语义

当前打开的 [ChatView.vue](file:///Users/cole/app/private-cloud-h5/src/views/Common/ChatView.vue#L1-L249) 是 AI 闹钟“对话记录”页，不是通用 IM 组件。

它的核心逻辑：

- 初次加载拉最近 20 条对话。
- 接口返回倒序，前端 reverse 后按时间正序展示。
- 上滑到顶部时加载更早历史。
- 定时轮询追加新消息。
- 数据主键依赖 `info.did`。

关键代码：

- [ChatView.vue](file:///Users/cole/app/private-cloud-h5/src/views/Common/ChatView.vue#L29-L51)
- [ChatView.vue](file:///Users/cole/app/private-cloud-h5/src/views/Common/ChatView.vue#L53-L76)
- [ChatView.vue](file:///Users/cole/app/private-cloud-h5/src/views/Common/ChatView.vue#L78-L115)
- [ChatView.vue](file:///Users/cole/app/private-cloud-h5/src/views/Common/ChatView.vue#L169-L177)
- [rtc.ts](file:///Users/cole/app/private-cloud-h5/src/utils/apis/rtc.ts#L53-L60)

后续 agent 看这块时要特别注意：

- `beforeId` / `afterId` 的命名和常规直觉可能相反，实际含义必须以接口行为为准。
- 现在“最新消息追加”和“历史消息分页”都依赖接口返回顺序，改动前必须先保住 reverse 逻辑。
- 定时器注释写“每1分钟”，但实际轮询间隔是 6000ms，也就是 6 秒，要以代码为准。

### 9. 业务接口风格

- 接口统一走 `src/utils/request.ts`。
- AI 闹钟业务接口集中在 [aiAlarmApi.ts](file:///Users/cole/app/private-cloud-h5/src/utils/apis/aiAlarmApi.ts)。
- 对话记录接口在 [rtc.ts](file:///Users/cole/app/private-cloud-h5/src/utils/apis/rtc.ts)。
- 接口路径大量以 `app/...` 开头，真实域名来自环境变量 `VITE_APP_H5_API`。

常见接口模式：

- 设备闹钟列表：`app/api/ledi/alarm/alarms`
- 对话记录：`app/ws/chatRecord/getConvoList`

### 10. 路由与页面分层规律

- “设备主首页”通常在 `src/views/<设备名>/HomeView.vue`。
- “设备扩展页”通过 Vue Router 按 path 注册。
- “Common” 目录下放的是跨设备或跨 AI 场景复用页面，如成长、资源、学习报告、聊天记录。

对 agent 的实用判断：

- 如果需求是“页面内切换/详情页跳转”，先看 Vue Router。
- 如果需求是“关闭 H5 / 返回宿主 / 打开原生页”，先看 `nativeRouter`。
- 如果需求是“设备数据没更新”，先看 `stores/index.ts` 里的 SDK 回调。
- 如果需求是“接口没权限”，先看请求头注入链路。

### 11. 当前项目的隐性约束

- 这是嵌入式 H5，不应假设浏览器能力完整可控，很多能力依赖宿主注入。
- 页面标题、返回动作、鉴权头、原生跳转都不是纯前端自闭环。
- 某些页面在小程序内会隐藏自定义导航栏，因为宿主已有导航容器。

例子：

- [AIClock/HomeView.vue](file:///Users/cole/app/private-cloud-h5/src/views/AIClock/HomeView.vue#L138-L141) 中仅在非小程序环境展示自定义导航栏。

### 12. 后续 agent 接手建议

如果后面 agent 要快速上手，建议按这个顺序判断：

1. 先确认当前激活的是哪套设备配置：看 [stores/index.ts](file:///Users/cole/app/private-cloud-h5/src/stores/index.ts#L21-L22)。
2. 再确认当前首页入口是哪一个：看 [router/index.ts](file:///Users/cole/app/private-cloud-h5/src/router/index.ts#L25-L34)。
3. 判断需求属于哪类：Vue 内路由、宿主通信、设备数据、接口请求、样式展示。
4. 如果问题只在小程序里出现，优先排查 `isMiniProgram` 分支。
5. 如果问题只在真机宿主里出现，优先排查 `xj` 与宿主消息桥，而不是页面渲染本身。

### 13. 一句话总结

这是一个“以设备插件为组织方式、以宿主通信为关键链路、当前主场景为 AI 闹钟”的 Vue3 H5 项目；在这个项目里，业务页面只是表层，真正影响行为的是设备配置切换、宿主桥接、请求头注入和 `info.did` 驱动的数据生命周期。
