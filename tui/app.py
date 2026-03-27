"""auto-bmad TUI — main application."""
from __future__ import annotations

import subprocess
from pathlib import Path

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.css.query import NoMatches
from textual.widgets import Footer, Static

from .data.artifacts import load_artifacts
from .data.sprint import SprintState, load_sprint
from .data.usage import load_usage
from .panels.artifacts import ArtifactOpened, ArtifactTreePanel, PreviewPanel
from .panels.config import CommandReady, ConfigPanel
from .panels.epics import EpicSelected, EpicsPanel
from .panels.status_bar import StatusBar
from .panels.stories import StoriesPanel, StorySelected


PRESET_LABELS = ["board", "pipeline", "cost", "config"]


class AutoBmadTUI(App):
    TITLE = "auto-bmad"
    CSS_PATH = "styles/theme.tcss"

    BINDINGS = [
        Binding("q",     "quit",           "quit"),
        Binding("r",     "refresh",        "refresh"),
        Binding("tab",   "next_panel",     "next panel"),
        Binding("p",     "cycle_preset",   "preset"),
        Binding("m",     "toggle_mode",    "mode",    show=False),
        Binding("t",     "cycle_tds",      "tds",     show=False),
        Binding("w",     "toggle_wds",     "wds",     show=False),
        Binding("space", "run_command",    "run"),
    ]

    def __init__(self, project_root: Path, **kwargs: object) -> None:
        self._root = project_root
        self._state = SprintState()
        self._preset = 0  # 0=board, 1=pipeline, 2=cost, 3=config
        self._panels = ["epics", "stories", "artifacts", "preview"]
        self._panel_idx = 0
        super().__init__(**kwargs)

    # ── Lifecycle ─────────────────────────────────────────────────────────

    def on_mount(self) -> None:
        self._load_data()
        self.set_interval(30, self._auto_refresh)

    def _load_data(self) -> None:
        self._state = load_sprint(self._root)
        self._usage = load_usage()
        if self._state.output_folder:
            self._artifact_groups = load_artifacts(self._state.output_folder)
        else:
            self._artifact_groups = []

    # ── Compose ───────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        yield StatusBar(id="status-bar")

        with Horizontal(id="main-body"):
            yield EpicsPanel(
                self._state.epics,
                id="panel-epics",
                classes="panel",
            )
            yield StoriesPanel(
                id="panel-stories",
                classes="panel",
            )
            yield ArtifactTreePanel(
                self._artifact_groups,
                id="panel-artifacts",
                classes="panel",
            )
            yield PreviewPanel(
                id="panel-preview",
                classes="panel",
            )

        yield ConfigPanel(
            usage=load_usage(),
            id="config-bar",
        )
        yield Footer()

    # ── Message handlers ──────────────────────────────────────────────────

    def on_epic_selected(self, event: EpicSelected) -> None:
        stories = self.query_one("#panel-stories", StoriesPanel)
        stories.set_epic(event.epic)
        config = self.query_one("#config-bar", ConfigPanel)
        config.set_epic(event.epic.id)
        # Scroll artifact tree to this epic's stories
        art = self.query_one("#panel-artifacts", ArtifactTreePanel)
        if event.epic.stories:
            art.filter_by_story(event.epic.stories[0].id)

    def on_story_selected(self, event: StorySelected) -> None:
        art = self.query_one("#panel-artifacts", ArtifactTreePanel)
        art.filter_by_story(event.story.id)
        if event.story.file_path:
            preview = self.query_one("#panel-preview", PreviewPanel)
            preview.load_file(event.story.file_path)

    def on_artifact_opened(self, event: ArtifactOpened) -> None:
        preview = self.query_one("#panel-preview", PreviewPanel)
        preview.load_file(event.path)

    def on_command_ready(self, event: CommandReady) -> None:
        self._show_launch_dialog(event.command)

    # ── Actions ───────────────────────────────────────────────────────────

    def action_refresh(self) -> None:
        self._load_data()
        try:
            epics_panel = self.query_one("#panel-epics", EpicsPanel)
            epics_panel.update_epics(self._state.epics)
            art_panel = self.query_one("#panel-artifacts", ArtifactTreePanel)
            art_panel.update_groups(self._artifact_groups)
            status = self.query_one("#status-bar", StatusBar)
            status.usage = self._usage
        except NoMatches:
            pass
        self.notify("Refreshed", timeout=2)

    def _auto_refresh(self) -> None:
        self.action_refresh()

    def action_next_panel(self) -> None:
        panels = ["#panel-epics", "#panel-stories", "#panel-artifacts", "#panel-preview"]
        self._panel_idx = (self._panel_idx + 1) % len(panels)
        try:
            self.query_one(panels[self._panel_idx]).focus()
        except NoMatches:
            pass

    def action_cycle_preset(self) -> None:
        self._preset = (self._preset + 1) % 4
        label = PRESET_LABELS[self._preset]
        self._apply_preset(self._preset)
        self.notify(f"Preset: {label}", timeout=2)

    def _apply_preset(self, preset: int) -> None:
        panels = {
            "#panel-epics":     True,
            "#panel-stories":   True,
            "#panel-artifacts": True,
            "#panel-preview":   True,
        }
        if preset == 1:  # pipeline focus
            panels["#panel-epics"] = False
        elif preset == 2:  # cost
            panels["#panel-artifacts"] = False
        elif preset == 3:  # config only
            panels["#panel-stories"] = False
            panels["#panel-artifacts"] = False
            panels["#panel-preview"] = False

        for sel, visible in panels.items():
            try:
                w = self.query_one(sel)
                w.display = visible
            except NoMatches:
                pass

    def action_toggle_mode(self) -> None:
        self.query_one("#config-bar", ConfigPanel).action_toggle_mode()

    def action_cycle_tds(self) -> None:
        self.query_one("#config-bar", ConfigPanel).action_cycle_tds()

    def action_toggle_wds(self) -> None:
        self.query_one("#config-bar", ConfigPanel).action_toggle_wds()

    def action_run_command(self) -> None:
        self.query_one("#config-bar", ConfigPanel).action_confirm()

    def _show_launch_dialog(self, command: str) -> None:
        """Copy command to clipboard and notify. Phase 3 will launch directly."""
        try:
            subprocess.run(
                ["xclip", "-selection", "clipboard"],
                input=command.encode(),
                check=False,
            )
            self.notify(
                f"Copied to clipboard:\n{command}",
                title="Ready to run",
                timeout=5,
            )
        except FileNotFoundError:
            # xclip not available — just show it
            self.notify(command, title="Run this command:", timeout=8)
