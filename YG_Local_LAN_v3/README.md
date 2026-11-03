# 余光 YG Local LAN v3.0 — ESP32-S3 传感端 + Windows 本地推理端

> **本项目是依据 `YG_ABC_src_20261101.zip` 做的本地局域网重构源码，而不是已经烧录验收的生产固件。**
> 2026-11-03。主机端的协议、跟踪、姿态后处理、呼吸计算和 HTTP **13 项测试**已通过；**由于当前环境没有 ESP-IDF 5.4.1 Xtensa 工具链、真实 XJWB03、BF3901、LD6002、SG90 和模型权重，未完成 ESP32 交叉编译、真实取像、舵机、GPU/EXE 的实机测试。**

## 1. 改造目标与已剔除功能

原压缩包分为 A 业务板（云/语音/LED/舵机）、B 感知板（BF3901/LD6002/端侧 YOLO/BLE）、C 平台网站。新版为：

```text
BF3901 SPI 1bit Camera ─┐
                        ├─ ESP32-S3 (XJWB03) ── 2.4 GHz LAN Wi-Fi ── Windows PC
LD6002 radar UART ──────┘        │                              │
                                 │    POST /v1/ingest             │
                                 │    Raw UYVY + phase samples    ├─ YOLO11 ONNX or MoveNet TFLite
                                 │    + 64-bit device timestamps  ├─ respiration variability (CPU)
                                 │                               ├─ optional separate USB eye camera
                                 │    HTTP ACK + servo target     ├─ multi-modal observable features
                                 └─ GPIO48 SG90 PAN ◀────────────┘─ 5 s JSON reports
```

**删除**：A/B BLE 双板桥接、灵机 PID/SECRET、云账号/AGENT、MQTT 控制、Tailscale Funnel、公网入口、云端 Web/H5、云平台灯语与语音远控。**保留与迁移**：BF3901 SPI 采图、LD6002 高速 UART + v8 雷达滤波和原始相位、SG90 PWM 伺服控制。摄像头和雷达须固定在同一可旋转模组上，才能通过转动摄像头的视角同时对准雷达。

新增的 **PC→S3 闭环**：电脑每收到一帧即算出人的上半身水平目标位置，回传安全角度；ESP32-S3 保证 GPIO PWM 平滑、限位、丢失目标保持/断网保持。只实现单轴水平追踪；如果要跟踪高低方向，需要第二舵机和新的俯仰机构。**约 1FPS 只适合慢速人物移动，不能保证任何时刻都严格对准。**

## 2. 目录结构

```text
sensor_esp32s3/
  CMakeLists.txt, partitions.csv, sdkconfig.defaults
  main/
    app_main.c               # 初始化采集 + USB 不参与传输
    bsp_camera.c/.h          # 移植原 B 板 BF3901 SPI/V4L2 采集
    radar_ld6002.cpp/.h      # 移植原 B 板高速 TF / 相位解析，增加相位环缓冲
    radar_resp_filter_v8.h   # 保留原始雷达 v8 滤波实现
    radar_tf_parser.hpp      # 保留原始 LD6002 TF 解析
    wifi_sta.c/.h            # 纯 2.4GHz Wi-Fi STA，不连云
    lan_client.c/.h          # 自定义有界二进制协议，上传到局域网 PC
    servo_tracking.c/.h      # 新 ESP-IDF LEDC PWM 50Hz + 防抖/限幅/保持
    Kconfig.projbuild        # Wi-Fi、主机 URL、设备令牌、舵机角度等
  components/                # 从原 B 板复制、只保留相机所需托管组件
pc_inference/
  run.py, server.py           # FastAPI 局域网服务 + 本地仪表盘
  protocol.py                # 二进制收包和校验
  pose_backend.py            # YOLO11 Pose ONNX 或 MoveNet TFLite -> COCO17
  tracking.py                # 锁定单人、中心死区、最大步进、失踪保持
  respiration.py             # 相位插值 + 带通滤波 + 逐呼吸间隔 CV
  eyes.py                    # 可选电脑直连高速 USB 摄像头，眨眼/闭眼特征
  features.py                # 观察型上半身特征
  psychology.py              # 仅启用经过验证的自训练分类器
  settings.py                # 本地环境变量
  scripts/export_yolo11_pose.py
  scripts/train_state_model.py
  scripts/build_windows.ps1
  tests/
docs/
  HARDWARE_AND_SAFETY.md
  PROTOCOL.md
  VERIFICATION.md
```

## 3. 电脑端 Windows 部署（先做这一部分）

推荐 Windows 10/11 x64、Python **3.11**、至少 16 GB RAM；一位被试和低帧率 YOLO11n-pose 一般不需要 24 GB 显存。模型推理速度与效果需要在实际 PC 上测试。

```powershell
cd pc_inference
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**需要自行放入姿态权重**，源码包没有可供 Windows ONNX Runtime 运行的 `.onnx` 文件：

- 选项 A：使用合法取得的 YOLO11n-pose ONNX 权重（建议在开发机按 `scripts/export_yolo11_pose.py` 导出），放入 `pc_inference/models/yolo11n-pose.onnx`。**Ultralytics 相关权重/代码存在 AGPL/企业许可要求；闭源商用不得直接默认可用**。
- 选项 B：使用可商用授权已确认的 Google MoveNet Lightning `.tflite` 权重，自行安装 `tensorflow`，然后 `YG_POSE_ONNX` 指向此 `.tflite`。模型代码采用同样 COCO17 输出，权重仍须逐项审查许可证；该路径适合不采用 YOLO 授权链的产品。

配置 PowerShell 环境变量，**将令牌换成随机生成的长字符串**，并在 S3 端配置完全相同的字符串：

```powershell
$env:YG_DEVICE_ID="sensor01"
$env:YG_DEVICE_TOKEN="REPLACE_WITH_RANDOM_TOKEN"
$env:YG_POSE_ONNX="C:\your_path\pc_inference\models\yolo11n-pose.onnx"
$env:YG_HOST="0.0.0.0"
$env:YG_PORT="8000"
$env:YG_ROTATE_DEGREES="0"          # 相机若倒装可设 90/180/270
$env:YG_SERVO_DIRECTION="1"          # 人在画面右方而舵机反向转：改 -1
python run.py
```

电脑在浏览器打开 `http://127.0.0.1:8000/`，输入令牌，查看每 5 秒更新的报告。诊断接口：`GET /v1/health`；JSON 接口：`GET /v1/report/sensor01`（需 `X-Device-Token`）。报告也自动写到 `reports/sensor01.jsonl` 和 `reports/sensor01_latest.json`。

**Windows 防火墙**：只允许 S3 的局域网 IP 访问 8000，例如管理员 PowerShell：

```powershell
New-NetFirewallRule -DisplayName "YG sensor" -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort 8000 -RemoteAddress 192.168.1.50
```

可用时尽量用 **PC→路由器有线、S3→路由器 2.4GHz Wi-Fi**，避免公网上传。若只需测试 HTTP，不配置姿态模型也可启动，但会报告 `model_unavailable`，舵机不会被假坐标驱动。

**可选眼部摄像头**：每秒 1 帧的 BF3901 图像无法可靠测眨眼。另接一台电脑 USB 摄像头，运行 `pip install -r requirements-optional.txt` 后将 `YG_EYE_CAMERA_INDEX` 设置为摄像头编号（通常 `0`），可获取较粗的眼睑开合/眨眼频率；不支持精密眼球轨迹或未标定的注视点。

## 4. ESP32-S3 构建与烧录

本工程按**原 B 板采用的 ESP-IDF 5.4.1 + ESP32-S3 + 16MB Flash / 8MB OCT PSRAM**配置保留本地相机组件。务必确认你的 XJWB03 实际有该 PSRAM 配置。进入 ESP-IDF 5.4.1 环境后：

```powershell
cd sensor_esp32s3
idf.py set-target esp32s3
idf.py menuconfig
# 在 YG Local LAN Sensor 菜单填写：
# SSID / PASSWORD / SERVER_URL / DEVICE_ID / DEVICE_TOKEN / SERVO_GPIO
idf.py build
idf.py -p COMx flash monitor
```

典型 `SERVER_URL` 是 `http://192.168.1.100:8000/v1/ingest`，应使用电脑实际 LAN 地址；**不是** `127.0.0.1`。旧固件包含 `coco_pose` 模型分区，而新固件明确删掉模型分区；如变更分区表，须核对烧录日志中的实际 partition table 和 `factory` app 地址。`sdkconfig` 含 Wi-Fi/设备令牌，**不要上传到公开仓库**。

**上电调试顺序**：先不装舵机摆臂、仅接摄像头/雷达；确认相机 `frame... good`、雷达 `valid_frames` 增长、HTTP 200 和 PC 画面推理后，再单独接 SG90 红色 5V 正极、棕色 GND、橙色 PWM 进行定角校准。外部 5V 电源与 S3 共地，但不能把 5V 接至 3V3 端。

## 5. 默认节奏、输出与约束

| 维度 | 默认 | 备注 |
|---|---|---|
| 摄像头 | BF3901 240×320 UYVY；S3 每约 1000ms 上传最近帧 | 1.23 Mbps 原始像素（不含协议） |
| 雷达 | LD6002 GPIO18 RX，1,382,400 波特 | 相位帧入环形缓冲，按帧批量上传 |
| 追踪 | PC 每成功处理一帧返回一个角度或 hold | 舵机 30–150°，每 40ms 最多走 2° |
| 呼吸 | PC 保留最多约 180s 波形 | 至少 60s/6个呼吸间隔再计算 CV |
| 状态报告 | 每 5s 一个 JSON | 数据不足则显式 unknown / warming_up |
| 眼部 | PC USB 30FPS 可选 | 不把 S3 的 1FPS 当眼动仪 |
| 压力/心理 | 默认 unknown；可加载单独验证过的分类器 | 不将姿态/雷达直接宣称临床心理压力 |
| 断网或找不到人 | Servo hold | 不作无目标自动扫射/搜寻 |

`YG_UPLOAD_INTERVAL_MS` 可在 Kconfig 调成 **200 ms（目标 5FPS）**来提高追踪实时性，但请先确认当前 SPI 图像缓冲**确实是 153,600 字节干净的 UYVY**，并测试 Wi-Fi、PSRAM 与推理端实际延迟。5FPS 原始像素约需 6.14Mbps，不保证所有实际 S3 设备和 PC 都能持续达到。

## 6. 本地测试与 EXE

```powershell
cd pc_inference
pip install -r requirements-optional.txt
python -m pytest -q tests
```

在 Windows 构建无需 Python 解释器即可启动的 EXE 文件（PyInstaller `--onedir`）：

```powershell
.\scripts\build_windows.ps1
# 产物 dist\YGLocalInference\YGLocalInference.exe
```

此处提供了完整**封装脚本**，但本环境不是 Windows，无法生成或验证 Windows EXE。模型文件、设备令牌、摄像头驱动与 GPU 驱动需要按部署机配置。YOLO 使用 ONNX CPU 默认可启动，CUDA provider 的实际配置和性能需自行验收。

## 7. 不能跳过的硬件确认

1. **原 B 摄像头驱动的 `bytesused` 注释明确提到 SPI 数据可能存在帧头/行头**。新版仅接受长度严格等于 `width × height × 2` 的帧；如果串口持续报尺寸异常，应先调试 `esp_video` 的数据预处理/自动解码，禁止盲目截断后上报。这是当前最大硬件风险。
2. BF3901 仍采用原 B 板的 VSYNC→GPIO4 作为 SPI CS、PCLK→13、D0→8、SDA→21、SCL→47、PWDN→41；**舵机使用 GPIO48**，但应实测板上 GPIO48 确实可用且未复用。
3. 雷达串口波特率、协议版本与 2.8V 摄像头板供电配置来自原源码。实际 LD6002 和 BF3901 的接线、供电、电平需以模块实物及原理图复核。
4. SG90 依机械支架负载，必须测量可达角度和控制正反方向；S3 的 GND 不应承担电机回流大电流。
5. 原 B 板内置姿态模型 `.espdl` 不能直接当作 ONNX 权重给 Windows 使用。必须提供单独的 PC 端 `.onnx` 或 `.tflite` 模型文件。

更多电路与同步边界见 `docs/HARDWARE_AND_SAFETY.md`，协议见 `docs/PROTOCOL.md`，实际测试清单见 `docs/VERIFICATION.md`，商业部署许可核查见 `docs/LICENSE_REVIEW.md`。
