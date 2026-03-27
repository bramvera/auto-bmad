# auto-bmad TUI — Product Spec
## Target Release: v1.0.0

> Brainstormed 2026-03-26. Execute after weekly token reset (~1d 16h).
> Build with: quick mode, Sonnet, no TEA needed for greenfield.

---

## What It Is

A full-screen terminal command center for auto-bmad. One surface to configure, launch, monitor, and review BMAD sprint pipelines — never leave the terminal.

Target user: someone who knows BMAD, TEA, WDS, TDS. Not a vibe coder. This is a power tool.

---

## Why v1.0.0

Pre-1.0 = CLI tool, slash commands, trust the pipeline.
1.0 = complete tool with a UI that controls the pipelines.

Clean line: everything before 1.0 built the pipelines. 1.0 is the surface that drives them.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| TUI framework | Python + Textual | Already have Python (token-report.py), active community, rich widget support |
| Markdown render | Textual `Markdown` widget | Built-in, handles tables cleanly — needed for review reports |
| Claude Code launch | `expect` script | Controls PTY, handles idle detection, captures output to log |
| Aesthetic | btop-style | Dark bg, teal borders, color-coded status, dense information |
| Location | Inside auto-bmad repo | No separate versioning, no compatibility matrix, ships with the plugin |

---

## How TUI Talks to Claude Code

```
TUI (Python/Textual)
  └── subprocess → session.expect
        └── PTY → claude --dangerously-skip-permissions -p "<generated command>"
                       │ emits ESC]9;4;0 when done (idle detection)
                       │ output captured to log file
                       └── TUI parses log for stats
```

Key: TUI assembles the command **before** launching. Config happens in TUI, then fires claude. No bidirectional control during execution.

Abort = kill subprocess + `git reset --hard HEAD`

---

## Data Sources

| Data | Source | Method |
|------|--------|--------|
| Session / weekly budget | `~/.cache/ccstatusline/usage.json` | Read cache (ccstatusline already installed), fallback to `~/.claude/.credentials.json` + `api.anthropic.com/api/oauth/usage` |
| Context window live | `~/.claude/projects/*.jsonl` | Watch latest JSONL by mtime |
| Per-step token cost | `auto-bmad-artifacts/token-report-*.md` | Parse existing reports |
| Story progress | `output/implementation-artifacts/sprint-status.yaml` | File watch (inotify/polling) |
| Step checkpoints | `git log` | Poll every 10s |
| Running/idle | JSONL mtime | File watch |

No new data infrastructure. Everything already exists.

---

## Layout (Wide Screen — Primary)

```
┌─ auto-bmad ── {project} ──────────────── {model} │ ctx ████░ 46% │ session ██████░ 73% │ weekly █████████ 94% ⚠ 1d16h ─┐
│                                                                                                                            │
├─ Epics ──────────┬─ Stories ────────────┬─ Pipeline ───────────────┬─ Artifacts ──────────┬─ Preview ──────────────────────┤
│                  │                      │                           │                       │                               │
│ 1  done    9/9   │ 3-1  Contact CRUD ✓  │  1  Create       ✓  1m  │ 📂 planning           │ # Story 3-1: Contact CRUD     │
│ 2  done    4/4   │ 3-2  Search      ✓  │  2  Validate     ✓  2m  │  ├ prd.md             │                               │
│ 3  done    6/6   │ 3-3  Activity    ✓  │  3  Adversarial  ✓  4m  │  ├ architecture.md    │ ## Acceptance Criteria        │
│ 4  done    1/1   │ 3-4  Tags        ✓  │  4  ATDD         ✓  9m  │  └ epics.md           │ ✓ Create with required fields │
│ 5  done    4/4   │ 3-5  Dedup       ✓  │  5  Develop      ✓ 15m  │                       │ ✓ Email uniqueness per tenant │
│ 6  active  0/3   │ 3-6  Segments    ✓  │  6  Edge-hunt    ✓  4m  │ 📂 3-1 contact-profile│ ✗ Soft delete audit trail     │
│ 7  backlog 0/5   │                      │  7  Review#1     ✓  7m  │  ├ story.md       ←   │                               │
│ 8  backlog 0/4   │                      │  8  Review#2   ▶  5m ██ │  ├ atdd-checklist.md  │ ## Review Findings            │
│                  │                      │  9  Review#3     ·       │  ├ traceability.md    │ | Severity | Found | Fixed |  │
│                  │                      │ 10  Trace        ·       │  └ token-report.md    │ | High     |     1 |     1 |  │
│                  │                      │ 11  Test Auto    ·       │                       │ | Medium   |     3 |     3 |  │
│                  │                      │                           │ 📂 test-design        │ | Low      |     2 |     1 |  │
│                  │                      │ total: 47m  $0.41         │  └ epic-3-design.md   │                               │
├──────────────────┴──────────────────────┴───────────────────────────┴───────────────────────┴───────────────────────────────┤
│ TEA [✓]  TDS [minimal ▾]  WDS [✗]  mode [full ▾]  epic [6 ▾]                                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ space run  tab panel  j/k scroll  enter open  p preset  c config  t tds  m mode  a abort  r refresh  q quit                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Presets (p cycles through)

### p1 — Board (default, wide)
Full layout above. All 5 panels visible. Primary view for big screens.

### p2 — Pipeline Focus
Epics collapse to narrow sidebar. Pipeline + Artifact browser fill width. Use when something is running and you want to watch it.

### p3 — Cost / Graphs
Right panel becomes token burn charts (sparklines), per-step cost bars, budget remaining, projected sprint cost. btop meter style. This is where TDS waste is immediately visible — ATDD spike stands out.

```
┌─ Token Burn ─────────────────────────┬─ Per Step (current story) ──────────┐
│                             ▂▄▆█     │ Create      ░░░   2.1k   $0.01      │
│                         ▂▄▆████      │ ATDD      ██░░  18.2k   $0.09  ←spike│
│ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▄▆████████████  80k  │ Develop   ████  31.4k   $0.16      │
│ 1-1  1-2  1-3  2-1  2-2  2-3        │ Review#1    ██░  12.0k   $0.06      │
├──────────────────────────────────────┤ Epic total:              ~$0.61     │
│ Sprint budget:  $12.00               │ Sprint so far:            $3.84     │
│ Spent: $3.84   ████░░░░  32%         │ Projected:                $9.20     │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

### p4 — Config (before launch)
Full width config form. Module selector, step toggles, seed size. Shows generated command preview before firing.

```
┌─ Epic 6 Config ─────────────────────────────────────────────────────────────┐
│  Mode           [full ▾]                                                     │
│  TEA            [✓ enabled]                                                  │
│  TDS size       [minimal ▾]    seed ≤5 records per entity                   │
│  WDS            [✗ disabled]                                                 │
│                                                                              │
│  Skip steps                                                                  │
│  [✗] adversarial review    [✗] edge-case hunt    [✗] ATDD                   │
│                                                                              │
│  ⚠  Weekly usage 94%. Recommend quick mode (~60-80k) over full (~200k).     │
│     Switch to quick mode? [Y/n]                                              │
│                                                                              │
│  Generated command:                                                          │
│  /auto-bmad-sprint 6 — seed ≤5 records per entity                           │
│                                                                              │
│  [enter] launch    [esc] cancel                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Status Bar (always visible, top)

```
auto-bmad ── {project} ── {model} │ ctx ████░ 46% │ session ██████░ 73% reset 2h14m │ weekly █████████ 94% ⚠ reset 1d16h
```

Color rules:
- ctx < 70% → green, 70-85% → yellow, >85% → red
- session/weekly < 60% → green, 60-80% → yellow, >80% → red + ⚠
- weekly >90% → red + ⚠ + suggest quick mode in Config preset

---

## Artifact Browser

Semantic tree — groups by story automatically, labels each file type:

```
📂 planning
  ├ prd.md                    ← product requirements
  ├ architecture.md           ← system design
  ├ epics.md                  ← epic breakdown
  └ ux-design-specification.md

📂 1-3 multi-tenant-auth
  ├ story.md                  ← story spec + AC
  ├ atdd-checklist.md         ← N tests written
  ├ traceability.md           ← requirements → tests → code
  └ token-report.md           ← $X.XX breakdown

📂 test-design
  └ epic-3-test-design.md     ← TEA test architecture
```

File type labels derived from filename patterns auto-bmad already uses:
- `story.md` → story spec
- `atdd-checklist-*.md` → ATDD results
- `traceability/trace-*.md` → traceability
- `token-report-*.md` → cost breakdown
- `epic-*-retro-*.md` → retrospective

Preview pane: Textual `Markdown` widget. Full rich render — tables, checkboxes, code blocks, headers. `j/k` to scroll. `enter` on file opens it. `tab` cycles panel focus.

---

## TDS Problem — How TUI Solves It

Root cause: TEA TDS generates excessive seed data (1021 events observed in dairygoldcrm) burning tokens and polluting the dev environment.

TUI fix:
1. **Config panel** — TDS size selector: `minimal (≤5-10)` / `standard (20-50)` / `full (1000+)` with epic-aware defaults (early epics default minimal)
2. **Prompt injection** — selected size appended to command: `/auto-bmad-sprint 2 — seed ≤5 records per entity`
3. **Cost preset** — ATDD token spike immediately visible, confirms if seeding went overboard
4. **Budget warning** — if weekly >80%, TDS auto-defaults to minimal

---

## Keyboard Map

| Key | Action |
|-----|--------|
| `tab` | Cycle panel focus |
| `j` / `k` | Scroll within focused panel |
| `enter` | Open selected file / confirm action |
| `space` | Run selected story / epic |
| `p` | Cycle preset (p1 board → p2 pipeline → p3 cost → p4 config) |
| `c` | Open config panel for selected epic |
| `t` | Cycle TDS size: minimal → standard → full |
| `m` | Toggle mode: quick ↔ full |
| `w` | Toggle WDS for selected epic |
| `a` | Abort running pipeline (kill + git reset --hard HEAD) |
| `r` | Refresh all panels |
| `q` | Quit |
| `/` | Search artifacts |

---

## Build Plan

### Phase 1 — Launcher + Board (start here)
- Sprint board reading from `sprint-status.yaml`
- Artifact browser (file tree + markdown preview)
- Config panel with module toggles + command generation
- Status bar (usage from ccstatusline cache)
- No `expect` yet — generates command, user runs it manually OR pipes to clipboard

**Value:** Solves TDS config problem immediately. Replaces mental overhead of remembering which command to run.

### Phase 2 — Live Monitoring
- File watchers: `sprint-status.yaml`, git log
- Pipeline step progress panel updates live
- No PTY needed — Claude Code runs in separate window, TUI watches files

**Value:** See progress without switching windows.

### Phase 3 — Integrated Launcher
- `expect` script integration
- TUI spawns Claude Code directly
- Live output stream in pipeline panel
- Abort button works

**Value:** True command center. Never leave the TUI.

---

## Execution Instructions (for when you run this)

```bash
# After weekly reset, open fresh session, then:
/auto-bmad-sprint-quick 1 — seed ≤5 records per entity

# Use: quick mode (no TEA), Sonnet, greenfield so no regression risk
# Estimated: 3-4 stories, ~250-300k tokens, well within budget at full reset
```

For Opus: only use on the semantic artifact tree story and the expect integration story if debugging gets complex.

---

## Files to Create

```
auto-bmad/
  tui/
    __init__.py
    __main__.py          ← entry point: python -m tui
    app.py               ← Textual App root
    panels/
      epics.py
      stories.py
      pipeline.py
      artifacts.py
      preview.py
      config.py
      statusbar.py
    data/
      sprint.py          ← sprint-status.yaml reader
      artifacts.py       ← semantic file tree builder
      usage.py           ← ccstatusline cache + API fallback
      jsonl.py           ← Claude Code JSONL reader
      git.py             ← git log poller
    launcher/
      session.expect     ← PTY controller (Phase 3)
      runner.py          ← expect subprocess wrapper (Phase 3)
    styles/
      theme.tcss         ← btop-inspired dark theme
  commands/
    tui.md               ← /auto-bmad-tui slash command
```

Launch command: `python -m tui` from project root, or via `/auto-bmad-tui` slash command.
