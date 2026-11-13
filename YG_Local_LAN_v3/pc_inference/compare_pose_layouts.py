"""Compare YOLO11n-pose ONNX 51-channel keypoint layouts on real images.

Two hypotheses for the 51 channels of each kpt output (51, H, W):
  Layout A (interleaved / grouped-by-keypoint):
    channels [x0,y0,v0, x1,y1,v1, ..., x16,y16,v16]  -> reshape(17, 3, H, W)
  Layout B (grouped / grouped-by-coordinate):
    channels [x0..x16, y0..y16, v0..v16]           -> reshape(3, 17, H, W)

Runs ONE inference per image, then decodes the same raw tensor with both
layouts for a fair apples-to-apples comparison.

Outputs (under --out dir):
  model_signature.json   real input/output names & shapes
  summary.json           quantitative metrics per image & layout
  keypoints_unclipped.csv all 17 keypoints (x,y,v) per image & layout, unclipped
  pose_layout_A_<img>.png  skeleton overlay for layout A
  pose_layout_B_<img>.png  skeleton overlay for layout B

Does NOT modify any project source code or model weights.
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

COCO17 = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)

SKELETON_EDGES = (
    ("nose", "left_eye"), ("nose", "right_eye"),
    ("left_eye", "left_ear"), ("right_eye", "right_ear"),
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
)


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def _py(val):
    """Convert numpy scalar to native Python type for JSON/CSV serialization."""
    if isinstance(val, (np.floating, np.integer)):
        return val.item()
    return val


def letterbox(image, size=640):
    h, w = image.shape[:2]
    scale = min(size / w, size / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(image, (nw, nh), interpolation=cv2.INTER_LINEAR)
    dw, dh = (size - nw) // 2, (size - nh) // 2
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    canvas[dh:dh + nh, dw:dw + nw] = resized
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    tensor = np.transpose(rgb.astype(np.float32) / 255.0, (2, 0, 1))[None]
    return tensor, dw, dh, scale, w, h


def decode_kpts_spatial(kp, hh, ww, stride, gx, gy, dw, dh, scale, orig_w, orig_h, layout):
    """Decode a single spatial cell's 51 channels into 17 (x,y,v) in original-image normalized coords.

    kp: (51, hh, ww) raw tensor for one output scale.
    Returns: list of 17 (x, y, v) in normalized [0,1] coords of the ORIGINAL image.
    """
    kpts = []
    for i in range(17):
        if layout == "A":
            # interleaved: channel offset = i*3 + {0,1,2}
            x_raw = kp[i * 3 + 0]
            y_raw = kp[i * 3 + 1]
            v_raw = kp[i * 3 + 2]
        else:
            # grouped: x block [0:17], y block [17:34], v block [34:51]
            x_raw = kp[i]
            y_raw = kp[17 + i]
            v_raw = kp[34 + i]

        # We need per-cell values, but this helper is called per-cell below.
        # This function is a placeholder; the vectorized version is used instead.
        raise NotImplementedError("use decode_kpts_batch instead")


def decode_kpts_batch(kp, hh, ww, stride, gx, gy, dw, dh, scale, orig_w, orig_h, layout):
    """Vectorized decode of all cells for one output scale.

    kp: (51, hh, ww)
    Returns: (hh, ww, 17, 3) array of (x, y, v) in normalized [0,1] original-image coords.
    """
    if layout == "A":
        # (17, 3, hh, ww): for each keypoint i, channels [x,y,v]
        k = kp.reshape(17, 3, hh, ww)
        kx_raw = k[:, 0]  # (17, hh, ww)
        ky_raw = k[:, 1]
        kv_raw = k[:, 2]
    else:
        # (3, 17, hh, ww): channel block [x0..x16, y0..y16, v0..v16]
        k = kp.reshape(3, 17, hh, ww)
        kx_raw = k[0]  # (17, hh, ww)
        ky_raw = k[1]
        kv_raw = k[2]

    kx = (_sigmoid(kx_raw) * 2.0 - 0.5 + gx[None, :, :]) * stride  # (17,hh,ww)
    ky = (_sigmoid(ky_raw) * 2.0 - 0.5 + gy[None, :, :]) * stride
    kv = _sigmoid(kv_raw)

    # Map from letterbox space back to original image normalized coords
    # kx, ky are in 640-letterbox pixel space; convert:
    #   orig_x = (kx - dw) / scale / orig_w
    #   orig_y = (ky - dh) / scale / orig_h
    kx_norm = np.clip((kx - dw) / scale / orig_w, 0.0, 1.0)
    ky_norm = np.clip((ky - dh) / scale / orig_h, 0.0, 1.0)
    kv_norm = np.clip(kv, 0.0, 1.0)

    # stack to (hh, ww, 17, 3)
    out = np.stack([kx_norm, ky_norm, kv_norm], axis=-1)  # (17, hh, ww, 3)
    out = np.transpose(out, (1, 2, 0, 3))  # (hh, ww, 17, 3)
    return out


def decode_boxes(box, sc, hh, ww, stride, gx, gy, conf_thresh=0.25):
    """Decode box/score heads into candidate detections.

    Returns list of dicts: {cx, cy, bw, bh, conf} in 640-letterbox space.
    """
    b = box.reshape(4, 16, hh, ww)
    p = np.exp(b - b.max(axis=1, keepdims=True))
    p /= p.sum(axis=1, keepdims=True)
    dist = (p * np.arange(16).reshape(1, 16, 1, 1)).sum(axis=1)  # (4,H,W)

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

    dets = []
    for yy in range(hh):
        for xx in range(ww):
            c = float(conf[yy, xx])
            if c < conf_thresh:
                continue
            dets.append({
                "cx": float(ccx[yy, xx]), "cy": float(ccy[yy, xx]),
                "bw": float(bw[yy, xx]), "bh": float(bh[yy, xx]),
                "conf": c,
            })
    return dets


def run_inference(session, input_name, tensor):
    outs = session.run(None, {input_name: tensor})
    return {session.get_outputs()[i].name: outs[i] for i in range(len(outs))}


def extract_scale_outputs(outputs, hh, ww):
    """Extract box/score/kpt for a given spatial scale from the outputs dict."""
    g = {}
    for name, arr in outputs.items():
        if arr.ndim == 4 and arr.shape[0] == 1:
            c, h, w = arr.shape[1], arr.shape[2], arr.shape[3]
            if (h, w) == (hh, ww):
                g[c] = arr[0]
    return g


def detect_poses(outputs, size, dw, dh, scale, orig_w, orig_h, layout, conf_thresh=0.25, iou_thresh=0.45):
    """Run full pose decoding for one layout.

    Returns list of persons: each is dict {bbox: [x1,y1,x2,y2] norm, conf, keypoints: [(x,y,v),...] norm}.
    """
    gx_full, gy_full = np.meshgrid(np.arange(size // 4), np.arange(size // 4))  # placeholder, replaced per scale

    all_raw = []  # (N, 56) rows: [cx,cy,w,h,conf, kx0,ky0,kv0, ..., kx16,ky16,kv16] in letterbox space

    for (hh, ww) in [(80, 80), (40, 40), (20, 20)]:
        stride = size / hh
        gx, gy = np.meshgrid(np.arange(ww), np.arange(hh))
        g = extract_scale_outputs(outputs, hh, ww)
        if not ({64, 1, 51} <= set(g.keys())):
            continue
        box = g[64]      # (64,H,W)
        sc = g[1]        # (1,H,W)
        kp = g[51]       # (51,H,W)

        # boxes
        dets = decode_boxes(box, sc, hh, ww, stride, gx, gy, conf_thresh=conf_thresh)

        # keypoints for all cells: (hh, ww, 17, 3) norm coords
        kpts_all = decode_kpts_batch(kp, hh, ww, stride, gx, gy, dw, dh, scale, orig_w, orig_h, layout)

        for d in dets:
            # find nearest cell to detection center
            cyy = int(round(d["cy"] / stride))
            cxx = int(round(d["cx"] / stride))
            cyy = min(max(cyy, 0), hh - 1)
            cxx = min(max(cxx, 0), ww - 1)
            kpts_cell = kpts_all[cyy, cxx]  # (17, 3)

            # build 56-row in letterbox space for NMS compatibility
            x1 = d["cx"] - d["bw"] / 2
            y1 = d["cy"] - d["bh"] / 2
            row = np.concatenate([
                [d["cx"], d["cy"], d["bw"], d["bh"], d["conf"]],
                kpts_cell[:, 0] * size,   # kx in letterbox px
                kpts_cell[:, 1] * size,   # ky in letterbox px
                kpts_cell[:, 2],          # kv
            ])
            all_raw.append(row)

    if not all_raw:
        return []

    raw = np.stack(all_raw).astype(np.float32)
    raw = raw[raw[:, 4] >= 0.35]
    if raw.shape[0] == 0:
        return []

    # NMS on boxes
    boxes_nms = np.stack((raw[:, 0] - raw[:, 2] / 2,
                          raw[:, 1] - raw[:, 3] / 2,
                          raw[:, 2], raw[:, 3]), axis=1)
    ids = cv2.dnn.NMSBoxes(boxes_nms.tolist(), raw[:, 4].tolist(), 0.35, iou_thresh)
    if len(ids) == 0:
        return []

    people = []
    for idx in np.asarray(ids).reshape(-1)[:6]:
        r = raw[int(idx)]
        x1, y1, bw, bh = r[0] - r[2] / 2, r[1] - r[3] / 2, r[2], r[3]
        # normalize to original image
        b = (
            max(0.0, min(1.0, (x1 - dw) / scale / orig_w)),
            max(0.0, min(1.0, (y1 - dh) / scale / orig_h)),
            max(0.0, min(1.0, (x1 + bw - dw) / scale / orig_w)),
            max(0.0, min(1.0, (y1 + bh - dh) / scale / orig_h)),
        )
        keypoints = []
        for i in range(17):
            kx = float(np.clip(r[5 + i * 3 + 0] / size, 0.0, 1.0))  # already letterbox px, norm to size
            ky = float(np.clip(r[5 + i * 3 + 1] / size, 0.0, 1.0))
            kv = float(np.clip(r[5 + i * 3 + 2], 0.0, 1.0))
            keypoints.append((kx, ky, kv))
        people.append({
            "bbox": b,
            "conf": float(r[4]),
            "keypoints": keypoints,
        })
    return people


def draw_skeleton(image, person, layout_tag):
    """Draw skeleton overlay on image. Returns annotated image."""
    img = image.copy()
    h, w = img.shape[:2]
    kps = person["keypoints"]
    pos = {}
    for i, name in enumerate(COCO17):
        x, y, v = kps[i]
        if v >= 0.35 and 0.005 < x < 0.995 and 0.005 < y < 0.995:
            pos[name] = (int(x * w), int(y * h))

    # edges
    for a, b in SKELETON_EDGES:
        if a in pos and b in pos:
            cv2.line(img, pos[a], pos[b], (0, 255, 255), 2)
    # keypoints
    for name, (px, py) in pos.items():
        cv2.circle(img, (px, py), 5, (0, 255, 255), -1)
        cv2.circle(img, (px, py), 5, (255, 255, 255), 1)

    # bbox
    x1, y1, x2, y2 = person["bbox"]
    cv2.rectangle(img, (int(x1 * w), int(y1 * h)), (int(x2 * w), int(y2 * h)), (0, 255, 0), 2)
    cv2.putText(img, f"{layout_tag} conf={person['conf']:.2f}",
                (int(x1 * w), max(0, int(y1 * h) - 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return img


def compute_metrics(people, orig_w, orig_h):
    """Quantitative metrics for judging layout correctness."""
    if not people:
        return {
            "num_people": 0,
            "kp_in_image_ratio": 0.0,
            "kp_in_bbox_ratio": 0.0,
            "avg_conf": 0.0,
            "bbox_area": 0.0,
            "kp_centroid_x": 0.0,
            "kp_centroid_y": 0.0,
            "kp_spread_x": 0.0,
            "kp_spread_y": 0.0,
        }

    # pick the highest-conf person
    person = max(people, key=lambda p: p["conf"])
    kps = person["keypoints"]
    visible = [(x, y, v) for (x, y, v) in kps if v >= 0.35]

    in_image = sum(1 for (x, y, v) in kps if 0.005 < x < 0.995 and 0.005 < y < 0.995)
    kp_in_image_ratio = in_image / 17.0

    # keypoints within bbox
    x1, y1, x2, y2 = person["bbox"]
    in_bbox = sum(1 for (x, y, v) in kps if v >= 0.35 and x1 <= x <= x2 and y1 <= y <= y2)
    visible_count = len(visible)
    kp_in_bbox_ratio = in_bbox / visible_count if visible_count else 0.0

    avg_conf = float(np.mean([v for (_, _, v) in kps]))
    xs = [x for (x, y, v) in kps]
    ys = [y for (x, y, v) in kps]
    centroid_x = float(np.mean(xs))
    centroid_y = float(np.mean(ys))
    spread_x = float(np.std(xs))
    spread_y = float(np.std(ys))

    bbox_area = float((x2 - x1) * (y2 - y1))

    return {
        "num_people": int(len(people)),
        "kp_in_image_ratio": float(round(kp_in_image_ratio, 4)),
        "kp_in_bbox_ratio": float(round(kp_in_bbox_ratio, 4)),
        "avg_conf": float(round(avg_conf, 4)),
        "bbox_area": float(round(bbox_area, 4)),
        "bbox": [float(round(v, 4)) for v in person["bbox"]],
        "kp_centroid_x": float(round(centroid_x, 4)),
        "kp_centroid_y": float(round(centroid_y, 4)),
        "kp_spread_x": float(round(spread_x, 4)),
        "kp_spread_y": float(round(spread_y, 4)),
        "visible_count": int(visible_count),
    }


def main():
    parser = argparse.ArgumentParser(description="Compare YOLO11n-pose 51-channel layouts")
    parser.add_argument("--model", required=True, help="Path to yolo11n-pose.onnx")
    parser.add_argument("--images", nargs="+", required=True, help="Input image paths")
    parser.add_argument("--out", default="pose_layout_report", help="Output directory")
    parser.add_argument("--size", type=int, default=640, help="Inference size")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = ort.InferenceSession(args.model)
    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    output_names = [o.name for o in session.get_outputs()]

    # model signature
    signature = {
        "input": {"name": input_name, "shape": input_shape},
        "outputs": [{"name": o.name, "shape": list(o.shape)} for o in session.get_outputs()],
    }
    with open(out_dir / "model_signature.json", "w", encoding="utf-8") as f:
        json.dump(signature, f, indent=2, ensure_ascii=False)

    summary = {"images": []}
    csv_rows = []

    for img_path in args.images:
        img_path = Path(img_path)
        if not img_path.exists():
            print(f"SKIP (not found): {img_path}")
            continue
        image = cv2.imread(str(img_path))
        if image is None:
            print(f"SKIP (unreadable): {img_path}")
            continue
        orig_h, orig_w = image.shape[:2]

        tensor, dw, dh, scale, ow, oh = letterbox(image, args.size)
        outputs = run_inference(session, input_name, tensor)

        img_summary = {"image": str(img_path), "layouts": {}}

        for layout in ("A", "B"):
            people = detect_poses(outputs, args.size, dw, dh, scale, ow, oh, layout)
            metrics = compute_metrics(people, ow, oh)
            img_summary["layouts"][layout] = metrics

            # draw overlay
            if people:
                annotated = draw_skeleton(image, max(people, key=lambda p: p["conf"]), layout)
                out_name = f"pose_layout_{layout}_{img_path.stem}.png"
                cv2.imwrite(str(out_dir / out_name), annotated)

            # CSV rows (unclipped keypoints for best person)
            if people:
                best = max(people, key=lambda p: p["conf"])
                for i, (x, y, v) in enumerate(best["keypoints"]):
                    csv_rows.append({
                        "image": img_path.name,
                        "layout": layout,
                        "keypoint": COCO17[i],
                        "x": round(x, 6),
                        "y": round(y, 6),
                        "v": round(v, 6),
                    })

        summary["images"].append(img_summary)
        print(f"{img_path.name}: A kp_in_image={img_summary['layouts']['A']['kp_in_image_ratio']} "
              f"B kp_in_image={img_summary['layouts']['B']['kp_in_image_ratio']} "
              f"A kp_in_bbox={img_summary['layouts']['A']['kp_in_bbox_ratio']} "
              f"B kp_in_bbox={img_summary['layouts']['B']['kp_in_bbox_ratio']}")

    with open(out_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    with open(out_dir / "keypoints_unclipped.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["image", "layout", "keypoint", "x", "y", "v"])
        writer.writeheader()
        writer.writerows(csv_rows)

    print(f"\nReport written to: {out_dir.resolve()}")
    print(f"  model_signature.json, summary.json, keypoints_unclipped.csv")
    print(f"  pose_layout_A/B_*.png overlays")


if __name__ == "__main__":
    main()
