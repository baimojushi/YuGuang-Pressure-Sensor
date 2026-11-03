"""Person tracking: feedback uses latest reported servo angle, not speculative state.
Does not chase a different person immediately if multiple people appear.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Sequence
from pose_backend import Person

@dataclass
class TrackingController:
    min_deg: float = 30.0
    max_deg: float = 150.0
    direction: int = 1         # reverse to -1 after mounting test
    gain: float = 32.0         # degrees per normalized x-error
    deadband: float = 0.07
    max_command_step: float = 6.0
    last_x: float | None = None
    last_seen_s: float = -1e6
    last_boot_id: int | None = None
    last_frame_seq: int = -1

    def decide(self, persons: Sequence[Person], current_angle: float, now_s: float,
               boot_id: int, frame_seq: int) -> tuple[dict, Person | None]:
        # If the frame/boot was already accepted, NEVER reapply stale commands.
        if self.last_boot_id != boot_id:
            self.last_boot_id = boot_id
            self.last_frame_seq = -1
            self.last_x = None
        if frame_seq <= self.last_frame_seq:
            return {"mode": "hold", "reason": "repeated_frame", "ttl_ms": 1200}, None
        self.last_frame_seq = frame_seq
        candidates = [(p, p.aiming_x()) for p in persons if p.confidence >= 0.4]
        candidates = [(p, x) for p, x in candidates if x is not None]
        if not candidates:
            return {"mode": "hold", "reason": "person_not_visible", "ttl_ms": 1200}, None
        # Within 3 sec, keep roughly the same person, else pick clearest person.
        if self.last_x is not None and now_s - self.last_seen_s < 3.0:
            p, x = min(candidates, key=lambda c: abs(c[1] - self.last_x))
            if abs(x - self.last_x) > .30:
                return {"mode": "hold", "reason": "target_identity_uncertain", "ttl_ms": 1200}, None
        else:
            p, x = max(candidates, key=lambda c: c[0].confidence)
        self.last_x, self.last_seen_s = x, now_s
        error = x - 0.5
        if abs(error) <= self.deadband:
            return {"mode": "hold", "reason": "centered", "ttl_ms": 1200}, p
        delta = self.direction * self.gain * error
        delta = max(-self.max_command_step, min(self.max_command_step, delta))
        target = max(self.min_deg, min(self.max_deg, current_angle + delta))
        if abs(target - current_angle) < .25:
            return {"mode": "hold", "reason": "at_servo_limit", "ttl_ms": 1200}, p
        return {"mode": "track", "target_angle_deg": round(target, 2),
                "reason": "follow_upper_body", "ttl_ms": 1200}, p
