"""Run on developer machine only after reviewing Ultralytics AGPL/Enterprise terms.
    pip install ultralytics
    python scripts/export_yolo11_pose.py --weights yolo11n-pose.pt
"""
import argparse
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--weights", required=True, help="Local, lawfully licensed YOLO11 pose weights")
p.add_argument("--size", type=int, default=640)
args = p.parse_args()
from ultralytics import YOLO
m = YOLO(args.weights)
out = m.export(format="onnx", imgsz=args.size, simplify=True, dynamic=False, opset=12)
print("Exported:", out)
print("Copy this .onnx file into pc_inference/models/ and set YG_POSE_ONNX")
