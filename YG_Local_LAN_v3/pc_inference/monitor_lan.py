"""YG Local LAN v3 传感器实时监控面板。

轮询 pc_inference/reports/sensor01_latest.json（PC 推理服务每秒落盘的最新报告），
显示上传健康度、帧率曲线、呼吸率曲线、呼吸相位图、RGB+YOLO 骨架叠加与各传感器状态。
只用标准库（tkinter），无额外依赖。

只观测，不修改任何数据路径。
"""
import base64
import json
import tempfile
import time
import tkinter as tk
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

REPORT = Path(__file__).resolve().parent / "reports" / "sensor01_latest.json"
JSONL = Path(__file__).resolve().parent / "reports" / "sensor01.jsonl"
POLL_MS = 1000
HISTORY_LEN = 150          # 曲线保留的秒数
STALE_WARN_S = 5           # 报告超过该秒数未更新 → STALE
STALE_BAD_S = 30           # 超过该秒数 → 断流（红）

FG_OK = "#1a7f37"
FG_WARN = "#b45309"
FG_BAD = "#b91c1c"
FG_OFF = "#6b7280"
KEYPOINT_OK = "#22d3ee"

# COCO-17 骨架连线：两端均可见（score >= 0.35）才绘制
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

COCO17_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
    "right_knee", "left_ankle", "right_ankle",
)


def parse_utc(s):
    """pc_generated_at_utc -> epoch 秒；解析失败返回 None。"""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


class Panel:
    def __init__(self, root: tk.Tk):
        self.root = root
        root.title("YG LAN v3 · 传感器监控")
        root.geometry("700x1020")
        root.configure(bg="#0f172a")

        self.hist = deque(maxlen=HISTORY_LEN)      # (epoch, fps) 帧率曲线
        self.breath_hist = deque(maxlen=HISTORY_LEN)  # (epoch, bpm) 呼吸率曲线
        self.last_seq = None
        self.last_t = None
        self.boot_id = None
        self.jsonl_size = None
        self.last_landmarks = {}                    # 最近一帧 COCO-17 关键点
        self.last_bpm = None
        self.last_image_ppm = None                  # 最新帧 PPM base64
        self.last_image_ppm_bytes = None            # 最新帧 PPM 原始字节
        self.tk_ppm_path = Path(tempfile.gettempdir()) / "yg_monitor_frame.ppm"
        self.last_phase_wave = []                   # [(t_sec, phase), ...] 呼吸相位序列
        self.skel_img = None                        # PhotoImage 引用，防 GC
        self.skel_ox = self.skel_oy = 0             # 图像在画布上的偏移
        self.skel_disp_w = self.skel_disp_h = 0     # 图像在画布上的显示尺寸

        head = tk.Label(root, text="YG Local LAN v3 · sensor01",
                        fg="#e2e8f0", bg="#0f172a", font=("Consolas", 14, "bold"))
        head.pack(anchor="w", padx=12, pady=(10, 2))

        self.status = tk.Label(root, text="…", fg="#e2e8f0", bg="#0f172a",
                               font=("Consolas", 12))
        self.status.pack(anchor="w", padx=12)

        frm = tk.Frame(root, bg="#0f172a")
        frm.pack(anchor="w", padx=12, pady=8)
        self.rows = {}
        grid = [
            ("frame_seq", "帧序号"),
            ("fps", "上传帧率"),
            ("boot_id", "boot_id（变化=板子重启）"),
            ("device_time", "板子运行时间"),
            ("pose", "姿态（PC 推理）"),
            ("yolo", "YOLO 检测目标"),
            ("resp", "雷达呼吸"),
            ("posture", "坐姿观察"),
            ("jsonl", "累计上报（jsonl）"),
        ]
        for i, (key, label) in enumerate(grid):
            lab = tk.Label(frm, text=f"{label:<24}", fg="#94a3b8", bg="#0f172a",
                           font=("Consolas", 10), anchor="e", width=26)
            lab.grid(row=i, column=0, sticky="e", pady=1)
            val = tk.Label(frm, text="—", fg="#e2e8f0", bg="#0f172a",
                           font=("Consolas", 10), anchor="w", width=44)
            val.grid(row=i, column=1, sticky="w", pady=1)
            self.rows[key] = val

        tk.Label(root, text="上传帧率（最近 150 秒，fps）",
                 fg="#94a3b8", bg="#0f172a", font=("Consolas", 10)).pack(anchor="w", padx=12)
        self.canvas_fps = tk.Canvas(root, width=660, height=100, bg="#1e293b",
                                    highlightthickness=0)
        self.canvas_fps.pack(padx=12, pady=(2, 8))

        tk.Label(root, text="呼吸率（最近 150 秒，bpm，来自 LD6002 模组原生 0x0A14 帧）",
                 fg="#94a3b8", bg="#0f172a", font=("Consolas", 10)).pack(anchor="w", padx=12)
        self.canvas_breath = tk.Canvas(root, width=660, height=100, bg="#1e293b",
                                       highlightthickness=0)
        self.canvas_breath.pack(padx=12, pady=(2, 8))

        tk.Label(root, text="呼吸相位（LD6002 原始相位波形，最近 200 点）",
                 fg="#94a3b8", bg="#0f172a", font=("Consolas", 10)).pack(anchor="w", padx=12)
        self.canvas_phase = tk.Canvas(root, width=660, height=100, bg="#1e293b",
                                      highlightthickness=0)
        self.canvas_phase.pack(padx=12, pady=(2, 8))

        tk.Label(root, text="RGB 画面 + YOLO11n-pose 骨架（COCO-17，置信度≥0.35）",
                 fg="#94a3b8", bg="#0f172a", font=("Consolas", 10)).pack(anchor="w", padx=12)
        self.canvas_skel = tk.Canvas(root, width=360, height=480, bg="#1e293b",
                                     highlightthickness=0)
        self.canvas_skel.pack(padx=12, pady=(2, 8))

        self.limit = tk.Label(root, text="", fg="#64748b", bg="#0f172a",
                              font=("Consolas", 9), justify="left", anchor="w")
        self.limit.pack(anchor="w", padx=12, pady=(2, 8))

        self.poll()

    # ---------- helpers ----------
    @staticmethod
    def set(row, text, color="#e2e8f0"):
        row.config(text=text, fg=color)

    @staticmethod
    def human_uptime(us):
        if not us:
            return "—"
        s = int(us / 1_000_000)
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h:d}h{m:02d}m{sec:02d}s"

    # ---------- poll ----------
    def poll(self):
        # 单帧数据/渲染异常只提示，不让整个面板崩溃退出。
        try:
            self._poll_once()
        except Exception as exc:  # noqa: BLE001
            try:
                self.status.config(text=f"✕ 面板异常: {exc}", fg=FG_BAD)
            except Exception:  # noqa: BLE001
                pass
        self.root.after(POLL_MS, self.poll)

    def _poll_once(self):
        now = time.time()
        try:
            raw = REPORT.read_text(encoding="utf-8")
            data = json.loads(raw)
        except FileNotFoundError:
            self.status.config(text="✕ 未找到报告文件（PC 推理服务未运行？）", fg=FG_BAD)
        except Exception as exc:  # noqa: BLE001
            self.status.config(text=f"✕ 读取失败: {exc}", fg=FG_BAD)
        else:
            gen = parse_utc(data.get("pc_generated_at_utc"))
            latency = (now - gen) if gen else None
            if latency is None:
                self.status.config(text="○ 报告缺时间戳", fg=FG_WARN)
            elif latency <= STALE_WARN_S:
                self.status.config(text=f"● 实时（延迟 {latency:.1f}s）", fg=FG_OK)
            elif latency <= STALE_BAD_S:
                self.status.config(text=f"◐ 滞后（{latency:.1f}s 未更新）", fg=FG_WARN)
            else:
                self.status.config(text=f"✕ 断流（{latency:.0f}s 未更新）", fg=FG_BAD)

            seq = data.get("frame_seq")
            if isinstance(seq, int):
                if self.last_seq is not None and gen:
                    dt = now - self.last_t if self.last_t else 1.0
                    fps = max(0.0, (seq - self.last_seq) / max(dt, 0.001))
                    self.hist.append((now, min(fps, 5.0)))
                self.last_seq, self.last_t = seq, now
                self.set(self.rows["frame_seq"], f"{seq:,}")
                recent = [f for _, f in list(self.hist)[-10:]]
                avg = sum(recent) / len(recent) if recent else 0.0
                color = FG_OK if avg >= 0.7 else (FG_WARN if avg > 0.1 else FG_BAD)
                self.set(self.rows["fps"], f"{avg:.2f} fps（近 10s 均值）", color)
            else:
                self.set(self.rows["frame_seq"], "—", FG_OFF)

            boot = data.get("boot_id")
            if boot != self.boot_id:
                if self.boot_id is not None:
                    self.set(self.rows["boot_id"],
                             f"{boot}（⚠ 刚重启）", FG_WARN)
                else:
                    self.set(self.rows["boot_id"], str(boot))
                self.boot_id = boot

            self.set(self.rows["device_time"],
                     self.human_uptime(data.get("device_timestamp_us")))

            pose = (data.get("pose") or {})
            pstatus = pose.get("status")
            pmap = {"ok": ("正常", FG_OK), "model_unavailable": ("模型未配置", FG_OFF)}
            ptxt, pcol = pmap.get(pstatus, (pstatus or "—", FG_WARN))
            conf = pose.get("confidence")
            n = 1 if pstatus == "ok" and pose.get("landmarks_coco17") else 0
            extra = ""
            if conf is not None:
                extra += f" conf={conf:.2f}"
            self.set(self.rows["pose"], f"{ptxt}{extra} n={n}", pcol)

            # YOLO 检测目标：bbox 归一化坐标 + 主要关键点摘要
            landmarks = pose.get("landmarks_coco17") or {}
            self.last_landmarks = landmarks
            bbox = pose.get("bbox_xyxy_normalized")
            if pstatus == "ok" and bbox:
                x1, y1, x2, y2 = bbox
                kp_sum = []
                for name in ("nose", "left_shoulder", "right_shoulder"):
                    kp = landmarks.get(name)
                    if kp and kp.get("score", 0) >= 0.35:
                        kp_sum.append(f"{name}=({kp['x']:.2f},{kp['y']:.2f})")
                kp_txt = " ".join(kp_sum) if kp_sum else "关键点低置信"
                self.set(self.rows["yolo"],
                         f"bbox=({x1:.2f},{y1:.2f},{x2:.2f},{y2:.2f}) {kp_txt}",
                         FG_OK)
            else:
                self.set(self.rows["yolo"], "无目标", FG_OFF)

            r = data.get("respiration") or {}
            bpm = r.get("breaths_per_min") or r.get("module_bpm")
            self.last_bpm = bpm
            if bpm and r.get("status") == "ok":
                self.breath_hist.append((now, float(bpm)))
                self.set(self.rows["resp"],
                         f"{r['status']}  bpm={bpm:.1f}  样本={r.get('phase_samples_retained')}",
                         FG_OK)
            else:
                self.set(self.rows["resp"],
                         f"{r.get('status') or '—'}  quality={r.get('quality') or '—'}  "
                         f"样本={r.get('phase_samples_retained')}",
                         FG_WARN if r.get("status") != "ok" else FG_OK)

            # 呼吸相位序列（server 写入的最近 200 点）
            pw = data.get("phase_wave") or []
            self.last_phase_wave = [(float(t), float(p)) for t, p in pw]

            # 最新帧 PPM base64
            self.last_image_ppm = data.get("image_ppm")

            po = data.get("posture_observations") or {}
            self.set(self.rows["posture"],
                     f"{po.get('status') or '—'}  label={po.get('label') or '—'}",
                     FG_OK if po.get("status") == "ok" else FG_WARN)

            try:
                size = JSONL.stat().st_size
                growth = "" if self.jsonl_size is None else \
                    f"（+{size - self.jsonl_size} B/s）" if size != self.jsonl_size else ""
                self.jsonl_size = size
                self.set(self.rows["jsonl"], f"{size:,} B {growth}")
            except OSError:
                self.set(self.rows["jsonl"], "—", FG_OFF)

            lim = data.get("limitations") or []
            self.limit.config(text="限制: " + ", ".join(lim) if lim else "")

            self.draw()

    # ---------- drawing ----------
    def _draw_curve(self, canvas, hist, y_max, label_unit):
        c = canvas
        c.delete("all")
        w, h = 660, 100
        c.create_line(0, h - 1, w, h - 1, fill="#334155")
        if len(hist) < 2:
            c.create_text(w // 2, h // 2, text="采样中…", fill="#64748b")
            return
        pts = list(hist)
        t0, t1 = pts[0][0], pts[-1][0]
        span = max(t1 - t0, 1.0)
        prev = None
        for t, val in pts:
            x = (t - t0) / span * (w - 8) + 4
            y = h - 4 - min(val, y_max) / y_max * (h - 12)
            if prev:
                c.create_line(prev[0], prev[1], x, y, fill="#38bdf8", width=2)
            prev = (x, y)
        c.create_text(6, 6, text=f"{y_max:.0f}", fill="#475569", anchor="w")
        c.create_text(6, h - 14, text="0", fill="#475569", anchor="w")
        c.create_text(w - 6, h - 14, text=label_unit, fill="#475569", anchor="e")

    def _draw_phase_wave(self, canvas):
        c = canvas
        c.delete("all")
        w, h = 660, 100
        c.create_line(0, h - 1, w, h - 1, fill="#334155")
        wave = self.last_phase_wave
        if not wave or len(wave) < 2:
            c.create_text(w // 2, h // 2, text="采样中…", fill="#64748b")
            return
        pts = wave[-200:]
        t0 = pts[0][0]
        t1 = pts[-1][0]
        span = max(t1 - t0, 1.0)
        phases = [p for _, p in pts]
        pmin, pmax = min(phases), max(phases)
        prange = max(pmax - pmin, 1.0)
        cy = h / 2
        amp = (h - 12) / 2
        prev = None
        for t, p in pts:
            x = (t - t0) / span * (w - 8) + 4
            y = cy - (p - pmin) / prange * amp
            if prev:
                c.create_line(prev[0], prev[1], x, y, fill=KEYPOINT_OK, width=1)
            prev = (x, y)
        c.create_text(6, 6, text=f"{pmax:.1f}", fill="#475569", anchor="w")
        c.create_text(6, h - 14, text=f"{pmin:.1f}", fill="#475569", anchor="w")
        c.create_text(w - 6, h - 14, text="相位", fill="#475569", anchor="e")

    def _draw_rgb_skeleton(self, canvas):
        c = canvas
        c.delete("all")
        w, h = 360, 480
        landmarks = self.last_landmarks or {}

        # 显示 RGB 图像（底层，tkinter 原生 PPM 支持，无颜色空间问题）
        image_ppm = self.last_image_ppm
        self.skel_ox = self.skel_oy = 0
        self.skel_disp_w = self.skel_disp_h = 0
        if image_ppm:
            try:
                ppm_bytes = base64.b64decode(image_ppm)
                if ppm_bytes != self.last_image_ppm_bytes:
                    self.last_image_ppm_bytes = ppm_bytes
                    self.tk_ppm_path.write_bytes(ppm_bytes)
                img = tk.PhotoImage(file=str(self.tk_ppm_path))
                self.skel_img = img  # 保持引用，防止被 GC
                iw, ih = img.width(), img.height()
                if iw > 0 and ih > 0:
                    scale = min((w - 16) / iw, (h - 24) / ih)  # 允许放大到填满画布，骨架更清晰
                    self.skel_disp_w = int(iw * scale)
                    self.skel_disp_h = int(ih * scale)
                    self.skel_ox = (w - self.skel_disp_w) // 2
                    self.skel_oy = 8
                    c.create_image(self.skel_ox, self.skel_oy, anchor="nw", image=img)
            except Exception:  # noqa: BLE001
                self.skel_img = None

        def visible(name):
            kp = landmarks.get(name)
            if not kp:
                return None
            # YOLO 有时对不可见关键点返回 (0,0) 但置信度异常偏高（如 right_hip score=1.0 @ (0,0)），
            # 必须同时满足 score 阈值和坐标合理性，否则会画出左上角的"鬼点"。
            if kp.get("score", 0) < 0.35:
                return None
            if kp["x"] <= 0.005 or kp["y"] <= 0.005 or kp["x"] >= 0.995 or kp["y"] >= 0.995:
                return None
            return kp

        # 归一化坐标 -> 画布像素
        pos = {}
        for name in COCO17_NAMES:
            kp = visible(name)
            if kp:
                px = self.skel_ox + kp["x"] * self.skel_disp_w
                py = self.skel_oy + kp["y"] * self.skel_disp_h
                pos[name] = (px, py)

        # 先画连线（在点下方）
        for a, b in SKELETON_EDGES:
            if a in pos and b in pos:
                (xa, ya), (xb, yb) = pos[a], pos[b]
                c.create_line(xa, ya, xb, yb, fill=KEYPOINT_OK, width=2)

        # 再画关键点
        for name, (x, y) in pos.items():
            c.create_oval(x - 4, y - 4, x + 4, y + 4,
                          fill=KEYPOINT_OK, outline="white", width=1)

        if not pos:
            hint = "无骨架数据"
            if not image_ppm:
                hint += "（等待摄像头帧）"
            else:
                hint += "（空场景或关键点置信度不足）"
            c.create_text(w // 2, h // 2, text=hint, fill="#64748b", font=("Consolas", 10))

    def draw(self):
        self._draw_curve(self.canvas_fps, self.hist, 2.0, "fps")
        self._draw_curve(self.canvas_breath, self.breath_hist, 40.0, "bpm")
        self._draw_phase_wave(self.canvas_phase)
        self._draw_rgb_skeleton(self.canvas_skel)


def main():
    root = tk.Tk()
    Panel(root)
    root.mainloop()


if __name__ == "__main__":
    main()
