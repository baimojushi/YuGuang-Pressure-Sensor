"""Conservative observable upper-body descriptors; no mental-state inference."""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
import math
from pose_backend import Person


def good(p: Person, name: str) -> tuple[float, float] | None:
    k = p.landmarks.get(name)
    if k is None or k.get("score", 0) < .4:
        return None
    return float(k["x"]), float(k["y"])

@dataclass
class PostureHistory:
    samples: deque = field(default_factory=lambda: deque(maxlen=60))

    def ingest(self, person: Person | None, now_s: float):
        if person is None:
            self.samples.append((now_s, None, None, None))
        else:
            shoulder_l, shoulder_r = good(person, "left_shoulder"), good(person, "right_shoulder")
            nose = good(person, "nose")
            midpoint = None
            asymmetry = None
            if shoulder_l and shoulder_r:
                midpoint = ((shoulder_l[0] + shoulder_r[0]) / 2,
                            (shoulder_l[1] + shoulder_r[1]) / 2)
                asymmetry = abs(shoulder_l[1] - shoulder_r[1])
            self.samples.append((now_s, midpoint, asymmetry, nose))
        while self.samples and self.samples[0][0] < now_s - 15:
            self.samples.popleft()

    def report(self, now_s: float) -> dict:
        observations = [x for x in self.samples if now_s - x[0] <= 5.5]
        valid = [x for x in observations if x[1] is not None]
        if len(valid) < 2:
            return {"status": "insufficient_keypoints", "label": "unknown",
                    "movement_index": None, "shoulder_asymmetry": None,
                    "valid_frames": len(valid)}
        motion = []
        for a, b in zip(valid, valid[1:]):
            dt = b[0] - a[0]
            if .1 <= dt <= 2.5:
                motion.append(math.dist(a[1], b[1]) / dt)
        movement = sum(motion) / len(motion) if motion else None
        asym = sum(x[2] for x in valid if x[2] is not None) / len(valid)
        # Thresholds are descriptive only and must be calibrated for device framing.
        label = "movement_unavailable" if movement is None else (
            "low_movement" if movement < .018 else "active_upper_body"
            if movement > .06 else "moderate_movement")
        return {"status": "observed", "label": label,
                "movement_index": round(movement, 5) if movement is not None else None,
                "shoulder_asymmetry": round(asym, 5), "valid_frames": len(valid)}


def candidate_features(body: dict, breath: dict, eye: dict) -> dict:
    """Uniform named feature contract for training or externally validated models."""
    return {
        "movement_index": body.get("movement_index"),
        "shoulder_asymmetry": body.get("shoulder_asymmetry"),
        "breaths_per_min": breath.get("breaths_per_min"),
        "breath_interval_cv": breath.get("breath_interval_cv"),
        "blink_rate_per_min": eye.get("blink_rate_per_min"),
        "eye_closed_fraction": eye.get("eye_closed_fraction"),
    }
