# 余光 C 端 V2.1｜代码迭代交付与部署

契约：**YG-IFACE-2.1.0**（2026-10-31，FROZEN）。本次以用户提供的 `YG_C_Platform_Web_v2.1.zip` 为代码基线。

## 已落地的功能

- `panel/src/config/yuguang-field-map.ts`：保留旧 `9.1 / 10.2 / 10.3 / 10.4`，新增六个 `13.x` 映射名。`VITE_YG_ENABLE_SIID13` 默认为 false，未核验平台物模型时 **禁止 13.x 写入**。
- `panel/src/config/config_Yuguang.json`：六个属性的提案配置，含 13.3 的 100ms 计量单位与只读限制。此文件只是本地 SDK 配置，**不代表云端已录入**。
- `panel/src/views/Yuguang/HomeView.vue`：新增随息陪伴、引导状态、目标周期、感知板 BLE 状态、Demo 云推理意向、主动放松请求。动态值均从设备实际属性读取。未有实时可信呼吸数据时显示无信号。
- `webapp/shared/care-ack.mjs` 与 `shared/service.mjs`：带 HMAC-SHA256 签名的规范化回执入口、消息和设备归属校验、灯效窗口校验、CAS 原子更新及重放去重。状态同时写入原有 `messages`/`touches` 聚合记录，发送者页面在服务端完成后显示「已收到」。
- `webapp/supabase/migrations/202610310001_care_ack_v21.sql`：兼容旧归一化 `yuguang.messages` 的可选增量字段。**当前 Web App 的真实数据源仍为 `public.yuguang_spaces` 聚合记录**，回执的事务写入由该 CAS 模型承担。
- `webapp/tests/care-ack.test.js`：真实业务事务的重试、冲突、签名、租户/设备归属、灯效过期和并发测试；通过源文件同步保证托管代码与本地代码一致。

## 快速启动与部署

### 1. Web App（本地）

```bash
cd webapp
npm ci
cp .env.example .env
# 配置 PORT、可选 SUPABASE_URL / SUPABASE_SECRET_KEY / LIVE_STORAGE
npm test
npm start
# 浏览 http://localhost:3100/
```

本地默认 SQLite；切换正式数据存储前先应用 `202610300001_live_v2.sql`，再根据历史 schema 情况应用 `202610310001_care_ack_v21.sql`。不要直接用展示空间替代正式数据库。需要云数据库时，先确保专用 Supabase 私有项目及真实密钥只存在于服务端配置。

### 2. Web App（托管版）

```bash
cd webapp
npm run sync:hosting
npm run check:sync
# 按原工程 hosting/README.md 的部署步骤构建和发布
```

为服务器/边缘运行时增加 `CARE_ACK_BRIDGE_SECRET`（至少 32 字符，建议生成 64 字符以上的随机值）。它仅用于**经过可信灵机回调验签器验证后的适配器**到本站的内部链路。请保持密钥为服务端 Secret，不要配置到 Vite `VITE_*` 或浏览器代码中。托管运行时（Cloudflare 等）还须分别正确配置数据库与对象存储绑定。

### 3. 灵机 H5 面板

```bash
cd panel
# 由项目维护方配置可访问 xjiang-sdk / xjiang-ui 的私有 npm 源及独立凭据
npm ci
cp .env.example .env.local
# 在灵机后台录入并核对 siid=13 / piid=1..6 后，修改：
# VITE_YG_ENABLE_SIID13=true
npm run build:prod
```

`panel/src/config/config_Yuguang.json` 提供 SDK 侧属性标识；务必与平台生成的实际属性键 `suixi_SuixiSwitch`、`suixi_GuideState`、`suixi_GuidePeriod`、`suixi_CloudPoseOptIn`、`suixi_SensorLink`、`suixi_RelaxRequest` 核验一致。未核验前保持功能门控关闭。既有四键无需修改。

从安全交付角度，本包移除了基线 `.npmrc` 内部认证信息、私有 `.env` 值、物模型 `productSecret` 值和二进制字体文件。需按项目维护方的合法配置补齐运行环境；页面使用系统默认字体回退。

## 回执桥接协议：内部认证边界

- 地址：`POST /api/bridge/care-ack`，仅正式版路径有效。
- 数据：完全符合 `contracts/care_ack.schema.json`，`event_id` 必须为 UUID，`reply_text` 固定「收到了」，业务板必须以同一 `event_id` 重试。
- 适配器请求头：`x-yg-timestamp-ms`（十三位毫秒时间戳）；`x-yg-signature`（HMAC-SHA256，十六进制小写）。
- 待签名字节：UTF-8 字节串 `${x-yg-timestamp-ms}.${原始JSON请求体}`；使用仅服务器持有的 `CARE_ACK_BRIDGE_SECRET`。
- 签名时间戳有效窗口：±5 分钟。可以为同一事件重试时重新签名，但不得重新生成 `event_id`。
- 适配器**必须先按照灵机云真实回调文档进行来源认证、验签、设备绑定/用户关系校验**，再转成规范化 JSON 送入本内部桥接接口。此内部 HMAC **不等于灵机云原生签名**。不可将未经验证的外部回调直接转发。
- 业务板上行能力在厂商 SDK 中可定位为 `ljyd_method_up(method, submethod, params_json)` 调用 `qm_iot_up_report_ex`，但其真实 `method/submethod`、厂商回调格式和签名规则仍需由平台回调文档确定。
- Web App 会再次依据正式设备身份与绑定的消息校验归属，确认 `occurred_at_ms` 位于已交付灯效的有效时间窗内，并通过 CAS 保存。成功响应 `{ acknowledged: true, duplicate: false, ... }`；同一事件的成功重投返回 `duplicate: true`；另一个事件再次确认同一消息则拒绝。
- 设备只有在平台返回**持久化成功**后才能将本地事务置为完成；GPIO5 的门控必须由业务板固件执行。

## 验证结果及边界

- 已在当前环境运行 Node 原生回执与业务回归测试，包含并发与权限场景。
- 当前环境安装 npm 包时出现 DNS `EAI_AGAIN`；网页 HTTP 实例测试因缺少 `express` 依赖未能运行，Vue/Vite 和 Sites 完整构建尚未完成验证。
- 未连接真实灵机云、Supabase 生产数据或 ESP32-S3 硬件；**不能将目前工程视为已经部署上线或完成真机联调**。
- 13.1–13.6 云端录入、厂商侧回调验签/转发部署、GPIO5 固件事件上报由平台账号和业务板固件完成；本包为 C 端可继续部署的源码增量。
- P2 双呼吸曲线、P3 姿态授权的完整前后端链路与 P4 压力回落验收属于后续阶段。
