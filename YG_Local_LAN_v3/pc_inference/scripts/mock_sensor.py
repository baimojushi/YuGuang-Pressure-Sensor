"""Software-only LAN POST smoke test; sends a blank frame, NOT a person image.
Run pc_inference/run.py in another console with YG_DEVICE_TOKEN configured.
Usage: python scripts/mock_sensor.py --url http://127.0.0.1:8000/v1/ingest --token XXX
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import struct
import time
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8000/v1/ingest")
ap.add_argument("--token", required=True)
ap.add_argument("--frames", type=int, default=8)
args = ap.parse_args()

raw = bytes([128, 120, 128, 120]) * (240 * 320 // 2)  # UYVY neutral gray
for seq in range(1, args.frames + 1):
    t = seq * 1_000_000
    meta = {
        "device_id": "sensor01", "boot_id": 1818, "frame_seq": seq,
        "frame_timestamp_us": t, "width": 240, "height": 320,
        "pixel_format": "UYVY422", "servo_angle_deg": 90.0,
        "radar": {"human": 1, "quality": "module", "bpm_module": 12.0},
        "phase_samples": [[seq*10 + i, t + i * 50_000,
                           math.sin(2*math.pi*.2*(seq+i*.05))] for i in range(10)],
    }
    json_bytes = json.dumps(meta, separators=(",", ":")).encode("utf-8")
    data = struct.pack("<4sII", b"YG01", len(json_bytes), len(raw)) + json_bytes + raw
    req = urllib.request.Request(args.url, data=data, method="POST",
                                 headers={"Content-Type": "application/octet-stream",
                                          "X-Device-Token": args.token})
    with urllib.request.urlopen(req, timeout=5) as response:
        print(json.dumps(json.loads(response.read()), ensure_ascii=False))
    time.sleep(1)
