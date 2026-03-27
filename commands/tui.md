---
name: 'auto-bmad-tui'
description: 'Launch the auto-bmad command center TUI'
---

Launch the auto-bmad TUI from the current project directory.

## Prerequisites

Install dependencies once:

```bash
pip install -r "$(find ~/.claude/plugins -path '*/auto-bmad/tui/requirements.txt' | head -1)"
```

## Launch

```bash
python -m "$(find ~/.claude/plugins -path '*/auto-bmad/tui' -type d | head -1 | xargs dirname | xargs basename).tui" "$(pwd)"
```

Or if running auto-bmad as a local plugin:

```bash
cd /path/to/auto-bmad/auto-bmad
python -m tui /path/to/your/project
```

## Keybindings

| Key | Action |
|-----|--------|
| `tab` | Cycle panel focus |
| `j` / `k` | Scroll within panel |
| `enter` | Open artifact / confirm |
| `space` | Generate & copy run command |
| `p` | Cycle preset (board → pipeline → cost → config) |
| `m` | Toggle mode (quick ↔ full) |
| `t` | Cycle TDS size (minimal → standard → full) |
| `w` | Toggle WDS |
| `r` | Refresh all panels |
| `q` | Quit |
