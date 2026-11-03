# Supabase 接入与自测

2026-10-30 已接通专用项目 yuguang-live（项目编号 sviinpuptejijyniohij，东京区域）。本机正式版和已发布的线上第 5 版均选择 Supabase；真实数据库读写、私有音频往返与匿名访问拒绝已通过。业务用户和记录仍为空，留给本人自行注册。细节见《验收记录.md》最新条目。

## 正式存储

- 仅正式版可选择 Supabase：`LIVE_STORAGE=supabase`。
- `public.yuguang_spaces` 保存 live-v2 聚合业务状态，使用版本条件更新实现 CAS；保持当前两版的同一业务逻辑。单空间 8 MiB，适合本次比赛规模。
- `yuguang-audio` 为私有音频桶，单文件 5 MB。App 用户与硬件均须经过后端授权，不给浏览器或硬件服务端管理密钥。
- 展示版继续使用独立 SQLite / D1 空间，不写进正式 Supabase 表，也不导入旧演示数据。
- 云连接失败明确返回错误，不偷偷降级写本地，避免出现两份不同的正式数据。

## 初始化与配置

先在专用项目 SQL Editor 执行 `supabase/migrations/202610300001_live_v2.sql`。它只新增余光专用表和私有桶，不删除已有表，也不自动复制本机或旧云端数据。

本机将以下值放在被 Git 忽略的 .env 中，文件权限限本人读取：

~~~text
LIVE_STORAGE=supabase
SUPABASE_URL=https://你的项目编号.supabase.co
SUPABASE_SECRET_KEY=服务端专用密钥
SUPABASE_AUDIO_BUCKET=yuguang-audio
~~~

用 npm start 启动会自动读取 .env。线上通过 Sites 的运行环境变量设置同名配置，密钥标为 secret，再构建发布。代码仓库、页面、硬件固件不能包含服务端密钥。

本机网络通过系统已有代理访问 Supabase，.env 中另设置 NODE_USE_ENV_PROXY=1、HTTP_PROXY 与 HTTPS_PROXY，以及 NO_PROXY=localhost,127.0.0.1。这些只作用于余光进程，未改动系统设置，也不上传线上。代理模式需要 Node.js 24.5 或以上；无代理环境仍支持 Node.js 22.13。启动包装器确保代理变量在子进程启动前生效。

旧的 202610280001_mvp0.sql 和 prepare-supabase.mjs 是首版九表方案的历史准备，不能拿来替代当前 V2 的初始化，也不会自动切换 APP。

## 登录与自行体验

Supabase 控制台账号用于管理数据库，和使用余光的个人账号是两回事。本阶段迁移数据库与私有音频存储，不宣称接入 Supabase Auth。

- 本机正式页 http://localhost:3100/：创建自己的账号和密码、填写称呼，不再选择角色，不会生成默认配对或示例记录。
- 可在另一个标签页创建第二个自己的测试账号。任一方生成邀请码，另一方输入，双方即可互发消息。有无玩偶都能收发；每人按需绑定自己的设备。
- 线上正式页沿用个人 ChatGPT 身份登录；不同个人身份可以跨端配对，数据库仍使用同一个 Supabase 项目。
- 新设备未接入时保持离线；没有传感器上传就没有设备呼吸曲线。个人练习只保存真实计时，不生成呼吸测量值。

## 验证

npm test 包含完整 Supabase HTTP 适配契约、CAS 并发与重传、本人数据隔离、配对解绑、原声权限以及配置错误时不降级的检查。测试使用隔离夹具，不向正式库创建示例用户。

配置实际项目后执行 npm run check:supabase：验证数据库真实读写、CAS 条件更新，以及临时私有音频上传/读取/删除和公开访问被拒绝。只创建空白正式状态（不存在时），不会添加示例账号、设备、消息、采样或练习。连接检查的临时音频结束后删除。

真实 LED、触摸、呼吸采集、语音唤醒仍需队友固件联调。
