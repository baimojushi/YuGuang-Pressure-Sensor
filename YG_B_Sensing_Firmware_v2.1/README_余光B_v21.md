# 余光 V2.1 · 感知板 B 固件

**工程**：`sensing_board/`，独立 ESP32-S3 / ESP-IDF 5.4.1。基于原始 LD6002 v8 滤波与 TF 解析模块创建独立入口。

## 已实现

- 原始 LD6002 `radar_ld6002.cpp` / `radar_resp_filter_v8.h` / `radar_tf_parser.hpp` 继续在板上处理；GPIO18 接收雷达 TX，UART 1,382,400 波特。实际接线与供电须按模组规格确认。
- **板载实时姿态（2026-11-01 新增）**：BF3901 摄像头经 `bsp_camera` 取帧 → `yolo11_pose` 跑 YOLO11n-pose（模型烧在 `coco_pose` 分区，V1）→ `pose_runtime_b` 持续循环，把模型判定折算成融合指标 P。模型给出 `FRAME_OK` 记 P=100、`FRAME_BAD_POSTURE` 记 P=30；`NO_PERSON`/`UNKNOWN`/结果超 1.5 s 未刷新一律 `p_ok=false`，不伪造。
- BLE Peripheral 自定义 GATT（服务、呼吸、压力、状态、控制、ACK），固定 20/8 B 帧、协议版本和长度检查、5Hz 呼吸采样、1Hz 传感器状态、压力事件 1s 重试最多 5 次、10s TTL、收到 ACK 清除。
- 使用 3D 模型：`S=0.40R+0.35P+0.25F`。只有 **三项归一化质量门控都有效且更新时间在 1.5 s 内**，才启用压力事件判定。外部本地模型通过 `main/yg_b_sensor_inputs.h` 向运行时提交数据。
- 呼吸方向尚未通过样本校准，因此报文固定 `stage=0`（未知），避免伪造吸/呼阶段。Demo 端只记录意向，默认不调用外部 API，也不上传私有数据。
- GPIO14 按住低电平至少 2s 打开 120s 本地配对窗口；需与 A 的 `ygble pair 120` 配合。

## 构建/测试

```bash
# 主机端（gcc/g++，协议、融合及雷达解析）
sh tests/test_host.sh

# ESP-IDF 5.4.1 配置完整工具链后
idf.py set-target esp32s3
idf.py build
idf.py -p <串口> flash monitor
```

**构建前置（`sdkconfig.defaults` 已含，删掉 sdkconfig 后自动生效）**：16 MB flash、8 MB OCT PSRAM（120 M）、自定义分区表 `partitions.csv`、`ESP_VIDEO_ENABLE_SPI_VIDEO_DEVICE`、`CAMERA_BF3901` 系列、coco_pose 模型烧到 `coco_pose` 分区且**只打包 V1**（V2 的 Kconfig 默认 y，必须显式关闭，否则打包出 6.22 MB 超出 3200K 分区）。

**一次烧录写 4 段**：`bootloader.bin`@0x0、`partition-table.bin`@0x8000、`yg_b_sensing_v21.bin`@0x10000、`coco_pose.espdl`@0x510000（`idf.py flash` 会按 `flash_args` 自动带上）。`nvs` 仍在 0x9000/24K，换分区表不会清掉 BLE 绑定。

## 尚需完成（禁止误判）

1. **专注 F 仍无算法来源（姿态已于 2026-11-01 补齐）**：姿态链路已移植完成（`bsp_camera` + `yolo11_pose` + `pose_runtime_b`，模型烧在 `coco_pose` 分区），能自算 P。但业务工程里的「深度专注」只是云端下发的布尔开关（siid 10 / piid 2），源码注释即写明「专注的实际判定（pose/雷达/云端下发）尚未接入」，**没有任何本地判定算法**。因此 `f_ok` 恒为 false，而 `yg_fusion_step()` 要求 R/P/F 三项全有效 → **压力回落事件目前仍不会触发**。需要先确定 F 的来源：①用连续合格坐姿时长派生；②用雷达呼吸规律性派生；③放宽融合门槛改为 R/P 两路加权（会改动 `yg_fusion.c` 契约）。在确定来源前禁止伪造 F。
2. **Demo HTTPS 适配**：需求包含明确本地授权、合法凭据、仅传去隐私特征。当前无真实 HTTPS 上传，传入的 Demo 意向保持在 BLE 内存中，不等于用户已授权。
3. **实际编译/烧录与链路验收**：本环境缺少 Xtensa 编译器及 ESP32-S3 实机；B GATT 与 A 并发协作只能在硬件上验证。
4. **首次设备身份确认**：Just Works + 绑定不提供完整中间人防护，部署前须补充受信任的设备身份建立方式。

完整冻结报文及云端权限边界参见 `YG-IFACE-2.1.0_冻结摘要.md`。
