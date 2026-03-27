"""Claude Code usage reader — reads ccstatusline cache or credentials file."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class UsageData:
    session_pct: Optional[float] = None   # 0.0–1.0
    session_reset_at: Optional[str] = None
    weekly_pct: Optional[float] = None    # 0.0–1.0
    weekly_reset_at: Optional[str] = None

    @property
    def session_bar_color(self) -> str:
        return _pct_color(self.session_pct)

    @property
    def weekly_bar_color(self) -> str:
        return _pct_color(self.weekly_pct)

    @property
    def weekly_warning(self) -> bool:
        return self.weekly_pct is not None and self.weekly_pct >= 0.8

    @property
    def suggest_quick_mode(self) -> bool:
        return self.weekly_pct is not None and self.weekly_pct >= 0.8


def _pct_color(pct: Optional[float]) -> str:
    if pct is None:
        return "bright_black"
    if pct < 0.6:
        return "green"
    if pct < 0.8:
        return "yellow"
    return "red"


_CACHE = Path.home() / ".cache" / "ccstatusline" / "usage.json"


def load_usage() -> UsageData:
    """Try ccstatusline cache first, fall back to empty."""
    if _CACHE.exists():
        try:
            raw = json.loads(_CACHE.read_text())
            return UsageData(
                session_pct=_to_pct(raw.get("sessionUsage")),
                session_reset_at=raw.get("sessionResetAt"),
                weekly_pct=_to_pct(raw.get("weeklyUsage")),
                weekly_reset_at=raw.get("weeklyResetAt"),
            )
        except Exception:
            pass
    return UsageData()


def _to_pct(val: object) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        # API returns 0–1 utilization
        return max(0.0, min(1.0, f))
    except (TypeError, ValueError):
        return None
