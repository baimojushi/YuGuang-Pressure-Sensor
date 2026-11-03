# 余光 V2.1 · ABC 三端交付说明

> 生成日期：2026-11-01　对应包：`YG_ABC_src_20261101.zip`
> 本文件对应验收清单 ①②③④⑤ 五条，逐条标明「已具备 / 需你补充」。

---

## 0. 一句话总览

余光是一套 **冥想室呼吸引导装置**，分三端：

| 端 | 职责 | 硬件 |
|---|---|---|
| **A 业务板** | 联网、云端对话、灯效、与 B 配对、物模型上报 | ESP32-S3 + VB701N 语音模块 + WS2812 + 舵机/振动马达 |
| **B 感知板** | 毫米波雷达生命体征、摄像头姿态、BLE 上报 | ESP32-S3 + LD6002 雷达 + BF3901 摄像头 |
| **C 平台 Web** | 平台 H5（云端托管）+ 本地控制面板 + 服务端 | 微信小程序 web-view / 浏览器 |

数据流：B（雷达+姿态）──BLE──> A ──MQTT──> 灵机云 ──> C（H5/面板）

---

## ① 完整硬件工程 —— ✅ 已具备

### 包含内容

| 端 | 路径 | 关键内容 |
|---|---|---|
| A | `YG_A_Business_Firmware_v2.1/` | `apps/`（`main/` 全部源码、`managed_components/` 63 MB、`sdkconfig`、`sdkconfig.defaults`、`partitions.csv`、`dependencies.lock`）、`qumios-dev/`、`components/agora_iot_sdk`、`apps/main/pose/private/`（coco_pose 模型 5 个 `.espdl`） |
| B | `YG_B_Sensing_Firmware_v2.1/` | `main/`（19 个源文件）、`components/`（`esp-dl`、`dl_fft`、`coco_pose` 含 s3 模型 + 7 个 `espressif__*`）、`partitions.csv`、`sdkconfig`、`sdkconfig.defaults`、`dependencies.lock` |
| C | `YG_C_Platform_Web_v2.1/` | `webapp/`（服务端 + 静态资源）、`panel/`（控制面板全部源码）、`contracts/thing_model/`（物模型定义） |

### 模型与运行资源（都已随包）

- `coco_pose/models/s3/coco_pose_yolo11n_pose_s8_v1.espdl` — **3,103,472 B**，YOLO11n-pose，INT8
- A 端另有 s3/p4 共 5 个 espdl（历史版本，约 15 MB）
- B 端 `components/` 已含全部预编译库，**构建不需要联网**

### 不含（需你按说明自行获取）

| 缺什么 | 原因 | 怎么补 |
|---|---|---|
| ESP-IDF 5.4.1 本体 | 体积大，通用依赖 | 见 ② 的版本与路径 |
| ESP-ADF（A 端需要） | 同上 | 同上 |
| 板卡原理图 / PCB | 硬件设计文件不在代码库 | 需你提供 |

### 许可证

A 端保留 36 个 LICENSE，B 端 9 个，C 端 523 个（含 node_modules 内的）。详见第 ⑤ 节来源清单。

---

## ② 编译与烧录、板卡与接线 —— ✅ 已具备（本文件即汇总）

### 2.1 工具链版本

| 项 | 值 |
|---|---|
| 芯片 | **ESP32-S3 (QFN56) rev v0.2**，双核 240 MHz |
| Flash | **16 MB**（quad, 3.3V） |
| PSRAM | **8 MB OCT @120 MHz** |
| ESP-IDF | **5.4.1**，路径 `D:\yuguang_fw\ljyd_xjwb03_agent_public_developer\esp-idf` |
| ESP-ADF | 需 `ADF_PATH` 环境变量（A 端 esp-sr 组件依赖） |
| Python 环境 | `D:\.espressif\python_env\idf5.4_py3.12_env`（Python 3.12.0） |
| 工具链 | `xtensa-esp-elf esp-14.2.0_20241119`、cmake 3.30.2、ninja 1.12.1 |
| Node（C 端） | **≥ 22.13**（webapp）；面板用 Vite 5 |

**必须设置的环境变量（Windows cmd）**

```bat
set "IDF_TOOLS_PATH=D:\.espressif"
set "PYTHONUTF8=1"
call "D:\yuguang_fw\ljyd_xjwb03_agent_public_developer\esp-idf\export.bat"
```

> ⚠️ **工程路径必须是纯 ASCII**。中文路径会让 ccache 抛 `Illegal byte sequence`、链接阶段 `ld returned 116`。本包三端目录均在 ASCII 路径下。

### 2.2 构建与烧录

**A 端**（工程在 `apps/`）

```bat
cd /d <包路径>\YG_A_Business_Firmware_v2.1\apps
idf.py build
idf.py -p COM11 flash
```

分区表 `apps/partitions.csv`（16 MB）：

| 分区 | 偏移 | 大小 | 用途 |
|---|---|---|---|
| nvs | 0x11000 | 48 K | 配网凭据、BLE 绑定、音量 |
| otadata | 0x1D000 | 8 K | OTA 启动选择 |
| phy_init | 0x1F000 | 4 K | PHY 初始化 |
| ota_0 | 0x20000 | 4032 K | 应用固件 |
| ota_1 | 0x410000 | 4032 K | OTA 备份 |
| lvgl | — | 64 K | 未使用（占位） |
| **coco_pose** | 0x810000 | 3200 K | 姿态模型 |
| spiffs_data | 0xB30000 | 1024 K | 文件系统 |
| **model** | 0xC30000 | 3072 K | esp-sr 唤醒词模型 |

**B 端**（独立工程，根目录即工程）

```bat
cd /d <包路径>\YG_B_Sensing_Firmware_v2.1
del sdkconfig            :: 让 sdkconfig.defaults 生效（首次或改配置后）
idf.py build
idf.py -p COM12 flash
```

`partitions.csv`（16 MB）：

| 分区 | 偏移 | 大小 | 用途 |
|---|---|---|---|
| nvs | 0x9000 | 24 K | BLE 绑定（保持原偏移，换表不清绑定） |
| phy_init | 0xf000 | 4 K | PHY 初始化 |
| factory | 0x10000 | 5120 K | 应用固件 |
| **coco_pose** | 0x510000 | 3200 K | 姿态模型 |

一次烧录写 **4 段**（`idf.py flash` 自动带上）：

```
0x0       bootloader.bin
0x8000    partition-table.bin
0x10000   yg_b_sensing_v21.bin
0x510000  coco_pose.espdl
```

> ⚠️ B 端有个坑：`coco_pose` 的 `FLASH_COCO_POSE_YOLO11N_POSE_S8_V2` 在 Kconfig 里 **default y**，只写 V1=y 会打包出 6.22 MB 超出 3200 K 分区，且**构建不报错**。`sdkconfig.defaults` 已显式关闭 V2，产物应为 3,103,472 B。

**C 端**见 ③。

### 2.3 板卡与外设型号

| 部件 | 型号 | 接哪端 | 接口 |
|---|---|---|---|
| 主控 | ESP32-S3-DevKit（QFN56, 16 MB/8 MB） | A、B 各一块 | — |
| 语音模块 | **VB701N**（固件 1.1.7） | A | UART + I2S，原厂 55AA 协议 |
| RGB 灯带 | **WS2812** × 8 | A | 单线 RMT |
| 舵机 | 标准 PWM 舵机 | A | 50 Hz PWM |
| 振动马达 | 直流马达 + LEDC PWM | A | GPIO PWM |
| 毫米波雷达 | **海凌科 LD6002**（呼吸/心率，协议 V1.2） | B | UART 1,382,400 |
| 摄像头 | **BF3901**（240×320 UYVY） | B（A 端代码保留但已关闭） | 1-bit SPI |
| USB 串口 | CH343（VID:PID = 1A86:55D3） | A / B | — |
| 配对/解绑按键 | 轻触开关 | A（解绑）、B（配对窗） | GPIO 低有效 |

### 2.4 GPIO 接线表

**A 端**（来源：`apps/main/qm_config/qm_config.h`、`peripheral/bsp_*.h`）

| GPIO | 功能 | 备注 |
|---|---|---|
| 38 / 39 / 40 | VB701N FLOW / RX / TX | UART1 @ 2,000,000 |
| 43 / 44 | 日志 UART0 TX / RX | 115,200 |
| 1 | WS2812 灯带数据 | 8 颗 |
| 48 | 舵机 PWM | 50 Hz / 14-bit |
| 0 | 振动马达 | LEDC |
| 14 | 复位 / 解绑按键 | 低有效 |
| 21 / 47 | 摄像头 I2C SDA / SCL | 摄像头当前关闭 |
| 4 / 13 / 8 / 41 | 摄像头 VSYNC / PCLK / D0 / PWDN | 摄像头当前关闭 |
| 18 | （A 端雷达已移除） | 雷达职责转 B 端 |

**B 端**（来源：`main/bsp_camera.h`、`main/radar_ld6002.h`、`main/main.c`）

| GPIO | 功能 | 备注 |
|---|---|---|
| **18** | LD6002 雷达 RX | UART2 @ **1,382,400** |
| 21 / 47 | BF3901 I2C SDA / SCL | I2C0 |
| 4 | BF3901 VSYNC（接驱动 CS） | 1-bit SPI |
| 13 | BF3901 PCLK（接驱动 SCLK） | 1-bit SPI |
| 8 | BF3901 D0（接驱动 DATA0） | 1-bit SPI |
| 41 | BF3901 PWDN | 低有效，软件拉低 |
| 14 | BLE 配对按键 | 按住 ≥2 s 开 120 s 配对窗 |
| 43 / 44 | 日志 UART0 | 115,200 |

> 接线表以**代码宏**为准。实物照片需你补充（清单第②条允许文字+照片，我无法代拍）。

---

## ③ 完整软件工程 —— ✅ 已具备

### C 端 webapp（服务端 + 平台 H5 静态资源）

```bat
cd YG_C_Platform_Web_v2.1\webapp
npm ci                    :: 有 package-lock.json
copy .env.example .env    :: 按需改
npm start                 :: 默认 http://localhost:3100/
npm test                  :: node --test tests/*.test.js
```

- 依赖：`express ^5.1.0`、`multer ^2.0.2`、`pg ^8.23.1`；Node **≥ 22.13**
- 环境变量（`.env.example` 已列全）：`PORT`、`DATA_DIR`、`LIVE_STORAGE`、`SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`SUPABASE_AUDIO_BUCKET`、`CARE_ACK_BRIDGE_SECRET`、`CARE_DISPLAY_BRIDGE_SECRET`、`VOICE_READ_BRIDGE_SECRET`、`LIGHT_MAPPER_URL`、`LIGHT_MAPPER_TOKEN`
- 三个 `*_BRIDGE_SECRET` 必须 ≥32 位随机字符，仅服务端持有，**不要写进前端或 git**
- 未配置 Supabase 时自动回落本地 SQLite，数据目录默认 `./data-v2`

### C 端 panel（控制面板）

```bat
cd YG_C_Platform_Web_v2.1\panel
npm install --prefer-offline     :: 见下方私有源说明
npm run dev                      :: 开发
npm run build:prod               :: 生产构建（产出 dist）
```

- 技术栈：Vue 3 + Vite 5 + TypeScript + Pinia + Element Plus
- 依赖清单：`package.json` + `package-lock.json`（287 KB）
- 环境文件：`.env.example` / `.env.dev` / `.env.prod` / `.env.test` / `.env.v21.example`（**均为 `VITE_` 前缀的公开配置，不含密钥**）
- 门禁开关：`VITE_YG_ENABLE_SIID19`、`VITE_YG_ENABLE_SIID19_LIGHT_PREVIEW`

> ⚠️ **私有源断供**：`xjiang-ui@1.1.0`、`xjiang-sdk@1.0.0` 来自 `nexus.ljyd.cn`，目前网络不可达。绕过办法：从 `余光开发\ui例程\ai-lamp\private-cloud-h5\node_modules\` 复制这两个包到 `panel\node_modules\`，再 `npm install --prefer-offline`。**不要用 `npm ci`**，它会先清空 `node_modules`。

> ⚠️ `node_modules` 未随包（219 MB，可由锁文件重建）。

### 平台 H5 部署要点（踩过的坑）

1. 灵机平台对上传 zip 做**静态解压托管**，不执行 `npm build` → 必须上传**构建后的 dist**
2. 必须**扁平化（零子目录）**，`static/` 子目录在平台侧会整体丢失
3. 必须**关闭 CSS 代码分割**（`cssCodeSplit: false`），否则生成指向不存在 `css/` 的预加载路径导致白屏
4. 上传包 **≤ 15 MB**

---

## ④ 灵机平台配置 —— ⚠️ 部分具备，需你补充

### 已随包（代码侧可导出的部分）

| 项 | 位置 | 说明 |
|---|---|---|
| 设备功能定义（物模型） | `contracts/thing_model/` | `siid19_registered.json`（正式录入版，带 dataValue 如 GuidePeriod unit=100ms）、`siid19_adapter.json`、`local_thing_model_v3.json` |
| 面板与宿主的通信契约 | `webapp/` + `panel/src/` | `xjiang-sdk` 调用点、WS 方法名、`suixi_LightPreviewCommand` 等字段 |
| 云↔Web 回执链路 | `webapp/care-displayed.mjs`、`care-downlink.mjs` | 签名回执协议 |
| Agent 项目速览 | `panel/agent.md`（192 行） | 项目结构/宿主通信说明，**不等于平台智能体提示词** |

### 需你在灵机平台后台导出（我没有平台访问权限）

1. **智能体提示词**（system prompt / 人设 / 工具说明）
2. **工作流编排**（节点、分支、触发条件）
3. **插件/能力配置**（调用了哪些插件、参数映射）
4. **知识库**（实际使用的文档清单与版本）
5. **一次真实调用的完整记录**：
   - 触发方式（用户说了什么 / 点了什么）
   - 返回结果（智能体回复原文）
   - 设备反馈（A 端串口日志片段 + 灯/音频的实际表现）

> 建议至少提供第 5 项的**一条端到端实录**，验收方通常最看重这个。

---

## ⑤ 功能现状与第三方来源 —— ✅ 已具备（本文件）

### 5.1 已跑通（有实测证据）

| 功能 | 端 | 证据 |
|---|---|---|
| VB701N 音频链路 | A | 版本握手 1.1.7、roundtrip 13 ms、MIC PCM 会话门控生效 |
| QUMIOS 配网 + 灵机云 MQTT | A | `dynreg pid=11879` → `cloud connected` |
| WS2812 灯效（随息/引导/亲友） | A | 本地优先级呈现 |
| siid 19 六属性物模型 | A+C | `contracts/thing_model/siid19_registered.json` 正式录入 |
| LD6002 雷达 V1.2 解析 | B | `0x0A14/0x0A15/0x0A16` 三消息解析，`bad=0`，约 50 帧/秒 |
| BLE 广播 + 自定义 GATT | B | 12 s 扫描命中服务 UUID 56 次，RSSI −35~−46 dBm |
| 3D 融合算法 | B | `S=0.40R+0.35P+0.25F`，主机端单测 `tests/test_host.sh` |
| 姿态链路（YOLO11n-pose） | B | **构建通过**，模型 3,103,472 B 正确入分区；**未上板验证** |
| 面板构建 + 平台部署 | C | webapp 91/91 测试通过；panel `build:prod` 成功 |
| 文本灯语 + 浏览器朗读 | C(panel) | 本地实现，仅屏幕预览 |
| 19.7 真机灯语试播 | C+A | 已实现，**门禁默认关闭** |

### 5.2 未跑通 / 已知问题

| # | 问题 | 端 | 影响 |
|---|---|---|---|
| 1 | **专注 F 无算法来源** | B | 业务工程「深度专注」只是云端布尔开关，无本地判定 → `f_ok` 恒 false → **压力回落事件永远不触发** |
| 2 | **姿态未上板验证** | B | 烧录时 COM12 USB 掉线，模型加载/PSRAM/摄像头出帧均未实测 |
| 3 | A 端 BLE Central 与 B 并发 | A+B | 仅代码就绪，未实机验证多设备并发 |
| 4 | A 端 4 个观察项 | A | 含 `report failed` 等，见 `验证_固件V2.1.md` |
| 5 | vendor 云适配器未自建 | C | webapp 不含可上线的厂商云适配器，需自建 Web→A / A→Web 双向链路 |
| 6 | 平台配置未归档 | 平台 | 见 ④ |
| 7 | 三端均无 git 仓库 | 全部 | 只能靠 `.bak` 与本 zip 回溯版本 |

### 5.3 用的官方 / 第三方代码、模型、素材

| 名称 | 用途 | 来源 | 许可证 |
|---|---|---|---|
| ESP-IDF 5.4.1 | 基础框架 | Espressif | Apache-2.0 |
| ESP-ADF | 音频框架（A 端） | Espressif | Apache-2.0 |
| **esp-dl 3.2.4** | 神经网络推理 | github.com/espressif/esp-dl | MIT |
| **coco_pose / YOLO11n-pose** | 人体姿态模型 | esp-dl 模型库 | MIT |
| esp_video 2.2.0 / esp_cam_sensor 2.2.0 | 摄像头驱动 | Espressif | Apache-2.0 |
| esp_new_jpeg 1.0.2 / esp-dsp 1.8.2 | 图像/信号处理 | Espressif | Apache-2.0 |
| esp-sr 2.0.4 | 本地唤醒词（A 端，当前关闭） | Espressif | Espressif License |
| 78/esp-opus 1.0.5 | Opus 编解码 | registry.espressif.com | BSD |
| agora_iot_sdk | 云端语音对话（A 端） | Agora | Agora SDK License |
| QUMIOS / qumios-dev | 灵机设备框架 | 灵机（供应商） | 供应商授权 |
| xjiang-ui 1.1.0 / xjiang-sdk 1.0.0 | 面板 UI 与宿主 SDK | 灵机 nexus.ljyd.cn | 供应商授权 |
| LD6002 通信协议 V1.2 | 雷达协议参考 | 海凌科 Hi-Link 官方文档 | 厂商文档 |
| BF3901 | 摄像头模组 | 采购件 | 厂商规格书 |

> 上述 LICENSE 文件**均已保留在包内对应目录**（A 36 个、B 9 个、C 523 个），未删除。

### 5.4 演示怎么跑

**纯软件演示（无需硬件）**

1. C 端 `webapp`：`npm ci && npm start` → 浏览器开 `http://localhost:3100/`，可用 `/demo` 展示版看界面与交互
2. C 端 `panel`：`npm install --prefer-offline && npm run dev` → 面板 UI、灯语试播、文本灯语与朗读（朗读走浏览器 TTS）

**带硬件演示**

1. A 端烧录 → 手机小程序配网 → 云端上线
2. B 端烧录 → 按住 GPIO14 两秒开配对窗 → A 端 `ygble pair 120` 完成绑定
3. 人坐在雷达前 → A 端 WS2812 随呼吸节律变化
4. 面板查看 `10.3` 呼吸率、`19.2` 引导状态等属性

---

## 附：本包目录结构

```
YG_ABC_src_20261101.zip
├── 00_DELIVERY_README_ABC_20261101.md   ← 本文件
├── YG_A_Business_Firmware_v2.1/
├── YG_B_Sensing_Firmware_v2.1/
└── YG_C_Platform_Web_v2.1/
```

已排除（可重建）：`apps/build`（348 MB）、`apps/managed_components.bak`（61 MB）、`build`（332 MB）、`panel/node_modules`（219 MB）。
