"""Tracker de latência por modelo (janela deslizante em memória)."""
from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Deque, Dict

from .config import settings


class LatencyTracker:
    def __init__(self, window: int = settings.latency_window_size) -> None:
        self._buffers: Dict[str, Deque[float]] = {}
        self._lock = Lock()
        self._window = window
        self._started_at = time.monotonic()

    def record(self, name: str, ms: float) -> None:
        with self._lock:
            buf = self._buffers.get(name)
            if buf is None:
                buf = deque(maxlen=self._window)
                self._buffers[name] = buf
            buf.append(ms)

    def avg_ms(self, name: str) -> float | None:
        with self._lock:
            buf = self._buffers.get(name)
            if not buf:
                return None
            return round(sum(buf) / len(buf), 2)

    def uptime_seconds(self) -> int:
        return int(time.monotonic() - self._started_at)


tracker = LatencyTracker()


class measure:
    """Context manager para registrar latência de uma operação."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._t0 = 0.0

    def __enter__(self) -> "measure":
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, *_: object) -> None:
        ms = (time.perf_counter() - self._t0) * 1000.0
        tracker.record(self.name, ms)
