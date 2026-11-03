"""Read-only environment config. No cloud provider SDK or platform account."""
from __future__ import annotations
from dataclasses import dataclass
import os

@dataclass
class Settings:
    device_id: str = "sensor01"
    device_token: str = ""
    model_path: str = ""
    stress_model_path: str = ""
    eye_camera_index: int = -1
    rotate_degrees: int = 0
    servo_direction: int = 1
    servo_min_deg: float = 30
    servo_max_deg: float = 150
    reports_dir: str = "reports"
    host: str = "0.0.0.0"
    port: int = 8000

    @classmethod
    def from_env(cls):
        return cls(
            device_id=os.getenv("YG_DEVICE_ID", "sensor01"),
            device_token=os.getenv("YG_DEVICE_TOKEN", ""),
            model_path=os.getenv("YG_POSE_ONNX", ""),
            stress_model_path=os.getenv("YG_STRESS_MODEL", ""),
            eye_camera_index=int(os.getenv("YG_EYE_CAMERA_INDEX", "-1")),
            rotate_degrees=int(os.getenv("YG_ROTATE_DEGREES", "0")),
            servo_direction=int(os.getenv("YG_SERVO_DIRECTION", "1")),
            servo_min_deg=float(os.getenv("YG_SERVO_MIN_DEG", "30")),
            servo_max_deg=float(os.getenv("YG_SERVO_MAX_DEG", "150")),
            reports_dir=os.getenv("YG_REPORTS_DIR", "reports"),
            host=os.getenv("YG_HOST", "0.0.0.0"),
            port=int(os.getenv("YG_PORT", "8000")),
        )

    def validate(self):
        if not self.device_token or self.device_token == "REPLACE_WITH_RANDOM_TOKEN":
            raise ValueError("Configure YG_DEVICE_TOKEN in PC environment before launch")
        if self.rotate_degrees not in (0, 90, 180, 270):
            raise ValueError("YG_ROTATE_DEGREES must be 0/90/180/270")
        if self.servo_direction not in (-1, 1):
            raise ValueError("YG_SERVO_DIRECTION must be +1 or -1")
        if not 0 <= self.servo_min_deg < self.servo_max_deg <= 180:
            raise ValueError("Invalid servo range")
