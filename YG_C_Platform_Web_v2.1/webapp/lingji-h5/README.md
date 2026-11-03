# 余光 · 灵机一动 H5 控制面板接入文件

此目录独立于余光 Web App。`public/device-panel.js` 是余光 Web App 已接入的控制页；这里的 Vue 单文件组件用于参考 `private-cloud-h5.zip` 中的 `xjiang-sdk` 平台控制面板接入方式。

## 视觉风格

此页面已经按余光原版统一：米白纸张背景、柔绿强调、17px 圆角卡片、细线条灯语图标，并复用余光玩偶 SVG 的轮廓与底座。平台示例只作为 SDK 接入参考，视觉样式不沿用示例项目的通用模板。

## 安装到平台示例工程

1. 将 `src/views/Yuguang/HomeView.vue` 拷贝到灵机 H5 示例工程的同一路径，将 `src/config/yuguang-field-map.ts` 拷贝到对应目录。
2. 在平台真实产品中建立并核实 **情感光开关**、**深度专注** 两个布尔可写属性，可选 **呼吸频率** 与 **采集状态** 只读属性；取得官方产品真实物模型后修改 `yuguang-field-map.ts`。所有属性默认 `null`，页面会锁定未映射的开关；还需让平台适配层提供可信的布尔在线状态（如 `info.isOnline`），在线状态未知时也保持锁定。
3. 按参考工程的步骤导入平台真实物模型、生成自己的 `config_Yuguang.json`，在 `src/stores/index.ts` 将当前 `config_AIToys2.json` 改为实际 `config_Yuguang.json`。
4. 在 `src/router/index.ts` 的 `routes` 加入 `{ path: '/yuguang', name: 'yuguang', component: () => import('../views/Yuguang/HomeView.vue') }`，需要用控制面板作为首页时也可将 `HomeView` 的默认导入换成 `Yuguang/HomeView.vue`。
5. 在真实设备在线时用 SDK 的 `xj.device.get` 和 `xj.device.set` 验证属性名、设备回报、开关幂等与离线状态。首次联调前不要发布到正式产品。

## 已实现与界限

- 使用示例工程的 `xj.pageInit`、`xj.device.get`、`xj.device.set` 和响应式设备数据实现属性状态与开关；页面没有自造设备在线或执行结果。
- 五种灯语及屏幕光感为本地预览，未填平台服务、未下发灯光；呼吸只有设备**实际回调的新样本**且 15 秒内有效才显示数值，没有有效值显示 `—`。
- 后端配对、灯语队列、真实呼吸存储和个人权限仍由余光 Web App 维护。灵机平台对用户、PID、SN、设备归属的映射、回调验签与适配层仍需要双方对接，不允许通过匿名转发绕过权限。
- 建议在平台完成 **真实物模型 → 属性开关 → 设备回报** 之后，再联调余光后端的灯语执行服务、短触、长触、持续采集与回执。

请勿把用户 token、PID SECRET、设备独立密钥写入 H5 源码、浏览器存储或群聊截图。项目详细协议见 `../docs/队友交接与灵机接入.md`。
