"""Optional user-trained and independently validated classifier.
Never silently replace missing modalities with arbitrary means.
"""
from __future__ import annotations
import json
from pathlib import Path
import math

class PsychologicalEstimator:
    def __init__(self, model_path: str = ""):
        self.model = None
        self.meta = None
        self.reason = "No validated trained model supplied"
        if model_path:
            import joblib
            path = Path(model_path)
            meta_path = path.with_suffix(".manifest.json")
            self.meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if not self.meta.get("validated_on_independent_subjects", False):
                self.reason = "Model manifest lacks independent-subject validation"
                return
            self.model = joblib.load(path)
            self.reason = ""

    def predict(self, features: dict) -> dict:
        if self.model is None:
            return {"label": "unknown", "confidence": None,
                    "validated": False, "reason": self.reason}
        names = self.meta.get("features", [])
        if not names or any(features.get(name) is None or
                            not math.isfinite(features[name]) for name in names):
            return {"label": "unknown", "confidence": None,
                    "validated": bool(self.meta.get("validated_on_independent_subjects")),
                    "reason": "Required sensor feature missing"}
        import numpy as np
        x = np.array([[features[k] for k in names]], dtype=np.float64)
        probs = self.model.predict_proba(x)[0]
        i = int(np.argmax(probs))
        return {"label": str(self.model.classes_[i]),
                "confidence": round(float(probs[i]), 3),
                "validated": True, "reason": "model_estimate_not_diagnosis",
                "model_version": self.meta.get("version")}
