"""Optional PC-direct USB eye camera @30FPS; BF3901 1FPS is not an eye tracker.
Uses MediaPipe Face Mesh when available; eye closure & blinking only.
No calibrated gaze point or pupil-size estimate.
"""
from __future__ import annotations
from collections import deque
from threading import Thread, Lock, Event
import time
import math

LEFT = (33, 160, 158, 133, 153, 144)
RIGHT = (362, 385, 387, 263, 373, 380)

def eye_aspect_ratio(lms, ids) -> float:
    def p(i): return (float(lms[i].x), float(lms[i].y))
    return (math.dist(p(ids[1]), p(ids[5])) + math.dist(p(ids[2]), p(ids[4]))) / max(
        1e-6, 2 * math.dist(p(ids[0]), p(ids[3])))

class EyeCamera:
    def __init__(self, camera_index: int = -1):
        self.index = camera_index
        self.active = False
        self.error = "no eye camera configured"
        self.state_lock = Lock()
        self.events = deque(maxlen=15000)  # (PC monotonic timestamp, closed_bool)
        self.stop_event = Event()
        self.thread = None

    def start(self):
        if self.index < 0:
            return
        self.thread = Thread(target=self._worker, daemon=True, name="eye_cam")
        self.thread.start()

    def _worker(self):
        try:
            import cv2
            import mediapipe as mp
            # Legacy FaceMesh API is available in selected MediaPipe distributions;
            # fail safely if the installed version moved its runtime API.
            face_mesh_api = mp.solutions.face_mesh
            cap = cv2.VideoCapture(self.index, cv2.CAP_DSHOW if hasattr(cv2, "CAP_DSHOW") else cv2.CAP_ANY)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            if not cap.isOpened():
                self.error = "PC eye camera cannot be opened"
                return
            with face_mesh_api.FaceMesh(max_num_faces=1, refine_landmarks=True,
                                        min_detection_confidence=.5, min_tracking_confidence=.5) as mesh:
                self.active, self.error = True, ""
                while not self.stop_event.is_set():
                    ok, frame = cap.read()
                    if not ok:
                        time.sleep(.05)
                        continue
                    small = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = mesh.process(small)
                    if not result.multi_face_landmarks:
                        continue
                    lms = result.multi_face_landmarks[0].landmark
                    ear = (eye_aspect_ratio(lms, LEFT) + eye_aspect_ratio(lms, RIGHT)) / 2
                    with self.state_lock:
                        self.events.append((time.monotonic(), ear < .20))
            cap.release()
        except Exception as ex:
            self.error = f"eye camera unavailable: {type(ex).__name__}: {ex}"
            self.active = False

    def report(self) -> dict:
        if not self.active:
            return {"status": "unavailable", "reason": self.error,
                    "blink_rate_per_min": None, "eye_closed_fraction": None}
        now = time.monotonic()
        with self.state_lock:
            events = [(t, closed) for t, closed in self.events if t >= now - 60]
        if len(events) < 60 or events[-1][0] - events[0][0] < 20:
            return {"status": "warming_up", "blink_rate_per_min": None,
                    "eye_closed_fraction": None}
        # Blink = closed interval followed by reopening, not any single noisy sample.
        blinks = 0
        closed_run = 0
        for _, closed in events:
            if closed:
                closed_run += 1
            elif 2 <= closed_run <= 18:
                blinks += 1
                closed_run = 0
            else:
                closed_run = 0
        seconds = events[-1][0] - events[0][0]
        return {"status": "observed", "blink_rate_per_min": round(blinks * 60 / seconds, 2),
                "eye_closed_fraction": round(sum(closed for _, closed in events) / len(events), 4),
                "window_seconds": round(seconds, 1), "calibrated_gaze": False}

    def stop(self):
        self.stop_event.set()
