"""Stories panel — list of stories for selected epic."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.message import Message
from textual.widget import Widget
from textual.widgets import ListItem, ListView, Static

from ..data.sprint import Epic, Story


class StorySelected(Message):
    def __init__(self, story: Story) -> None:
        self.story = story
        super().__init__()


class StoriesPanel(Widget):
    BINDINGS = [
        Binding("j", "cursor_down", "down", show=False),
        Binding("k", "cursor_up", "up", show=False),
    ]

    DEFAULT_CSS = """
    StoriesPanel {
        width: 30;
    }
    StoriesPanel ListView {
        background: transparent;
    }
    StoriesPanel ListItem {
        padding: 0 1;
        background: transparent;
    }
    StoriesPanel ListItem.--highlight {
        background: #1e2d3d;
    }
    """

    def __init__(self, **kwargs: object) -> None:
        self._epic: Epic | None = None
        super().__init__(**kwargs)

    def compose(self) -> ComposeResult:
        title = f" {self._epic.id} — Stories" if self._epic else " Stories"
        yield Static(title, classes="panel-title")
        items = []
        for story in (self._epic.stories if self._epic else []):
            color = story.status_color
            sym = story.status_symbol
            # Truncate title to fit panel
            title_text = story.title[:22] if len(story.title) > 22 else story.title
            label = f"[{color}]{sym}[/] [{color}]{story.id}[/]  {title_text}"
            items.append(ListItem(Static(label), id=f"story-{story.id}"))
        yield ListView(*items, id="story-list")

    def set_epic(self, epic: Epic) -> None:
        self._epic = epic
        self.recompose()

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        if not self._epic:
            return
        idx = event.list_view.index
        if idx is not None and idx < len(self._epic.stories):
            self.post_message(StorySelected(self._epic.stories[idx]))

    def action_cursor_down(self) -> None:
        self.query_one(ListView).action_cursor_down()

    def action_cursor_up(self) -> None:
        self.query_one(ListView).action_cursor_up()
