"""Random Forest para lead scoring (carregado de joblib ou sintético no boot).

Em produção, o artefato `lead_scorer.joblib` (treinado com dados
históricos de conversão) é montado em /app/artifacts. Em dev, geramos
um modelo sintético determinístico para que o serviço suba.
"""
from __future__ import annotations

import os
from typing import Optional

import joblib
import numpy as np

from ..config import settings
from ..logging_setup import get_logger

logger = get_logger(__name__)

SOURCES = ["whatsapp", "instagram", "telegram", "email", "website", "referral", "other"]
NUMERIC_FEATURES = ["interactions", "time_since_first", "response_time"]


def _onehot_source(source: str) -> list[float]:
    return [1.0 if source == s else 0.0 for s in SOURCES]


def feature_names() -> list[str]:
    return [f"source_{s}" for s in SOURCES] + NUMERIC_FEATURES


def vectorize(payload: dict) -> np.ndarray:
    src = payload.get("source", "other")
    row = _onehot_source(src) + [
        float(payload.get("interactions", 0)),
        float(payload.get("time_since_first", 0.0)),
        float(payload.get("response_time", 0.0)),
    ]
    return np.array(row, dtype=np.float64).reshape(1, -1)


class LeadScorerModel:
    def __init__(self) -> None:
        self.loaded = False
        self.error: Optional[str] = None
        self.version: str = "lead_scorer.synthetic.v1"
        self._model = None
        self._features = feature_names()

    def load(self) -> None:
        path = settings.lead_model_path
        try:
            if os.path.exists(path):
                payload = joblib.load(path)
                if isinstance(payload, dict):
                    self._model = payload["model"]
                    self.version = payload.get("version", "lead_scorer.persisted")
                else:
                    self._model = payload
                    self.version = "lead_scorer.persisted"
            else:
                self._model = self._fit_synthetic()
            self.loaded = True
            self.error = None
            logger.info("ml.lead_scorer.loaded", version=self.version)
        except Exception as exc:
            self.loaded = False
            self.error = str(exc)
            logger.error("ml.lead_scorer.load_failed", error=self.error)

    @staticmethod
    def _fit_synthetic():
        from sklearn.ensemble import RandomForestClassifier

        rng = np.random.default_rng(seed=42)
        n = 2000
        X = np.zeros((n, len(SOURCES) + len(NUMERIC_FEATURES)))
        src_idx = rng.integers(0, len(SOURCES), size=n)
        for i, s in enumerate(src_idx):
            X[i, s] = 1.0
        X[:, len(SOURCES) + 0] = rng.integers(0, 60, size=n)        # interactions
        X[:, len(SOURCES) + 1] = rng.uniform(0, 365, size=n)         # time_since_first
        X[:, len(SOURCES) + 2] = rng.uniform(0, 72, size=n)          # response_time

        # Função "verdadeira" para gerar y: + interações, - tempo de resposta
        logits = (
            0.04 * X[:, len(SOURCES) + 0]
            - 0.02 * X[:, len(SOURCES) + 2]
            - 0.001 * X[:, len(SOURCES) + 1]
            + 0.5 * X[:, SOURCES.index("referral")]
            + 0.3 * X[:, SOURCES.index("whatsapp")]
        )
        prob = 1.0 / (1.0 + np.exp(-logits))
        y = (rng.uniform(0, 1, size=n) < prob).astype(int)

        clf = RandomForestClassifier(
            n_estimators=120, max_depth=8, random_state=42, n_jobs=1
        )
        clf.fit(X, y)
        return clf

    def predict(self, payload: dict) -> dict:
        if not self.loaded or self._model is None:
            raise RuntimeError("lead_model_not_loaded")

        X = vectorize(payload)
        prob = float(self._model.predict_proba(X)[0, 1])
        score = int(round(prob * 100))

        importances = getattr(self._model, "feature_importances_", None)
        factors: list[dict] = []
        if importances is not None:
            ranked = sorted(
                zip(self._features, importances, X.flatten()),
                key=lambda t: float(t[1]),
                reverse=True,
            )
            for name, imp, value in ranked[:5]:
                factors.append(
                    {
                        "factor": name,
                        "weight": round(float(imp), 4),
                        "value": round(float(value), 4),
                    }
                )

        return {"score": score, "factors": factors, "model_version": self.version}


lead_model = LeadScorerModel()
