"""Sprint status reader — parses sprint-status.yaml from BMAD output."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import yaml


@dataclass
class Story:
    id: str
    title: str
    status: str  # backlog | ready | in-progress | review | done | blocked
    epic_id: str
    story_num: str
    file_path: Optional[Path] = None

    @property
    def status_symbol(self) -> str:
        return {
            "done":        "✓",
            "in-progress": "▶",
            "review":      "◆",
            "ready":       "·",
            "backlog":     "·",
            "blocked":     "✗",
        }.get(self.status, "·")

    @property
    def status_color(self) -> str:
        return {
            "done":        "green",
            "in-progress": "yellow",
            "review":      "cyan",
            "ready":       "white",
            "backlog":     "bright_black",
            "blocked":     "red",
        }.get(self.status, "white")


@dataclass
class Epic:
    id: str
    title: str
    stories: list[Story] = field(default_factory=list)

    @property
    def done_count(self) -> int:
        return sum(1 for s in self.stories if s.status == "done")

    @property
    def total_count(self) -> int:
        return len(self.stories)

    @property
    def status(self) -> str:
        if self.total_count == 0:
            return "backlog"
        if self.done_count == self.total_count:
            return "done"
        if any(s.status in ("in-progress", "review") for s in self.stories):
            return "active"
        return "backlog"

    @property
    def status_color(self) -> str:
        return {
            "done":    "green",
            "active":  "yellow",
            "backlog": "bright_black",
        }.get(self.status, "white")


@dataclass
class SprintState:
    epics: list[Epic] = field(default_factory=list)
    project_root: Optional[Path] = None
    output_folder: Optional[Path] = None

    def epic_by_id(self, epic_id: str) -> Optional[Epic]:
        return next((e for e in self.epics if e.id == epic_id), None)


def _parse_story_id(raw_id: str) -> tuple[str, str]:
    """Return (epic_id, story_num) from '1-3', '2.4', etc."""
    for sep in ("-", ".", " "):
        if sep in raw_id:
            parts = raw_id.split(sep, 1)
            return parts[0], parts[1]
    return raw_id, "1"


_STORY_KEY_RE = re.compile(r"^(\d+)-(\d+)(?:-(.+))?$")
_EPIC_KEY_RE  = re.compile(r"^epic-(\d+)$")


def load_sprint(project_root: Path) -> SprintState:
    """Load sprint state from sprint-status.yaml."""
    state = SprintState(project_root=project_root)

    output_folder = _find_output_folder(project_root)
    state.output_folder = output_folder

    sprint_file = output_folder / "implementation-artifacts" / "sprint-status.yaml"
    if not sprint_file.exists():
        return state

    try:
        raw = yaml.safe_load(sprint_file.read_text())
    except Exception:
        return state

    if not raw:
        return state

    epics_map: dict[str, Epic] = {}

    # Format A: flat development_status dict (dairygoldcrm style)
    dev_status = raw.get("development_status")
    if isinstance(dev_status, dict):
        # First pass — collect epic statuses
        epic_statuses: dict[str, str] = {}
        for key, val in dev_status.items():
            m = _EPIC_KEY_RE.match(key)
            if m:
                epic_statuses[m.group(1)] = _normalise_status(str(val))

        # Second pass — collect stories
        for key, val in dev_status.items():
            m = _STORY_KEY_RE.match(key)
            if not m:
                continue
            epic_id   = m.group(1)
            story_num = m.group(2)
            slug      = m.group(3) or ""
            story_id  = f"{epic_id}-{story_num}"
            title     = slug.replace("-", " ").title() if slug else f"Story {story_id}"
            status    = _normalise_status(str(val))
            story_file = _find_story_file(output_folder, story_id)

            story = Story(
                id=story_id,
                title=title,
                status=status,
                epic_id=epic_id,
                story_num=story_num,
                file_path=story_file,
            )

            if epic_id not in epics_map:
                epics_map[epic_id] = Epic(id=epic_id, title=f"Epic {epic_id}")
            epics_map[epic_id].stories.append(story)

        # Override epic status from explicit epic keys where available
        for epic_id, ep in epics_map.items():
            if epic_id in epic_statuses:
                # Expose via a synthetic story so the computed property
                # still works — but override the done_count logic by
                # checking explicit status first.
                ep._explicit_status = epic_statuses.get(epic_id)  # type: ignore[attr-defined]

    # Format B: stories list (nested format)
    else:
        stories_data = raw.get("stories", raw.get("sprint", {}).get("stories", []))
        if isinstance(stories_data, dict):
            stories_data = list(stories_data.values())

        for item in (stories_data or []):
            if not isinstance(item, dict):
                continue
            raw_id = str(item.get("id", item.get("story_id", "")))
            if not raw_id:
                continue
            m = _STORY_KEY_RE.match(raw_id)
            if m:
                epic_id, story_num = m.group(1), m.group(2)
            else:
                epic_id, story_num = _parse_story_id(raw_id)

            title  = item.get("title", item.get("name", f"Story {raw_id}"))
            status = _normalise_status(item.get("status", "backlog"))
            story_file = _find_story_file(output_folder, raw_id)

            story = Story(id=raw_id, title=title, status=status,
                          epic_id=epic_id, story_num=story_num,
                          file_path=story_file)

            if epic_id not in epics_map:
                epics_map[epic_id] = Epic(id=epic_id, title=f"Epic {epic_id}")
            epics_map[epic_id].stories.append(story)

    def _num(s: str) -> float:
        try:
            return float(s)
        except ValueError:
            return 0.0

    state.epics = sorted(epics_map.values(), key=lambda e: _num(e.id))
    for epic in state.epics:
        epic.stories.sort(key=lambda s: _num(s.story_num))

    return state


def _normalise_status(raw: str) -> str:
    raw = raw.lower().replace(" ", "-").replace("_", "-")
    mapping = {
        "completed": "done",
        "complete":  "done",
        "finished":  "done",
        "wip":       "in-progress",
        "active":    "in-progress",
        "in_progress": "in-progress",
    }
    return mapping.get(raw, raw)


def _find_output_folder(project_root: Path) -> Path:
    config = project_root / "_bmad" / "bmm" / "config.yaml"
    if config.exists():
        try:
            raw = yaml.safe_load(config.read_text())
            # implementation_artifacts: "{project-root}/output/implementation-artifacts"
            impl = raw.get("implementation_artifacts", "")
            if impl:
                impl = impl.replace("{project-root}", str(project_root))
                p = Path(impl).parent  # strip /implementation-artifacts
                if p.exists():
                    return p
            folder = raw.get("output_folder", "")
            if folder:
                return project_root / folder
        except Exception:
            pass
    # fallback — check common names
    for name in ("output", "_bmad-output", "bmad-output"):
        p = project_root / name
        if p.exists():
            return p
    return project_root / "_bmad-output"


def _find_story_file(output_folder: Path, story_id: str) -> Optional[Path]:
    impl = output_folder / "implementation-artifacts"
    if not impl.exists():
        return None
    pattern = f"{story_id}-*.md"
    matches = list(impl.glob(pattern))
    return matches[0] if matches else None
