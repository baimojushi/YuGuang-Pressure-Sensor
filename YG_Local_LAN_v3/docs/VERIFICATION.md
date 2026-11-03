# 验证矩阵 / 当前事实边界

## 已在无硬件的本地环境检查

- [x] 原源码包解压并核对 A/B/C 结构与 GPIO 配置
- [x] 保留 B 板 BF3901、LD6002 源码，移除端侧姿态+BLE+云业务代码入口
- [x] 新的本地 PC 服务可解析原始 UYVY + 相位的 YG01 报文
- [x] 局域网 token 鉴权、错误长度、错误设备 ID、序列重复拒绝
- [x] 上半身跟踪指令：限幅、死区、找不到人不乱动、多人短期目标粘滞
- [x] 5 秒 JSON 汇总、JSONL 记录、无模型标为不可用
- [x] 测试波形验证 20Hz、12 次/分钟、90s 的变异性计算
- [x] Python 语法检查与 `pytest` 主机自动测试（13 项）

## 仍需要 Windows / 硬件验证（不能省略）

- [ ] ESP-IDF **5.4.1** `idf.py set-target esp32s3 && idf.py build`、烧录、UART 启动日志
- [ ] 确认真实 XJWB03 具有原 B 源码需要的 **8MB OCT PSRAM**，堆空间足够
- [ ] camera I2C 识别 BF3901，V4L2 `VIDIOC_DQBUF bytesused == 153600` 并能正确显示颜色、方向；若原驱动有 SPI 行头，需修复帧解码后再联调
- [ ] 雷达 LD6002 UART 在 GPIO18 有 CRC 合法帧、相位时间序列连续、模块波特率实际一致
- [ ] Windows ONNX/TFLite 模型单帧检测 240×320 画面的上半身，确认关键点置信度与人物在画面的位置
- [ ] 第一次舵机上电拆掉摇臂，GPIO48 输出 50Hz PWM，方向和有效转角符合机械臂需求
- [ ] 摄像头与雷达一体转向；左侧/右侧偏移后人物回到画面中心，且无机械限位冲撞
- [ ] 人物丢失、局域网断开、TCP 超时、模型异常、两个人同时出现均保持安全角度
- [ ] 本地连续 2 小时运行：丢帧、Wi-Fi 回连、PSRAM 峰值、相位丢点、CPU 温度、伺服电流
- [ ] 可选高速 PC 眼摄像头识别眨眼的真实帧率与照度，不能拿 S3 1FPS 画面代替
- [ ] 真实个人基线、被试授权、临床或研究标签及独立对象验证；未验证不得把打分称为真实心理压力
- [ ] Windows 端运行 `scripts/build_windows.ps1`，在目标 PC 上验证 EXE 模型加载和 GPU provider

## 失败排查

| 现象 | 优先排查 |
|---|---|
| HTTP 401 | PC/S3 设备 token 不一致，绝不降级为无鉴权 |
| HTTP 422 | 原始帧像素长度、数据头、width×height、设备时间戳或 packet 版本 |
| Camera size invalid | 原 `bsp_camera.c` 中 SPI 数据帧头、V4L2 preprocessing 或 GPIO 接错 |
| PC `model_unavailable` | 未放 ONNX/TFLite 权重；未安装对应 Python 推理运行时 |
| 舵机朝远离人物方向转 | `YG_SERVO_DIRECTION` 设为 -1，不要通过交换电源线改方向 |
| Servo hold | 可能是中心死区、目标丢失、无模型、帧重复或局域网超时（看 ACK reason） |
| 呼吸 CV 长期 warming_up | 原始相位不足 60s、采样数不足、雷达未检测有人或人体运动 |
| 上半身姿态不稳定 | 240×320 太低 / 摄像头视角不合理 / 椅子遮挡肩膀；建议先验证更高分辨率 PC 摄像头 |
