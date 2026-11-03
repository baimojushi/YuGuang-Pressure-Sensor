# 余光硬件协议 v2

本规范对应 10 月 29 日交互修订。v1 的持续播放与等待触摸后才处理下一条已经变更。硬件固件需要按 v2 的 durationMs、cycles、playUntil 和 rest 实现，不可沿用无限循环灯效。

## 基址与认证

正式版 API 基址为网站源地址加 /api。展示版加 /api/demo，两者不可混用。需要绑定自己玩偶的用户登录正式版，在“我的余光”生成自己的 deviceId 和 key；密钥只显示一次，服务器只保存哈希。不要使用展示版的 lamp-001 或默认演示密钥连接正式版。

所有硬件请求头：X-Device-Key: <自己的 key>；JSON 请求增加 Content-Type: application/json。正式版与展示版共用以下路径，替换 <deviceId>。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | /hardware/<deviceId>/heartbeat | 每 10 秒一次，读取专注、关灯与休息状态 |
| GET | /hardware/<deviceId>/pending | 建议每 2 秒查询，返回 command 和 rest |
| POST | /hardware/<deviceId>/delivered | 固件接受灯效，提交 commandId |
| POST | /hardware/<deviceId>/touch | 确认已接收/已淡出的灯语，提交 commandId、eventId |
| PUT | /hardware/<deviceId>/focus | 本人设置 focus 布尔值 |
| POST | /hardware/<deviceId>/gesture | 上报互斥的短触/长触事件 |
| POST | /hardware/<deviceId>/breathing | 上传本人呼吸采样，详见呼吸说明 |
| POST | /hardware/<deviceId>/breathing/live | 桌搭持续呼吸结果，约每 2 秒上报，自动分段留存 |
| GET | /hardware/<deviceId>/messages | 本人主动请求后查询留言 |
| GET | /hardware/<deviceId>/audio/<audioId> | 本人主动回听指定原声 |

服务不依赖平台用户会话来认证硬件，硬件使用自己的密钥即可。密钥轮换后旧密钥立即失效；错误密钥返回 401。不得把 App 用户登录令牌烧入固件。

## 单轮灯语

pending 返回 command 的 id、intent、messageIds、status，以及 light：

~~~json
{
  "pattern": "slow_breathe",
  "colors": ["#e6b4b7"],
  "periodMs": 6000,
  "cycles": 1,
  "durationMs": 6000,
  "maxBrightness": 0.12,
  "sound": false,
  "autoFade": true
}
~~~

先提交 delivered，收到执行确认后按返回的 playUntil、durationMs 和 cycles 执行一轮，到时自然淡出。相同 commandId 不重新计时、不重复播放。轮询返回 null 或 play:false 时停止当前情感光；断线不开始新的灯语。

miss/cheer 为柔桃粉一次慢起伏，cheer 亮度稍高；meal/rest 为嫩绿三次轻起伏。replyPreference=when_free 覆盖为深橙色六秒淡出，表示方便时回复，不升级提醒。亮度只是工程初值，需真机调试，不是健康或光照剂量结论。

不等待用户触摸才结束灯效。淡出后服务端保留心意和主动回应入口，下一条在冷却间隔（当前为结束后 60 秒）及专注/休息规则允许时传递。未触摸不算收到。相邻同意图、同回应意图合并为一个批次。

设备接收确认只用于执行可靠性，不在亲友 App 显示成“已读”。只有用户主动触摸或点“收到啦”才产生主动回执。

## 模式与手势优先级

1. 物理关灯、App 关闭情感光、专注状态优先；stopLight:true 要停止情感光。
2. 自由休息时，新情感光排队。pending 的 rest 独立描述本人主动开启的休息，不因收到新心意而震动。
3. 短触在休息到时状态下优先确认休息提醒；休息尚未到时的短触不回复心意。
4. 无休息提醒时，短触确认携带 commandId 的那束心意。
5. 长触达到 5 秒只开启自由休息，不额外发一次短触回执。固件必须在松手/达到阈值后判定动作，不能在 touch-down 时就发短触。

~~~json
{"type":"long_touch","durationMs":5000,"eventId":"设备保存并重试同一个事件编号"}
~~~

~~~json
{"type":"short_touch","eventId":"唯一事件编号","commandId":"当前或最近一轮灯语编号"}
~~~

同一 eventId 重传幂等，改用其他手势类型返回 409。丢失服务器响应时用原 eventId 重传。5 秒阈值、防抖、误触处理和“同一次物理触摸不生成两个事件”需固件实现。

## 自由休息

App 与长触共享同一后端休息记录。长触默认 5 分钟，App 可选 5/10/15 分钟，延长操作可重复。服务端保存 endsAt，不依赖浏览器一直运行。

pending 返回 rest 时 command 为空。休息中可低亮雾蓝稳定；到时按 reminderEventId 仅执行一次雾蓝两次柔和提示后淡出，不能每次轮询重新提示。返回 play:false 时连休息光也应静音/停止。到时不主动震动；短触确认或用户在 App 结束后清除该事件。

专注与关灯仍优先。用户主动冥想震动引导和触摸节点反馈可待固件实现，本接口不伪装电机已存在。

## 原声与呼吸

用户确认桌搭开机持续采集，无需抱住或 App 手动开始。新增实时结果接口、状态、自动归档与容量限制见 [持续呼吸采集](持续呼吸采集.md)。以下 `/breathing` 分段协议继续用于历史批量补传；不要把延迟历史当作当前实时值。

messages 只允许查询发给设备主人的当前亲友留言。audioUrl 使用同一个设备密钥读取；必须等本人主动要求才播放，并提供停止播放能力。解绑后音频读取立即拒绝。请勿持久保存原声。

breathing 格式：

~~~json
{
  "eventId":"设备唯一采样记录编号",
  "startedAt":1793232000000,
  "endedAt":1793232060000,
  "samples":[{"offsetMs":0,"rpm":12},{"offsetMs":30000,"rpm":13}]
}
~~~

这是协议示例，不会自动入库。时间为 UTC 毫秒，设备需校准时钟。单次最长 24 小时，1–720 个严格递增采样点。相同事件、相同内容重传返回 duplicate；冲突返回 409。原始波形到 rpm 的计算由硬件同学完成。App 不通过灯效推算真实呼吸，不判断情绪或大脑专注状态。

## 网页与硬件的边界

展示版有模拟接口；正式版没有模拟器。正式版“在线”由设备使用真实密钥上报心跳产生，网页绑定设备不会自动变在线。语音唤醒、扬声器、电机、真实触摸、LED 与断网缓存均须固件实现并联调验证。

## 账号与设备归属更新（2026-10-30）

App 不再区分固定发送者 / 接收者角色。每人最多绑定一台自己的设备；一对亲友可以一人有设备，也可以各有一台。协议路径和请求格式保持不变，每台设备仍只用自己的 deviceId 与 key，查询发给其 ownerId 的待传达消息、上报本人的触摸与呼吸。不要把配对 ID 当作设备归属，也不要共用两台设备的密钥。只有一台真实硬件时，不要求现场同时准备第二台。
