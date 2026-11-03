# 余光 V2.1 C 平台与 Web 目标迭代验证报告

**日期**：2026-10-31  
**迭代基线**：`YG_C_Platform_Web_v2.1.zip`  
**接口约束**：`YG-IFACE-2.1.0`

## 本次实现

1. 在灵机 Vue 面板新增 `siid=13`、`piid=1–6` 的映射、展示和交互；原有 `9.1`、`10.2`、`10.3`、`10.4` 不变。新增设备写操作受 `VITE_YG_ENABLE_SIID13` 功能门禁控制，默认关闭。
2. 新增 `care_ack` 可信设备回执桥，包含请求签名、时间窗、设备及消息归属、灯效窗口、单次幂等处理和数据状态更新。
3. 将亲友端回执展示与现有 Web App 状态保持一致，添加 Supabase 兼容性迁移和 Cloudflare 托管目录同步。
4. 添加部署文档、环境变量占位示例及回归测试；保留原有 Supabase 聚合状态模型。

## 验证记录

| 验证内容 | 结果 |
|---|---|
| Node.js 单元与回归测试（排除依赖未就绪的 HTTP 集成测试） | **75 通过，0 失败** |
| `npm run check:sync` | **通过** |
| JavaScript 源码语法校验 | **通过** |
| TypeScript 及 Vue 脚本语法转译校验 | **通过** |
| 原生 HTTP 集成测试 | **待执行：Express 模块无法解析** |
| Vue 完整生产构建 | **待执行：无法完整安装 npm 依赖** |
| 实际灵机云产品物模型与设备联调 | **待执行** |
| Supabase 正式环境迁移与联调 | **待执行** |
| ESP32-S3 实机固件编译/烧录 | **本轮未执行** |

> 完整前端构建、在线回调及实机行为均未声称已验证。平台回执桥的密钥须部署侧单独创建并保密。设备端真实签名回调仍需结合厂商 SDK 和生产网关实现。

## 安全交付

- 打包时排除源压缩包中的私有 `.env` 和 `.npmrc`、字体二进制、依赖目录、缓存及旧嵌套 ZIP。
- 物模型 JSON 的 `productSecret` 字段全部清空；需在被授权的部署系统中重新配置密钥。
- `.env.example`、`.env.v21.example` 及 `.npmrc.example` 仅提供配置占位说明。
- `ljyd_xjwb03_agent_public_developer.zip` 作为下一轮固件开发基线，本轮不修改、不合并入平台交付包。

## 本地复验

```bash
cd webapp
npm ci
npm run sync:hosting
npm run check:sync
npm test
```

面板项目依赖安装后执行其 README 或 package.json 对应的生产构建命令。部署与云端注册顺序见 `YG_C_V2.1_交付与部署.md`。
