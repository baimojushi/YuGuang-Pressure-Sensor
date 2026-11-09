import os
os.environ.setdefault("YG_DEVICE_TOKEN", "vvCAbsWM0B9mcXNdcKfunaNUwXLckVSDc_-Gvwpf5k")
os.environ.setdefault("YG_POSE_ONNX", r"D:\yuguang_review\YG_Local_LAN_v3\pc_inference\models\yolo11n-pose.onnx")
os.environ.setdefault("YG_HOST", "0.0.0.0")
os.environ.setdefault("YG_PORT", "8000")
os.environ.setdefault("YG_DEVICE_ID", "sensor01")
os.environ.setdefault("YG_REPORTS_DIR", "reports")
from run import main
main()
