"""Binary sensor/PC contract. Sensor never sends base64 images.

    packet = b'YG01' + uint32LE(metadata_bytes) + uint32LE(uyvy_bytes)
             + UTF8-JSON metadata + raw UYVY422 pixels.
The metadata and pixels refer to the same ESP32 monotonic clock domain.
"""
from __future__ import annotations
import json
import re
import struct
from dataclasses import dataclass
from typing import Any

MAGIC = b"YG01"
HEADER = struct.Struct("<4sII")
MAX_JSON = 30_000
MAX_IMAGE = 400_000
MAX_PACKET = HEADER.size + MAX_JSON + MAX_IMAGE
DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
ALLOWED_DIMS = {(240, 320), (320, 240)}

class PacketError(ValueError):
    pass

@dataclass(frozen=True)
class SensorPacket:
    device_id: str
    boot_id: int
    frame_seq: int
    frame_timestamp_us: int
    width: int
    height: int
    servo_angle_deg: float
    radar: dict[str, Any]
    phase_samples: list[tuple[int, int, float]]
    raw_frame: bytes


def decode_packet(body: bytes) -> SensorPacket:
    if len(body) < HEADER.size or len(body) > MAX_PACKET:
        raise PacketError("invalid packet length")
    magic, meta_len, raw_len = HEADER.unpack_from(body)
    if magic != MAGIC or not (2 <= meta_len <= MAX_JSON) or raw_len > MAX_IMAGE:
        raise PacketError("invalid header")
    if len(body) != HEADER.size + meta_len + raw_len:
        raise PacketError("length mismatch")
    try:
        m = json.loads(body[HEADER.size:HEADER.size + meta_len].decode("utf-8"))
    except (ValueError, UnicodeError) as ex:
        raise PacketError("invalid JSON metadata") from ex
    if not isinstance(m, dict):
        raise PacketError("metadata must be object")
    device = m.get("device_id")
    if not isinstance(device, str) or not DEVICE_RE.fullmatch(device):
        raise PacketError("invalid device_id")
    if m.get("pixel_format") != "UYVY422":
        raise PacketError("unsupported pixel_format")
    w, h = m.get("width"), m.get("height")
    if not isinstance(w, int) or not isinstance(h, int) or (w, h) not in ALLOWED_DIMS:
        raise PacketError("unexpected image dimensions")
    if raw_len != w * h * 2:
        raise PacketError("UYVY byte count not equal to width*height*2")
    boot, seq, stamp = (m.get(k) for k in ("boot_id", "frame_seq", "frame_timestamp_us"))
    if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in (boot, seq, stamp)):
        raise PacketError("invalid device monotonic time or sequence")
    if boot > 0xFFFFFFFF or seq > 0xFFFFFFFF:
        raise PacketError("sequence overflow")
    angle = m.get("servo_angle_deg")
    if not isinstance(angle, (int, float)) or not (0 <= angle <= 180):
        raise PacketError("invalid servo angle")
    radar = m.get("radar", {})
    if not isinstance(radar, dict):
        raise PacketError("radar must be object")
    samples = m.get("phase_samples", [])
    if not isinstance(samples, list) or len(samples) > 128:
        raise PacketError("too many phase samples")
    parsed = []
    for sample in samples:
        if not (isinstance(sample, list) and len(sample) == 3):
            raise PacketError("bad phase sample")
        s_seq, t_us, phase = sample
        if not (isinstance(s_seq, int) and 0 <= s_seq <= 0xFFFFFFFF and
                isinstance(t_us, int) and t_us >= 0 and
                isinstance(phase, (int, float)) and -1e6 <= phase <= 1e6):
            raise PacketError("bad phase sample values")
        parsed.append((s_seq, t_us, float(phase)))
    return SensorPacket(device, boot, seq, stamp, w, h, float(angle), radar,
                        parsed, body[HEADER.size + meta_len:])


def pack_for_test(meta: dict, frame: bytes) -> bytes:
    m = json.dumps(meta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return HEADER.pack(MAGIC, len(m), len(frame)) + m + frame
