"""Epics panel — left column list of epics with progress."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.message import Message
from textual.widget import Widget
from textual.widgets import ListItem, ListView, Static

from ..data.sprint import Epic


class EpicSelected(Message):
    def __init__(self, epic: Epic) -> None:
        self.epic = epic
        super().__init__()


class EpicsPanel(Widget):
    BINDINGS = [
        Binding("j", "cursor_down", "down", show=False),
        Binding("k", "cursor_up", "up", show=False),
    ]

    DEFAULT_CSS = """
    EpicsPanel {
        width: 22;
    }
    EpicsPanel ListView {
        background: transparent;
    }
    EpicsPanel ListItem {
        padding: 0 1;
        background: transparent;
    }
    EpicsPanel ListItem.--highlight {
        background: #1e2d3d;
    }
    """

    def __init__(self, epics: list[Epic], **kwargs: object) -> None:
        self._epics = epics
        super().__init__(**kwargs)

    def compose(self) -> ComposeResult:
        yield Static(" Epics", classes="panel-title")
        items = []
        for epic in self._epics:
            color = epic.status_color
            progress = f"{epic.done_count}/{epic.total_count}"
            label = f"[{color}]{epic.id:>2}  {epic.status:<8}  {progress:>5}[/]"
            items.append(ListItem(Static(label), id=f"epic-{epic.id}"))
        yield ListView(*items, id="epic-list")

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        idx = event.list_view.index
        if idx is not None and idx < len(self._epics):
            self.post_message(EpicSelected(self._epics[idx]))

    def action_cursor_down(self) -> None:
        self.query_one(ListView).action_cursor_down()

    def action_cursor_up(self) -> None:
        self.query_one(ListView).action_cursor_up()

    def update_epics(self, epics: list[Epic]) -> None:
        self._epics = epics
        self.call_after_refresh(self.recompose)
