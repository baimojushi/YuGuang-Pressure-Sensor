# 物模型设备控制

这个目录位于 `apps/main/lj_components/iot_control`，放云端属性下发对应的设备控制。
云连接只负责收包。有云不一定挂物模型；挂了物模型就一定要先有云 handle。

## 与余光物模型 v2 的对齐（productKey 11879「余光」）

| siid | piid | 含义 | 方向 | 实现 |
| --- | --- | --- | --- | --- |
| 2 | 1 | 音量 10..100 | 下行 | `ctrl/iot_control_volume.c` |
| 2 | 2 | 1 增大 2 减小 3 最大 4 最小 | 下行 | `ctrl/iot_control_volume.c` |
| 9 | 1 | 情感光开关 bool | 下行 | `ctrl/iot_control_light.c`（WS2812 白光） |
| 10 | 2 | 深度专注 bool | 下行 | `ctrl/iot_control_focus.c` |
| 10 | 3 | 呼吸频率 0..120 | 上报 | `ctrl/iot_control_breath.c`（只读，1s 周期） |
| 10 | 4 | 采集状态 ok/no_signal | 上报 | `ctrl/iot_control_breath.c`（只读，1s 周期） |

注意：

- 物模型 v2 里 siid 10 piid 1 与 siid 11/12 是重复定义（情感光/呼吸/状态的重复项），
  面板只绑 9.1 / 10.2 / 10.3 / 10.4；固件不给 10.1 登记任何行为。
- 舵机（原 9.1）与振动马达（原 10.1）在 v2 里没有属性，已从表中摘除；
  代码保留在 `ctrl/` 与 `peripheral/`，需要时另配 siid/piid 再登记。
- 只读属性（10.3/10.4）不走下行表，`iot_control_breath` 从 `radar_ld6002` 快照周期上报。

当前提供：

- `iot_control.c`：一张 siid / piid 表。`iot_control_init()` 把查表函数挂到云的属性回调上，
  并启动 10.3/10.4 的周期上报任务；
- `ctrl/`：具体控制项。音量 / 情感光 / 专注的下行回调写在这张表上，呼吸上报独立成组件；
- `apps/main/main.c` 在 `ljyd_cloud_init()` 成功后直接调用 `iot_control_init(ljyd_cloud_get_handle())`。
新增控制项在表里加一行。不用改 `main.c`。
云没有属性回调时只打日志。表里没有匹配项时直接返回，不回错误。

MQTT `method`（例如 `chat/quit`）仍在 `apps/main/cloud/ljyd_method.c`，不走这张表。

属性从云端到设备的路径是：

```text
云端属性下发
        |
        v
ljyd_cloud 收包（只处理 PROPERTY_SET）
        |
        v
iot_control_on_set() 按 siid / piid 查表
        |
        v
属性回调（音量 / 情感光 / 专注）
        |
        +-- 写入 KV（音量）
        +-- 写硬件
        +-- qm_iot_report() 上报影子（音量 / 情感光 / 专注）
```

只读遥测的路径是：

```text
iot_control_init() 启动 breath 周期任务（1s）
        |
        v
radar_ld6002_snapshot() 取快照
        |
        v
ready 且 human==1 且 0 < br <= 120 ？
        |-- 是 -> 上报 10.3=呼吸率 + 10.4="ok"
        |-- 否 -> 上报 10.4="no_signal"
```

## 音量

对齐 `ljyd_ai_lamp` 的音量，不接静音。

| siid | piid | 含义 |
| --- | --- | --- |
| 2 | 1 | 绝对音量，10..100 |
| 2 | 2 | 1 增大，2 减小，3 最大，4 最小 |

宏在 `ctrl/iot_control_volume.h`：`IOT_CONTROL_VOLUME_SIID`、`IOT_CONTROL_VOLUME_PIID`、
`IOT_CONTROL_VOLUME_PIID_ADJ`。

增减命令到来时才读 KV。键是 `"volume"`，值和 `apps/main/voice/voice.c` 共用，范围 10..100，没有记录时用 80。
芯片寄存器是 0..31，换算是 `音量 * 31 / 100`。

芯片版本事件之后，`voice.c` 自己读同一条 KV 并调用
`QM_AUDIO_CTRL_SET_VOLUME`。所以开机音量由语音模块写到硬件，物模型初始化
不依赖 `qm_audio` 已经创建。

云端改音量时，`volume_commit()` 按这个顺序做：

```text
夹到 10..100
  -> 写入 KV "volume"
  -> voice_get_audio() 非空则写寄存器
  -> 用 siid=2 piid=1 上报当前绝对音量
```

`voice_get_audio()` 为空时跳过写寄存器，KV 和影子上报仍然进行。日志标签是
`volume`，可见 `kv load`、`VALUE set`、`ADJUST cmd`、`hw vol`、`shadow report`。

增减步长是 10。未知的调节命令只打日志，不改音量。影子只上报绝对音量，
不上报调节命令本身。

## 情感光开关（siid=9）

| siid | piid | 含义 |
| --- | --- | --- |
| 9 | 1 | 允许情感光 bool：true 白光常亮，false 熄灭 |

硬件：WS2812 数据线 GPIO1。开灯按固定亮度（60）白光 fill，关灯 clear。
本地氛围动画（`led_status`）通过 `iot_control_light_is_on()` 让位：
允许时白光优先，关闭时氛围呼吸继续。
情感光彩色灯语/呼吸动画与该开关的联动是下一步。

## 深度专注（siid=10 piid=2）

bool 状态同步：写内存并回报影子。MVP 重启后不持久（平台影子保留旧值，
下次置位自动对齐）；需要持久化时参照 volume 加 KV。
专注的实际判定来源（pose / 雷达 / 云端下发）待定，
接入后经 `iot_control_focus_is_on()` 消费。

## 呼吸频率与采集状态（siid=10 piid=3/4，只读）

`iot_control_breath` 每 1s 从 `radar_ld6002` 快照取数：

- `ready && human==1 && 0 < br <= 120` → 上报呼吸率（四舍五入取整）+ `ok`
- 否则只上报 `no_signal`

云端未就绪或连续上报失败时按 10s 退避重试，恢复后回到 1s。
物模型 v2 的重复定义（10.1/11.3/12.4）不登记、不上报。

## 再加一个属性

新控制项放在 `ctrl/`，在表里加一行，并把 `.c` 加进 `CMakeLists.txt`。
同一对 siid / piid 不要登记两次。
