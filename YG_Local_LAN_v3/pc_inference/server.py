"""LAN-local Windows inference service: no cloud, no account and no outbound calls."""
from __future__ import annotations
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
import json
import os
import time
import hmac

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import HTMLResponse
from starlette.concurrency import run_in_threadpool

from settings import Settings
from protocol import SensorPacket, PacketError, decode_packet, MAX_PACKET
from pose_backend import Person, load_pose_model
from respiration import Respiration
from tracking import TrackingController
from features import PostureHistory, candidate_features
from psychology import PsychologicalEstimator
from eyes import EyeCamera

@dataclass
class Session:
    boot_id: int
    respiration: Respiration = field(default_factory=Respiration)
    tracking: TrackingController = field(default_factory=TrackingController)
    posture: PostureHistory = field(default_factory=PostureHistory)
    last_report_s: float = 0
    latest_report: dict | None = None
    latest_frame_ts_us: int = 0
    latest_frame_seq: int = -1
    frames_since_report: int = 0

class LocalProcessor:
    def __init__(self, settings: Settings, pose=None, eye=None, psychology=None):
        self.settings = settings
        self.pose = pose if pose is not None else load_pose_model(settings.model_path)
        self.eye = eye if eye is not None else EyeCamera(settings.eye_camera_index)
        self.psychology = psychology if psychology is not None else PsychologicalEstimator(settings.stress_model_path)
        self.sessions: dict[str, Session] = {}
        self.lock = Lock()
        self.reports_dir = Path(settings.reports_dir).resolve()
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def _decode_frame(self, packet: SensorPacket):
        import cv2
        import numpy as np
        uyvy = np.frombuffer(packet.raw_frame, dtype=np.uint8).reshape(packet.height, packet.width, 2)
        image = cv2.cvtColor(uyvy, cv2.COLOR_YUV2BGR_UYVY)
        rotation = self.settings.rotate_degrees
        if rotation:
            flag = {90: cv2.ROTATE_90_CLOCKWISE,
                    180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}[rotation]
            image = cv2.rotate(image, flag)
        return image

    def process(self, packet: SensorPacket) -> dict:
        with self.lock:  # serializes frame sequencing and avoids GPU model reentrancy
            now = time.monotonic()
            s = self.sessions.get(packet.device_id)
            if s is None or s.boot_id != packet.boot_id:
                s = Session(packet.boot_id)
                s.tracking.min_deg = self.settings.servo_min_deg
                s.tracking.max_deg = self.settings.servo_max_deg
                s.tracking.direction = self.settings.servo_direction
                s.last_report_s = now
                self.sessions[packet.device_id] = s
            if packet.frame_seq <= s.latest_frame_seq or (
                    s.latest_frame_ts_us and packet.frame_timestamp_us <= s.latest_frame_ts_us):
                return self._reply(packet, {"mode": "hold", "reason": "out_of_order", "ttl_ms": 1200},
                                   "duplicate_ignored", False)
            s.latest_frame_seq = packet.frame_seq
            s.latest_frame_ts_us = packet.frame_timestamp_us
            s.frames_since_report += 1
            s.respiration.ingest(packet.phase_samples, packet.radar, now)
            selected = None
            status = "model_unavailable"
            persons = []
            if self.pose.available:
                try:
                    persons = self.pose.detect(self._decode_frame(packet))
                    status = "ok"
                except Exception as exc:
                    # Never move a motor if image decoding or model postprocessing fails.
                    status = f"model_error:{type(exc).__name__}"
            command, selected = s.tracking.decide(persons, packet.servo_angle_deg,
                                                   now, packet.boot_id, packet.frame_seq)
            if status != "ok":
                command = {"mode": "hold", "reason": status, "ttl_ms": 1200}
                selected = None
            s.posture.ingest(selected, now)
            ready = False
            if now - s.last_report_s >= 5.0:
                ready = True
                s.latest_report = self._build_report(packet, s, selected, status, now)
                s.last_report_s = now
                s.frames_since_report = 0
                self._write_report(packet.device_id, s.latest_report)
            return self._reply(packet, command, status, ready)

    def _build_report(self, packet: SensorPacket, s: Session, person: Person | None,
                      pose_status: str, now: float) -> dict:
        respiration = s.respiration.report(now)
        posture = s.posture.report(now)
        eye = self.eye.report()
        features = candidate_features(posture, respiration, eye)
        state = self.psychology.predict(features)
        return {
            "schema": "yg.local.report.v1",
            "device_id": packet.device_id,
            "boot_id": packet.boot_id,
            "frame_seq": packet.frame_seq,
            "device_timestamp_us": packet.frame_timestamp_us,
            "pc_generated_at_utc": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc).isoformat(),
            "analysis_update_seconds": 5,
            "frames_since_last_report": s.frames_since_report,
            "pose": {"status": pose_status,
                     "confidence": person.confidence if person else None,
                     "bbox_xyxy_normalized": person.bbox if person else None,
                     "landmarks_coco17": person.landmarks if person else {},
                     "upper_body_only_supported": True},
            "respiration": respiration,
            "posture_observations": posture,
            "eyes": eye,
            "fusion_features": features,
            "psychological_state": state,
            "limitations": ["not_medical_diagnosis", "single_camera_pan_only",
                            "timestamp_alignment_not_hardware_sync"]
        }

    def _write_report(self, device: str, report: dict):
        # Validated device ID can only use safe characters (protocol.DEVICE_RE).
        text = json.dumps(report, ensure_ascii=False, separators=(",", ":"))
        jsonl = self.reports_dir / f"{device}.jsonl"
        latest = self.reports_dir / f"{device}_latest.json"
        tmp = self.reports_dir / f"{device}_latest.json.tmp"
        with jsonl.open("a", encoding="utf-8") as fh:
            fh.write(text + "\n")
        tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, latest)

    @staticmethod
    def _reply(packet: SensorPacket, servo: dict, status: str, ready: bool):
        return {"schema": "yg.local.ack.v1", "device_id": packet.device_id,
                "boot_id": packet.boot_id, "frame_seq": packet.frame_seq,
                "pose_status": status, "report_ready": ready, "servo": servo}


def create_app(settings: Settings | None = None, pose=None, eye=None, psychology=None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()
    processor = LocalProcessor(settings, pose, eye, psychology)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        processor.eye.start()
        try:
            yield
        finally:
            processor.eye.stop()

    app = FastAPI(title="YG Local Inference", version="3.0.0", lifespan=lifespan)
    app.state.processor = processor
    app.state.config = settings

    def authorize(token: str | None, device: str | None = None):
        if not token or not hmac.compare_digest(token, settings.device_token):
            raise HTTPException(status_code=401, detail="invalid local device token")
        if device is not None and device != settings.device_id:
            raise HTTPException(status_code=403, detail="device id not allowed")

    @app.post("/v1/ingest")
    async def ingest(request: Request, x_device_token: str | None = Header(default=None)):
        authorize(x_device_token)
        if request.headers.get("content-type", "").split(";")[0].strip() != "application/octet-stream":
            raise HTTPException(status_code=415, detail="binary octet-stream required")
        n = request.headers.get("content-length")
        if n and (not n.isdecimal() or int(n) > MAX_PACKET):
            raise HTTPException(status_code=413, detail="packet too large")
        pieces, size = [], 0
        async for piece in request.stream():
            size += len(piece)
            if size > MAX_PACKET:
                raise HTTPException(status_code=413, detail="packet too large")
            pieces.append(piece)
        try:
            packet = decode_packet(b"".join(pieces))
        except PacketError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        authorize(x_device_token, packet.device_id)
        return await run_in_threadpool(processor.process, packet)

    @app.get("/v1/report/{device_id}")
    async def latest_report(device_id: str, x_device_token: str | None = Header(default=None)):
        authorize(x_device_token, device_id)
        with processor.lock:
            s = processor.sessions.get(device_id)
            if not s or not s.latest_report:
                raise HTTPException(status_code=404, detail="report not ready")
            return s.latest_report

    @app.get("/v1/health")
    async def health():
        return {"status": "ok", "pose_model_available": processor.pose.available,
                "model_reason": getattr(processor.pose, "reason", ""),
                "eye_camera_active": processor.eye.active,
                "cloud_enabled": False}

    @app.get("/", response_class=HTMLResponse)
    async def index():
        # Browser token is not persisted in localStorage/cookies; use from same trusted LAN.
        html = """<!doctype html><html lang='zh'><head><meta charset='utf-8'>
        <title>余光 · 局域网感知</title><meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>body{font:16px system-ui;margin:6vh auto;max-width:900px;padding:0 20px;
        background:#f7f5ef;color:#25363c}header{border-bottom:1px solid #bcc9c5;padding-bottom:1rem}
        h1{font-weight:700}input{padding:12px;border:1px solid #9cadac;border-radius:8px;width:45%}
        button{padding:12px;border:0;border-radius:8px;background:#356f67;color:white;cursor:pointer}
        pre{white-space:pre-wrap;word-break:break-all;background:white;border:1px solid #d9ddd6;
        border-radius:12px;padding:20px;min-height:180px;font-size:13px}</style></head>
        <body><header><small>YG · LOCAL SENSING / NO CLOUD</small><h1>余光 · 本地感知台</h1>
        <p>每 5 秒更新人体节点、呼吸特征和可用状态。请确保已经得到被摄对象同意。</p></header>
        <p>设备令牌 <input id='token' type='password' autocomplete='off' placeholder='仅本次浏览器会话'>
        <button onclick='load()'>查看最新报告</button></p><p id='status'></p><pre id='data'></pre>
        <script>async function load(){const t=document.getElementById('token').value;
        const s=document.getElementById('status');try{const r=await fetch('/v1/report/DEVICE_PLACEHOLDER',
        {headers:{'X-Device-Token':t}});if(!r.ok)throw Error('HTTP '+r.status);
        const j=await r.json();s.textContent='最近报告：'+j.pc_generated_at_utc;
        document.getElementById('data').textContent=JSON.stringify(j,null,2);
        }catch(e){s.textContent='暂不可用：'+e.message}}</script></body></html>"""
        return html.replace("DEVICE_PLACEHOLDER", settings.device_id)
    return app
