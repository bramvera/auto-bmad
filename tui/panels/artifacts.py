"""Artifact browser panel — semantic file tree + markdown preview."""
from __future__ import annotations

from pathlib import Path

from textual.app import ComposeResult
from textual.binding import Binding
from textual.message import Message
from textual.widget import Widget
from textual.widgets import ListItem, ListView, Markdown, Static

from ..data.artifacts import ArtifactFile, ArtifactGroup


class ArtifactOpened(Message):
    def __init__(self, path: Path) -> None:
        self.path = path
        super().__init__()


class ArtifactTreePanel(Widget):
    BINDINGS = [
        Binding("j", "cursor_down", "down", show=False),
        Binding("k", "cursor_up", "up", show=False),
        Binding("enter", "open_file", "open", show=False),
    ]

    DEFAULT_CSS = """
    ArtifactTreePanel {
        width: 28;
    }
    ArtifactTreePanel ListView {
        background: transparent;
    }
    ArtifactTreePanel ListItem {
        padding: 0 1;
        background: transparent;
    }
    ArtifactTreePanel ListItem.--highlight {
        background: #1e2d3d;
    }
    """

    def __init__(self, groups: list[ArtifactGroup], **kwargs: object) -> None:
        self._groups = groups
        self._flat: list[ArtifactFile | str] = []  # str = group header
        super().__init__(**kwargs)

    def _build_flat(self) -> list[ArtifactFile | str]:
        flat: list[ArtifactFile | str] = []
        for group in self._groups:
            flat.append(group.name)  # header
            for f in group.files:
                flat.append(f)
        return flat

    def compose(self) -> ComposeResult:
        yield Static(" Artifacts", classes="panel-title")
        self._flat = self._build_flat()
        items = []
        for item in self._flat:
            if isinstance(item, str):
                label = f"[cyan]📂 {item}[/]"
                li = ListItem(Static(label))
                li.add_class("group-header")
            else:
                label = f"  [bright_black]├[/] {item.name}  [bright_black]{item.label}[/]"
                li = ListItem(Static(label))
            items.append(li)
        yield ListView(*items, id="artifact-list")

    def action_cursor_down(self) -> None:
        self.query_one(ListView).action_cursor_down()

    def action_cursor_up(self) -> None:
        self.query_one(ListView).action_cursor_up()

    def action_open_file(self) -> None:
        lv = self.query_one(ListView)
        idx = lv.index
        if idx is None or idx >= len(self._flat):
            return
        item = self._flat[idx]
        if isinstance(item, ArtifactFile):
            self.post_message(ArtifactOpened(item.path))

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        self.action_open_file()

    def update_groups(self, groups: list[ArtifactGroup]) -> None:
        self._groups = groups
        self.recompose()

    def filter_by_story(self, story_id: str) -> None:
        """Scroll to and highlight files for a given story."""
        self._flat = self._build_flat()
        lv = self.query_one(ListView)
        for i, item in enumerate(self._flat):
            if isinstance(item, ArtifactFile) and item.story_id == story_id:
                lv.index = i
                break


class PreviewPanel(Widget):
    DEFAULT_CSS = """
    PreviewPanel {
        width: 1fr;
    }
    PreviewPanel Markdown {
        height: 1fr;
        overflow-y: scroll;
    }
    """

    def __init__(self, **kwargs: object) -> None:
        self._content = "_Select an artifact to preview._"
        self._title = "Preview"
        super().__init__(**kwargs)

    def compose(self) -> ComposeResult:
        yield Static(f" {self._title}", classes="panel-title", id="preview-title")
        yield Markdown(self._content, id="preview-md")

    def load_file(self, path: Path) -> None:
        self._title = path.name
        try:
            self._content = path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            self._content = f"_Could not read file: {e}_"
        self.query_one("#preview-title", Static).update(f" {self._title}")
        self.query_one("#preview-md", Markdown).update(self._content)
