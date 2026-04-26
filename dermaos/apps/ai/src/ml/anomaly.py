"""Detecção de anomalia em séries temporais via IsolationForest."""
from __future__ import annotations

import numpy as np

from ..config import settings
from ..logging_setup import get_logger

logger = get_logger(__name__)

MODEL_VERSION = "isolation_forest.v1"


def detect(
    values: list[float],
    timestamps: list[str],
    contamination: float | None = None,
) -> dict:
    from sklearn.ensemble import IsolationForest

    if len(values) != len(timestamps):
        raise ValueError("values_timestamps_length_mismatch")

    if contamination is None:
        contamination = settings.isolation_default_contamination
    contamination = max(0.001, min(0.499, float(contamination)))

    arr = np.array(values, dtype=np.float64).reshape(-1, 1)
    model = IsolationForest(
        n_estimators=128,
        contamination=contamination,
        random_state=42,
        n_jobs=1,
    )
    model.fit(arr)

    pred = model.predict(arr)              # -1 anomalia, 1 normal
    raw_scores = model.decision_function(arr)
    # decision_function: maior = mais normal. Convertemos em anomaly_score.
    anomaly_scores = -raw_scores

    anomalies: list[dict] = []
    for i, (p, s, v, ts) in enumerate(zip(pred, anomaly_scores, values, timestamps)):
        if int(p) == -1:
            anomalies.append(
                {
                    "index": i,
                    "value": float(v),
                    "score": round(float(s), 6),
                    "timestamp": ts,
                }
            )

    return {
        "anomalies": anomalies,
        "is_anomalous": len(anomalies) > 0,
        "anomaly_count": len(anomalies),
        "contamination_used": round(contamination, 4),
        "model_version": MODEL_VERSION,
    }


class AnomalyModel:
    """Stateless — apenas reporta status. Treinado por chamada."""

    loaded: bool = True
    error: str | None = None
    version: str = MODEL_VERSION


anomaly_model = AnomalyModel()
