"""YOLO11n-pose ONNX: standard COCO-17 keypoints in normalized image coordinates.
Commercial users must verify the model weights' license independently.
"""
from __future__ import annotations
from dataclasses import dataclass
import os
import cv2
import numpy as np


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def _decode_pose_heads(outputs: dict, size: int) -> np.ndarray:
    """Decode raw YOLO11n-pose heads (box/score/kpt per scale) into (N,56) pose-format
    array in 640-pixel letterbox space: [cx,cy,w,h,conf,kx1,ky1,kv1,...,kx17,ky17,kv17].

    outputs: dict name->numpy array from session.run (batched, batch=1).
    Returns float32 (N,56); empty (0,56) when nothing detected.
    """
    groups = {}
    for name, arr in outputs.items():
        if arr.ndim == 4 and arr.shape[0] == 1:
            c, hh, ww = arr.shape[1], arr.shape[2], arr.shape[3]
            groups.setdefault((hh, ww), {})[c] = arr[0]

    rows = []
    for (hh, ww), g in sorted(groups.items()):
        if not ({64, 1, 51} <= set(g.keys())):
            continue
        box = g[64]           # (64,H,W) = 4 dirs x 16 DFL bins
        sc = g[1]             # (1,H,W)
        kp = g[51]            # (51,H,W) = 17 kpts x 3 (x,y,v)
        stride = size / hh

        # DFL decode: 64 channels = 4 directions x 16 bins
        b = box.reshape(4, 16, hh, ww)
        p = np.exp(b - b.max(axis=1, keepdims=True))
        p /= p.sum(axis=1, keepdims=True)
        dist = (p * np.arange(16).reshape(1, 16, 1, 1)).sum(axis=1)  # (4,H,W)

        gx, gy = np.meshgrid(np.arange(ww), np.arange(hh))
        cx = (gx + 0.5) * stride
        cy = (gy + 0.5) * stride
        l, t, r, b2 = dist[0], dist[1], dist[2], dist[3]
        x1 = cx - l * stride
        y1 = cy - t * stride
        x2 = cx + r * stride
        y2 = cy + b2 * stride
        ccx = (x1 + x2) / 2
        ccy = (y1 + y2) / 2
        bw = x2 - x1
        bh = y2 - y1
        conf = _sigmoid(sc[0])

        # kp 通道布局: [kx0..kx16, ky0..ky16, kv0..kv16]（先全部x，再全部y，再全部score）
        k = kp.reshape(3, 17, hh, ww)
        kx = (_sigmoid(k[0]) * 2 - 0.5 + gx) * stride
        ky = (_sigmoid(k[1]) * 2 - 0.5 + gy) * stride
        kv = _sigmoid(k[2])

        for yy in range(hh):
            for xx in range(ww):
                c = conf[yy, xx]
                if c < 0.25:
                    continue
                rows.append(
                    np.concatenate(
                        [
                            [ccx[yy, xx], ccy[yy, xx], bw[yy, xx], bh[yy, xx], c],
                            kx[:, yy, xx],
                            ky[:, yy, xx],
                            kv[:, yy, xx],
                        ]
                    )
                )
    if not rows:
        return np.zeros((0, 56), dtype=np.float32)
    return np.stack(rows).astype(np.float32)


COCO17 = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)


@dataclass
class Person:
    confidence: float
    bbox: tuple[float, float, float, float]  # normalized xyxy
    landmarks: dict[str, dict[str, float]]

    def aiming_x(self) -> float | None:
        parts = [self.landmarks.get(n) for n in ("left_shoulder", "right_shoulder")]
        visible = [p for p in parts if p and p["score"] >= .35]
        if len(visible) == 2:
            return (visible[0]["x"] + visible[1]["x"]) / 2.0
        nose = self.landmarks.get("nose")
        if nose and nose["score"] >= .4:
            return nose["x"]
        return None


class NoPoseModel:
    """Safe startup if the user has not supplied ONNX weights: no fake targets."""
    available = False
    reason = "ONNX pose weights not configured; see pc_inference/README.md"
    def detect(self, image):
        return []


class YoloPoseONNX:
    available = True
    reason = ""

    def __init__(self, path: str, img_size: int = 640):
        import onnxruntime as ort
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Pose ONNX weight not found: {path}")
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        available = ort.get_available_providers()
        providers = [p for p in providers if p in available]
        self.session = ort.InferenceSession(path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        shape = self.session.get_inputs()[0].shape
        self.size = img_size if not isinstance(shape[2], int) else shape[2]
        if isinstance(shape[3], int) and shape[3] != self.size:
            raise ValueError("Model input must be square NCHW")
        if len(shape) != 4:
            raise ValueError("Unsupported ONNX input: expect NCHW")

    def detect(self, image):
        import cv2
        import numpy as np
        h, w = image.shape[:2]
        size = self.size
        scale = min(size / w, size / h)
        nw, nh = round(w * scale), round(h * scale)
        resized = cv2.resize(image, (nw, nh), interpolation=cv2.INTER_LINEAR)
        dw, dh = (size - nw) // 2, (size - nh) // 2
        canvas = np.full((size, size, 3), 114, dtype=np.uint8)
        canvas[dh:dh + nh, dw:dw + nw] = resized
        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        tensor = np.transpose(rgb.astype(np.float32) / 255., (2, 0, 1))[None]
        outs = self.session.run(None, {self.input_name: tensor})
        raw = _decode_pose_heads(
            {self.session.get_outputs()[i].name: outs[i] for i in range(len(outs))},
            self.size,
        )
        if raw.ndim != 2 or raw.shape[1] != 56:
            raise ValueError(f"ONNX output shape incompatible with YOLO11 COCO pose: {raw.shape}")
        raw = raw[raw[:, 4] >= 0.35]
        if raw.shape[0] == 0:
            return []
        boxes = np.stack((raw[:, 0] - raw[:, 2] / 2,
                          raw[:, 1] - raw[:, 3] / 2,
                          raw[:, 2], raw[:, 3]), axis=1)
        ids = cv2.dnn.NMSBoxes(boxes.tolist(), raw[:, 4].tolist(), 0.35, 0.45)
        if len(ids) == 0:
            return []
        people = []
        for idx in np.asarray(ids).reshape(-1)[:6]:
            r = raw[int(idx)]
            bbox = boxes[int(idx)]
            x1, y1, bw, bh = bbox.tolist()
            b = (max(0., min(1., (x1 - dw) / scale / w)),
                 max(0., min(1., (y1 - dh) / scale / h)),
                 max(0., min(1., (x1 + bw - dw) / scale / w)),
                 max(0., min(1., (y1 + bh - dh) / scale / h)))
            # r[5:] 布局: [kx0..kx16, ky0..ky16, kv0..kv16]（先x后y后v）。
            # reshape(3,17).T 才能把每个关键点的 (x,y,v) 对齐在同一行。
            kpts = r[5:].reshape(3, 17).T
            landmarks = {}
            for name, (x, y, prob) in zip(COCO17, kpts):
                landmarks[name] = {
                    "x": round(float(np.clip((x - dw) / scale / w, 0, 1)), 5),
                    "y": round(float(np.clip((y - dh) / scale / h, 0, 1)), 5),
                    "score": round(float(np.clip(prob, 0, 1)), 5),
                }
            people.append(Person(round(float(r[4]), 5), b, landmarks))
        return people


class MoveNetTFLite:
    """Optional commercially friendlier model family (check weight license).
    Requires TensorFlow runtime on the PC and a local Lightning/Thunder .tflite.
    The same COCO 17-keypoint contract is preserved.
    """
    available = True
    reason = ""

    def __init__(self, path: str):
        import tensorflow as tf
        import numpy as np
        self.tf = tf
        self.np = np
        self.interpreter = tf.lite.Interpreter(model_path=path, num_threads=4)
        self.interpreter.allocate_tensors()
        self.input = self.interpreter.get_input_details()[0]
        self.output = self.interpreter.get_output_details()[0]
        self.size = int(self.input["shape"][1])

    def detect(self, image):
        import cv2
        import numpy as np
        h, w = image.shape[:2]
        scale = min(self.size / w, self.size / h)
        nw, nh = round(w * scale), round(h * scale)
        left, top = (self.size - nw) // 2, (self.size - nh) // 2
        resized = cv2.resize(image, (nw, nh))
        canvas = np.zeros((self.size, self.size, 3), dtype=np.uint8)
        canvas[top:top + nh, left:left + nw] = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        tensor = canvas[None]
        if self.input["dtype"] != np.uint8:
            tensor = tensor.astype(self.input["dtype"])
        self.interpreter.set_tensor(self.input["index"], tensor)
        self.interpreter.invoke()
        pts = np.asarray(self.interpreter.get_tensor(self.output["index"])).reshape(-1, 3)
        if pts.shape != (17, 3):
            raise ValueError(f"unexpected MoveNet output shape {pts.shape}")
        landmarks = {}
        visible = []
        for name, (y, x, score) in zip(COCO17, pts):
            x = float(np.clip((x * self.size - left) / scale / w, 0., 1.))
            y = float(np.clip((y * self.size - top) / scale / h, 0., 1.))
            score = float(np.clip(score, 0., 1.))
            landmarks[name] = {"x": round(x, 5), "y": round(y, 5), "score": round(score, 5)}
            if score >= .4:
                visible.append((x, y, score))
        if len(visible) < 3:
            return []
        confidence = float(np.mean(sorted((v[2] for v in visible), reverse=True)[:5]))
        bbox = (min(v[0] for v in visible), min(v[1] for v in visible),
                max(v[0] for v in visible), max(v[1] for v in visible))
        return [Person(confidence, bbox, landmarks)]


def load_pose_model(model_path: str | None):
    if not model_path:
        return NoPoseModel()
    if model_path.lower().endswith(".tflite"):
        return MoveNetTFLite(model_path)
    if model_path.lower().endswith(".onnx"):
        return YoloPoseONNX(model_path)
    raise ValueError("YG_POSE_ONNX must point to a .onnx YOLO pose or .tflite MoveNet model")
