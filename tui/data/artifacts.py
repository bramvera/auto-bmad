"""Semantic artifact tree builder for auto-bmad output folders."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ArtifactFile:
    path: Path
    label: str       # human label: "story spec", "ATDD results", etc.
    story_id: Optional[str] = None

    @property
    def name(self) -> str:
        return self.path.name


@dataclass
class ArtifactGroup:
    name: str         # "planning", "3-1 contact-profile", "test-design", etc.
    files: list[ArtifactFile] = field(default_factory=list)
    story_id: Optional[str] = None  # set for story groups


_STORY_ID_RE = re.compile(r"^(\d+-\d+)-")
_EPIC_RETRO_RE = re.compile(r"^epic-(\d+)-retro")
_TRACE_RE = re.compile(r"^trace-(\d+-\d+)-")
_ATDD_RE = re.compile(r"^atdd-checklist-(\d+-\d+)")
_TOKEN_RE = re.compile(r"^(epic-\d+-story-\d+|story)-.*token-report")
_PIPELINE_RE = re.compile(r"^epic-\d+-story-\d+-\d{4}-\d{2}-\d{2}")


def _label_file(path: Path) -> tuple[str, Optional[str]]:
    """Return (human label, story_id) for a file."""
    name = path.stem.lower()

    if name == "sprint-status":
        return "sprint status", None
    if name == "project-context":
        return "project context", None
    if name in ("prd", "prd-validation-report"):
        return "product requirements", None
    if name == "architecture":
        return "architecture design", None
    if name.startswith("product-brief"):
        return "product brief", None
    if "ux-design" in name:
        return "UX design spec", None
    if name == "epics":
        return "epics & stories", None
    if "implementation-readiness" in name:
        return "readiness report", None
    if "sprint-plan" in name:
        return "sprint plan", None

    m = _STORY_ID_RE.match(name)
    if m:
        sid = m.group(1)
        if "story" in name or name == sid:
            return "story spec", sid
        return path.stem, sid

    m = _ATDD_RE.match(name)
    if m:
        return "ATDD checklist", m.group(1)

    m = _TRACE_RE.match(name)
    if m:
        return "traceability", m.group(1)

    if _EPIC_RETRO_RE.match(name):
        return "retrospective", None

    if _PIPELINE_RE.match(name):
        return "pipeline report", None

    if "token-report" in name:
        return "token cost report", None

    if "test-design" in name or "test-design-epic" in name:
        return "test design", None

    if "framework-setup" in name:
        return "test framework setup", None

    if "handoff" in name:
        return "QA handoff", None

    return path.stem, None


def load_artifacts(output_folder: Path) -> list[ArtifactGroup]:
    """Build semantic artifact groups from the output folder."""
    groups: list[ArtifactGroup] = []

    # Planning artifacts
    planning_dir = output_folder / "planning-artifacts"
    if planning_dir.exists():
        g = ArtifactGroup(name="planning")
        for f in sorted(planning_dir.glob("*.md")):
            label, _ = _label_file(f)
            g.files.append(ArtifactFile(path=f, label=label))
        if g.files:
            groups.append(g)

    # Implementation artifacts — group by story
    impl_dir = output_folder / "implementation-artifacts"
    story_groups: dict[str, ArtifactGroup] = {}
    loose_files: list[ArtifactFile] = []

    if impl_dir.exists():
        for f in sorted(impl_dir.glob("*.md")):
            label, story_id = _label_file(f)
            if story_id:
                if story_id not in story_groups:
                    # title from filename slug
                    slug = f.stem[len(story_id) + 1:].replace("-", " ")
                    story_groups[story_id] = ArtifactGroup(
                        name=f"{story_id} {slug}",
                        story_id=story_id,
                    )
                story_groups[story_id].files.append(
                    ArtifactFile(path=f, label=label, story_id=story_id)
                )
            else:
                loose_files.append(ArtifactFile(path=f, label=label))

        def _sort_key(k: str) -> tuple[int, int]:
            parts = k.split("-")
            try:
                return int(parts[0]), int(parts[1])
            except (IndexError, ValueError):
                return 999, 999

        for sid in sorted(story_groups.keys(), key=_sort_key):
            groups.append(story_groups[sid])

        if loose_files:
            g = ArtifactGroup(name="misc")
            g.files = loose_files
            groups.append(g)

    # Test artifacts
    test_dir = output_folder / "test-artifacts"
    if test_dir.exists():
        g = ArtifactGroup(name="test artifacts")
        for f in sorted(test_dir.rglob("*.md")):
            label, story_id = _label_file(f)
            g.files.append(ArtifactFile(path=f, label=label, story_id=story_id))
        if g.files:
            groups.append(g)

    # Pipeline reports
    auto_dir = output_folder / "auto-bmad-artifacts"
    if auto_dir.exists():
        g = ArtifactGroup(name="pipeline reports")
        for f in sorted(auto_dir.glob("*.md"), reverse=True):
            label, _ = _label_file(f)
            g.files.append(ArtifactFile(path=f, label=label))
        if g.files:
            groups.append(g)

    return groups
