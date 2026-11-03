import math
from respiration import Respiration


def test_warmup_and_quality_gate():
    r = Respiration()
    r.ingest([(1, 1000000, 0.1)], {"human": 1, "quality": "ok"}, 10)
    assert r.report(10)["status"] == "warming_up"
    r.ingest([], {"human": 0, "quality": "ok"}, 11)
    assert r.report(11)["status"] == "unavailable_or_motion"


def test_synthetic_regular_breathing():
    r = Respiration()
    samples = []
    # 20 Hz, 90 s, 12 breaths/minute phase for algorithm validation only.
    for i in range(1801):
        sec = i * .05
        samples.append((i + 1, int(sec * 1e6) + 10_000, math.sin(2 * math.pi * .2 * sec)))
    for i in range(0, len(samples), 100):
        r.ingest(samples[i:i + 100], {"human": 1, "quality": "ok", "bpm_module": 12.0}, 100)
    report = r.report(100)
    assert report["status"] == "ok", report
    assert abs(report["breaths_per_min"] - 12) < .6, report
    assert report["breath_interval_cv"] < .08
