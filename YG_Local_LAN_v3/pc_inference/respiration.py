"""LD6002 raw phase time-series -> respiratory variation estimate on PC CPU.
Outputs 'warming_up' unless at least 60 s and 6 detected breaths are available.
Not HRV, not a medical device.
"""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
import math
import statistics
import numpy as np

@dataclass
class Respiration:
    raw: deque = field(default_factory=lambda: deque(maxlen=20000))
    last_seq: int = -1
    last_stamp: int = 0
    last_packet_s: float = -1e9
    radar_meta: dict = field(default_factory=dict)

    def ingest(self, samples: list[tuple[int, int, float]], radar_meta: dict, now_s: float):
        self.last_packet_s = now_s
        self.radar_meta = radar_meta
        for seq, stamp_us, phase in samples:
            if seq <= self.last_seq and self.last_seq >= 0:
                continue
            # The device may restart: reset this object at boot_id change in server.
            if not math.isfinite(phase) or (self.last_stamp and stamp_us <= self.last_stamp):
                continue
            self.raw.append((stamp_us / 1e6, phase))
            self.last_stamp, self.last_seq = stamp_us, seq
        if self.raw:
            newest = self.raw[-1][0]
            while self.raw and self.raw[0][0] < newest - 185:
                self.raw.popleft()

    def report(self, now_s: float) -> dict:
        meta = self.radar_meta
        human = meta.get("human", -1)
        quality = meta.get("quality", "unknown")
        raw_bpm = meta.get("bpm_module")
        result = {"status": "warming_up", "breaths_per_min": None,
                  "breath_interval_cv": None, "breath_intervals_used": 0,
                  "window_seconds": None,
                  "module_bpm": round(float(raw_bpm), 2)
                  if isinstance(raw_bpm, (float, int)) and 5 <= raw_bpm <= 40 else None,
                  "phase_samples_retained": len(self.raw), "quality": quality}
        if now_s - self.last_packet_s > 5.0 or human != 1 or quality not in ("ok", "module"):
            result["status"] = "unavailable_or_motion"
            return result
        if len(self.raw) < 120:
            return result
        t, p = np.asarray(self.raw, dtype=np.float64).T
        length = float(t[-1] - t[0])
        result["window_seconds"] = round(length, 1)
        if length < 60:
            return result
        delta = np.diff(t)
        good = delta[(delta > .005) & (delta < .25)]
        if good.size < 80:
            result["status"] = "insufficient_samples"
            return result
        fs = float(min(50., max(5., 1. / np.median(good))))
        # Interpolate missing samples before filtering; reject prolonged packet gaps.
        grid = np.arange(t[0], t[-1], 1. / fs)
        if grid.size < 200 or np.count_nonzero(delta > .7) > 4:
            result["status"] = "large_gaps"
            return result
        from scipy.signal import butter, sosfiltfilt, find_peaks, detrend
        regular = np.interp(grid, t, p)
        regular = detrend(regular)
        sos = butter(3, (0.08, 0.55), btype="bandpass", fs=fs, output="sos")
        clean = sosfiltfilt(sos, regular)
        if np.std(clean) < 1e-6:
            result["status"] = "weak_signal"
            return result
        # A breath interval from phase extrema requires sustained, plausible cycles.
        peaks, _ = find_peaks(clean, distance=int(1.2 * fs),
                             prominence=max(1e-6, .35 * np.std(clean)))
        if len(peaks) < 7:
            result["status"] = "insufficient_breaths"
            return result
        intervals = np.diff(grid[peaks])
        intervals = intervals[(intervals >= 1.5) & (intervals <= 10.0)]
        if len(intervals) < 6:
            result["status"] = "insufficient_breaths"
            return result
        mean = float(np.mean(intervals))
        cv = float(np.std(intervals, ddof=1) / mean)
        result.update(status="ok", breaths_per_min=round(60 / mean, 2),
                      breath_interval_cv=round(cv, 4),
                      breath_intervals_used=len(intervals),
                      window_seconds=round(length, 1))
        return result
