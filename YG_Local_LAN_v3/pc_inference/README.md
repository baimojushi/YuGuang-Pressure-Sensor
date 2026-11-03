# 电脑推理端

部署、鉴权和 EXE 步骤请先阅读上级 `../README.md`。

- 默认走 `YG_POSE_ONNX=.onnx` YOLO11n-pose；也支持 `YG_POSE_ONNX=.tflite` MoveNet，需额外安装 TensorFlow。**两类权重均不包含在包里**。
- 输入 `YG01` 有界二进制包 + UYVY；每帧回 `servo.target_angle_deg` 或 hold。
- 输出 JSON 位于 `reports/<device>_latest.json` 与 `reports/<device>.jsonl`。
- 眼部、心理状态分类可选，缺模型时报告明确表示不可用，不造数。
- 研究性压力候选分类器使用 `scripts/train_state_model.py`，依赖 `pip install scikit-learn pandas joblib`，且必须有征得同意、带 `participant_id` 的真实标注数据；模型结果依然**不是诊断**。
- 运行测试：`pip install -r requirements-optional.txt && python -m pytest -q tests`。

### 无真实 ESP32 的 LAN 冒烟测试

新开一个终端保持 `python run.py` 运行，执行：

```powershell
python scripts/mock_sensor.py --url http://127.0.0.1:8000/v1/ingest --token YOUR_TOKEN
```

它发的是**灰色模拟图像**、模拟相位与序列号，用于验证网络协议和报告流程；**不能验证人体姿态识别、真实呼吸或舵机行为**。无模型时 `pose_status=model_unavailable` 且必须是 `servo.mode=hold`。
