import time
import pytest
from fastapi.testclient import TestClient
from settings import Settings
from server import create_app
from protocol import pack_for_test
from pose_backend import Person

class FakePose:
    available = True
    reason = "test-double"
    def detect(self, image):
        assert image.shape[:2] == (320, 240)
        return [Person(.93, (.2, .15, .9, .9), {
            "nose": {"x": .8, "y": .2, "score": .9},
            "left_shoulder": {"x": .73, "y": .42, "score": .9},
            "right_shoulder": {"x": .83, "y": .41, "score": .9}})]

class FakeEye:
    active = False
    def start(self): pass
    def stop(self): pass
    def report(self):
        return {"status": "unavailable", "blink_rate_per_min": None,
                "eye_closed_fraction": None}


def frame(seq=1, stamp=None):
    m = {"device_id": "sensor01", "boot_id": 12, "frame_seq": seq,
         "frame_timestamp_us": stamp or seq * 1_000_000, "width": 240,
         "height": 320, "pixel_format": "UYVY422", "servo_angle_deg": 90,
         "radar": {"human": 1, "quality": "ok", "bpm_module": 12},
         "phase_samples": [[seq, seq * 1_000_000, .01 * seq]]}
    return pack_for_test(m, bytes([128, 80, 128, 100]) * (240 * 320 // 2))


def test_http_auth_report_and_feedback(monkeypatch, tmp_path):
    clock = [1000.0]
    monkeypatch.setattr("server.time.monotonic", lambda: clock[0])
    app = create_app(Settings(device_token="secret", reports_dir=str(tmp_path)),
                     pose=FakePose(), eye=FakeEye())
    with TestClient(app) as client:
        assert client.post("/v1/ingest", content=frame()).status_code == 401
        headers = {"X-Device-Token": "secret", "Content-Type": "application/octet-stream"}
        r = client.post("/v1/ingest", content=frame(), headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["servo"]["mode"] == "track"
        assert not r.json()["report_ready"]
        assert client.get("/v1/report/sensor01", headers=headers).status_code == 404
        clock[0] += 5.1
        r = client.post("/v1/ingest", content=frame(seq=2), headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["report_ready"]
        report = client.get("/v1/report/sensor01", headers=headers)
        assert report.status_code == 200
        body = report.json()
        assert body["pose"]["landmarks_coco17"]["nose"]["x"] == .8
        assert body["psychological_state"]["label"] == "unknown"
        assert (tmp_path / "sensor01_latest.json").exists()
        dup = client.post("/v1/ingest", content=frame(seq=2), headers=headers)
        assert dup.status_code == 200
        assert dup.json()["servo"]["mode"] == "hold"
        assert dup.json()["servo"]["reason"] == "out_of_order"
        assert client.get("/v1/health").json()["cloud_enabled"] is False
