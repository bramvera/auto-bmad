"""Top status bar — model, context, session %, weekly %."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from ..data.usage import UsageData, load_usage


def _bar(pct: float | None, width: int = 10) -> str:
    if pct is None:
        return "·" * width
    filled = round(pct * width)
    return "█" * filled + "░" * (width - filled)


def _pct_str(pct: float | None) -> str:
    if pct is None:
        return "?%"
    return f"{pct * 100:.0f}%"


class StatusBar(Widget):
    DEFAULT_CSS = ""

    usage: reactive[UsageData] = reactive(UsageData, recompose=True)

    def on_mount(self) -> None:
        self.usage = load_usage()
        self.set_interval(60, self._refresh_usage)

    def _refresh_usage(self) -> None:
        self.usage = load_usage()

    def compose(self) -> ComposeResult:
        u = self.usage
        s_color = u.session_bar_color
        w_color = u.weekly_bar_color

        session_bar = _bar(u.session_pct)
        weekly_bar  = _bar(u.weekly_pct)
        s_pct = _pct_str(u.session_pct)
        w_pct = _pct_str(u.weekly_pct)

        warn  = " ⚠" if u.weekly_warning else ""
        stale = " [bright_black](stale)[/]" if u.stale else ""

        line = (
            f"[bold cyan]auto-bmad[/]  "
            f"[bright_black]│[/]  "
            f"session [{s_color}]{session_bar} {s_pct}[/]"
            f"[bright_black]  │[/]  "
            f"weekly [{w_color}]{weekly_bar} {w_pct}{warn}[/]"
            f"{stale}"
        )

        yield Static(line, id="status-line")
