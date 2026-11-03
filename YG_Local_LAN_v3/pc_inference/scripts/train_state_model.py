"""Optional research-only training: subject-separated validation is mandatory.
Expected CSV: participant_id,label,feature...; never use on uninformed subjects.
Example:
 python scripts/train_state_model.py --csv labeled.csv --features movement_index,shoulder_asymmetry,breaths_per_min --out models/state.joblib
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--csv", required=True)
p.add_argument("--features", required=True, help="Comma-separated subset of fusion_features")
p.add_argument("--out", required=True)
p.add_argument("--min-f1", type=float, default=.70)
args = p.parse_args()

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, f1_score
import joblib

features = [x.strip() for x in args.features.split(",")]
frame = pd.read_csv(args.csv)
needed = ["participant_id", "label"] + features
if any(k not in frame.columns for k in needed):
    raise SystemExit(f"Missing columns: {set(needed) - set(frame.columns)}")
frame = frame.dropna(subset=needed)
if len(frame) < 100 or frame["participant_id"].nunique() < 5 or frame["label"].nunique() < 2:
    raise SystemExit("Require >=100 labeled rows, >=5 independent subjects, >=2 classes")
splitter = GroupShuffleSplit(n_splits=1, test_size=.25, random_state=42)
train, test = next(splitter.split(frame[features], frame["label"], frame["participant_id"]))
if len(set(frame.iloc[train]["label"])) < 2 or len(set(frame.iloc[test]["label"])) < 2:
    raise SystemExit("Subject split lacks class coverage; gather more data")
model = RandomForestClassifier(n_estimators=250, max_depth=8, min_samples_leaf=5,
                               class_weight="balanced", random_state=42)
model.fit(frame.iloc[train][features], frame.iloc[train]["label"])
pred = model.predict(frame.iloc[test][features])
macro = f1_score(frame.iloc[test]["label"], pred, average="macro", zero_division=0)
print(classification_report(frame.iloc[test]["label"], pred, zero_division=0))
print(f"Independent-subject macro-F1: {macro:.3f}")
if macro < args.min_f1:
    raise SystemExit(f"F1 below acceptance threshold ({args.min_f1}); not exporting")
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(model, out)
manifest = {"version": "research-subject-split-1", "features": features,
            "validated_on_independent_subjects": True, "macro_f1": round(float(macro), 3),
            "train_subject_count": int(frame.iloc[train]["participant_id"].nunique()),
            "test_subject_count": int(frame.iloc[test]["participant_id"].nunique()),
            "limitations": "Research-only candidate state, not psychological diagnosis"}
out.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Wrote {out} and {out.with_suffix('.manifest.json')}")
