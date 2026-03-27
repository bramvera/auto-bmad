"""Claude Code usage reader.

Priority:
1. Direct API call (api.anthropic.com/api/oauth/usage) using credentials file
2. ccstatusline cache fallback (may be stale)
3. Empty UsageData
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.error
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class UsageData:
    session_pct: Optional[float] = None   # 0.0–1.0
    session_reset_at: Optional[str] = None
    weekly_pct: Optional[float] = None    # 0.0–1.0
    weekly_reset_at: Optional[str] = None
    stale: bool = False

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


def _to_pct(val: object) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        if f > 1.0:
            f = f / 100.0
        return max(0.0, min(1.0, f))
    except (TypeError, ValueError):
        return None


# ── Credentials ─────────────────────────────────────────────────────────────

_CREDS_FILE  = Path.home() / ".claude" / ".credentials.json"
_API_URL     = "https://api.anthropic.com/api/oauth/usage"
_API_TIMEOUT = 5
_CACHE_FILE  = Path.home() / ".cache" / "ccstatusline" / "usage.json"
_CACHE_MAX_AGE = 180  # seconds — matches ccstatusline's TTL


def _get_token() -> Optional[str]:
    try:
        raw = json.loads(_CREDS_FILE.read_text())
        return raw.get("claudeAiOauth", {}).get("accessToken") or None
    except Exception:
        return None


# ── API call ─────────────────────────────────────────────────────────────────

def _fetch_from_api(token: str) -> Optional[UsageData]:
    try:
        req = urllib.request.Request(
            _API_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "anthropic-beta": "oauth-2025-04-20",
            },
        )
        with urllib.request.urlopen(req, timeout=_API_TIMEOUT) as resp:
            raw = json.loads(resp.read())

        five_hour = raw.get("five_hour", {}) or {}
        seven_day = raw.get("seven_day", {}) or {}

        return UsageData(
            session_pct=_to_pct(five_hour.get("utilization")),
            session_reset_at=five_hour.get("resets_at"),
            weekly_pct=_to_pct(seven_day.get("utilization")),
            weekly_reset_at=seven_day.get("resets_at"),
            stale=False,
        )
    except Exception:
        return None


# ── Cache fallback ────────────────────────────────────────────────────────────

def _read_cache() -> Optional[UsageData]:
    if not _CACHE_FILE.exists():
        return None
    try:
        age = time.time() - _CACHE_FILE.stat().st_mtime
        raw = json.loads(_CACHE_FILE.read_text())
        return UsageData(
            session_pct=_to_pct(raw.get("sessionUsage")),
            session_reset_at=raw.get("sessionResetAt"),
            weekly_pct=_to_pct(raw.get("weeklyUsage")),
            weekly_reset_at=raw.get("weeklyResetAt"),
            stale=age > _CACHE_MAX_AGE,
        )
    except Exception:
        return None


# ── Public entry point ────────────────────────────────────────────────────────

def load_usage() -> UsageData:
    """Fetch live usage data. Falls back to ccstatusline cache on failure."""
    token = _get_token()
    if token:
        data = _fetch_from_api(token)
        if data is not None:
            return data
    return _read_cache() or UsageData()
