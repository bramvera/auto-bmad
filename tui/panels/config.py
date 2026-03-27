"""Config panel — module toggles, TDS seed size, command preview."""
from __future__ import annotations

from dataclasses import dataclass
from textual.app import ComposeResult
from textual.binding import Binding
from textual.message import Message
from textual.widget import Widget
from textual.widgets import Static

from ..data.usage import UsageData


TDS_SIZES = ["minimal", "standard", "full"]
TDS_HINTS = {
    "minimal":  "seed ≤5 records per entity",
    "standard": "seed 20-50 records per entity",
    "full":     "seed comprehensive dataset (100-1000+)",
}
MODES = ["quick", "full"]


@dataclass
class PipelineConfig:
    epic_id: str = "1"
    mode: str = "quick"          # quick | full
    tea: bool = False
    tds_size: str = "minimal"    # minimal | standard | full
    wds: bool = False
    skip_adversarial: bool = False
    skip_atdd: bool = False
    skip_edge_hunt: bool = False

    def generated_command(self) -> str:
        if self.mode == "quick":
            cmd = f"/auto-bmad-sprint-quick {self.epic_id}"
        else:
            cmd = f"/auto-bmad-sprint {self.epic_id}"

        hints = []
        if self.tds_size != "full":
            hints.append(TDS_HINTS[self.tds_size])
        if hints:
            cmd += " — " + ", ".join(hints)
        return cmd


class CommandReady(Message):
    def __init__(self, command: str, config: PipelineConfig) -> None:
        self.command = command
        self.config = config
        super().__init__()


class ConfigPanel(Widget):
    BINDINGS = [
        Binding("m", "toggle_mode", "mode", show=False),
        Binding("t", "cycle_tds", "tds size", show=False),
        Binding("w", "toggle_wds", "WDS", show=False),
        Binding("enter", "confirm", "launch", show=False),
    ]

    DEFAULT_CSS = """
    ConfigPanel {
        height: 4;
        background: #0d1117;
        border-top: solid #1e2d3d;
        padding: 0 1;
    }
    """

    def __init__(self, usage: UsageData | None = None, **kwargs: object) -> None:
        self._cfg = PipelineConfig()
        self._usage = usage
        super().__init__(**kwargs)

    def compose(self) -> ComposeResult:
        yield Static(self._render_line(), id="config-line")
        yield Static(self._render_command(), id="config-command")
        if self._usage and self._usage.suggest_quick_mode and self._cfg.mode == "full":
            yield Static(
                "[red]⚠  Weekly >80% — quick mode recommended (~60-80k vs ~200k tokens)[/]",
                id="config-warn",
            )

    def _render_line(self) -> str:
        cfg = self._cfg
        mode_color = "yellow" if cfg.mode == "full" else "green"
        tea_val = "[green]✓[/]" if cfg.tea else "[bright_black]✗[/]"
        tds_color = "yellow" if cfg.tds_size == "full" else "green" if cfg.tds_size == "minimal" else "yellow"
        wds_val = "[green]✓[/]" if cfg.wds else "[bright_black]✗[/]"

        return (
            f"[cyan]TEA[/] {tea_val}  "
            f"[cyan]TDS[/] [{tds_color}]{cfg.tds_size}[/]  "
            f"[cyan]WDS[/] {wds_val}  "
            f"[cyan]mode[/] [{mode_color}]{cfg.mode}[/]  "
            f"[cyan]epic[/] [yellow]{cfg.epic_id}[/]"
        )

    def _render_command(self) -> str:
        return f"[bright_black]▶[/]  [white]{self._cfg.generated_command()}[/]"

    def _refresh(self) -> None:
        self.query_one("#config-line", Static).update(self._render_line())
        self.query_one("#config-command", Static).update(self._render_command())

    def set_epic(self, epic_id: str) -> None:
        self._cfg.epic_id = epic_id
        # Auto-suggest mode based on usage
        if self._usage and self._usage.suggest_quick_mode:
            self._cfg.mode = "quick"
        # Auto-set TEA based on mode
        self._cfg.tea = self._cfg.mode == "full"
        self._refresh()

    def action_toggle_mode(self) -> None:
        modes = MODES
        self._cfg.mode = modes[(modes.index(self._cfg.mode) + 1) % len(modes)]
        self._cfg.tea = self._cfg.mode == "full"
        self._refresh()

    def action_cycle_tds(self) -> None:
        sizes = TDS_SIZES
        self._cfg.tds_size = sizes[(sizes.index(self._cfg.tds_size) + 1) % len(sizes)]
        self._refresh()

    def action_toggle_wds(self) -> None:
        self._cfg.wds = not self._cfg.wds
        self._refresh()

    def action_confirm(self) -> None:
        self.post_message(CommandReady(self._cfg.generated_command(), self._cfg))
