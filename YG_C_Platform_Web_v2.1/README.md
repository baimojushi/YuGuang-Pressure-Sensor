# 余光｜平台与 Web 端基线 YG_C_Platform_Web_v2.1

契约：**YG-IFACE-2.1.0**（FROZEN，2026-10-31）。本包为该契约下「灵机云及 Web 平台」端的**当前实现基线**（2026-10-31 时点）。
业务板固件 / 感知板固件基线另行交付，不在本包内。

## 1. 内容清单

| 目录/文件 | 来源 | 说明 |
|---|---|---|
| `panel/` | `余光开发\ui例程\aiBaseLight\private-cloud-h5` | 灵机面板源码（已接入余光面板·原版风格 UI，v2 物模型绑定，构建验证通过）。已排除 node_modules/dist |
| `webapp/` | `余光-原版风格控制面板-完整项目-20261030.zip` 内 `yuguang/`（最新已交付 Web 源） | Web App 源码：本地 Express 应用 + Supabase 迁移 + Sites hosting 源 + lingji-h5 参考组件 |
| `contracts/platform_adaptation_v2.1.md` | 本包随附 | 平台侧适配定义：物模型差量、面板/云端改动清单、数据边界、P0-P4 时序、开放问题 |
| `contracts/thing_model/siid13_proposal.json` | 本包随附 | siid 13 物模型提案（v2 导出格式片段，供平台录入；**已剔除 productSecret**） |
| `contracts/care_ack.schema.json` | 本包随附 | 契约 §4 冻结的 care_ack 回执负载 JSON Schema（桥接服务与固件共同校验依据） |

契约全文以产品侧 2026-10-31 冻结版原文为准，本包不附转录副本（避免转录漂移）；`platform_adaptation_v2.1.md` 已复述全部平台相关条款并标注章节号。

## 2. 合规矩阵（契约条款 → 本基线状态）

| 契约条款 | 状态 | 说明 |
|---|---|---|
| §2 原有属性 9.1/10.2/10.3/10.4 保留，不改标识与类型 | ✅ 已实现 | 面板 field-map 已绑定；`panel/` 即当前实现（10.3 语义细化为 Measured Breath，显示端零改动） |
| §2 新增 siid 13（13.1-13.6） | ⏳ 待平台录入 | 提案 JSON 已附；录入后实施 field-map 六键扩展与面板卡片（P1） |
| §3 10.3 上报策略（最短 10s / 变化阈值 0.5 次分 / 60s 保活） | ⏳ 待业务板固件对齐 | 由业务板固件基线承接；当前固件 breath 组件为 1s 周期，需按契约调整 |
| §3 感知数据不上云、伴侣端禁展示 | ✅ 边界已定义并落实 | Web App 伴侣端无呼吸/负荷展示；研发 /dev 通道独立授权（P2+） |
| §4 care_ack 回执 | ⏳ 桥接服务待实现（P1） | 负载 schema 已随附；Web App 发送端回执展示依赖桥接上线 |
| §1 BLE 板间协议 | ➖ 不适用 | 板间协议为业务板/感知板固件两端职责（各自基线交付） |
| §5/§6 算法边界与冻结规则 | ✅ 已在适配定义中复述 | 实现侧遵守 |

## 3. 已知偏差与时点说明

1. `panel/` 为 2026-10-31 时点的 private-cloud-h5（原版风格 UI 集成 + v2 绑定，构建验证通过）；灵机平台线上版本以平台发布记录为准。
2. `webapp/` 取自 20261030 原版风格完整项目包（最新已交付 Web 源）；Sites 线上部署若早于此源，需重新部署对齐。
3. siid 13 未在灵机平台录入前，面板 field-map **不启用** 13.x 数据键（避免悬空绑定）；录入后按 `platform_adaptation_v2.1.md` §2 的六键预期值扩展。
4. 13.6「主动放松请求」的自清由固件实现（读到 true 执行后写回 false）；平台按普通 bool rw 录入即可。
5. 13.3 若平台不支持 uint16 类型，退化为 uint32/int32，单位 100ms 不变。
6. 原中文路径仓库的 `apps/build` 处于历史失败状态且该路径下构建必然崩溃；**固件构建一律使用 ASCII 路径 `D:\yuguang_fw\...`**（配方见固件基线）。

## 4. 面板构建与运行

```bat
cd panel
npm ci
npm run build
```

开发调试：`npm run dev`。
数据键绑定：`panel/src/config/yuguang-field-map.ts`（当前四键：`power_Prop_9_1` / `focus_Prop_9_2` / `focus_Prop_9_3` / `focus_Prop_9_4`）。

## 5. 边界与安全

- 本包**不含** productSecret、云密钥或任何凭据（thing_model 提案已剔除 product 字段）。
- 呼吸/负荷等感知数据仅限设备所有者本人面板查询；伴侣端（Web App 发送者）不展示。
- 回执桥接服务实现时必须满足契约 §4：验签、消息归属校验、按 message_id 幂等、Supabase 原子状态更新。
- 本包不包含固件镜像与固件源码（另行交付）。

## V2.1 代码迭代

请先阅读 [C 端交付与部署说明](YG_C_V2.1_交付与部署.md)。新增桥接入口在 `webapp/shared/care-ack.mjs`，灵机云原生回调签名适配仍需平台实际文档与授权。
