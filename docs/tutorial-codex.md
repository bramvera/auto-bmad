# Auto-BMAD with Codex

This tutorial shows how to use Auto-BMAD from Codex against BMAD v6.5 shared skill installs.

Codex support is a bridge for status, diagnostics, command discovery, and dry-run routing. The full unattended Auto-BMAD pipelines remain Claude Code-first because those command files rely on Claude's foreground Task tool orchestration.

## What Codex Can Do

In Codex, Auto-BMAD provides:

- fast YAML progress lookup with `$auto-bmad`
- read-only readiness checks with `$auto-bmad-check`
- explicit command menus with `$auto-bmad menu`
- dry-run routing checks with `$auto-bmad-codex`
- dirty-worktree preflight before any real execution

Codex does not need a separate Auto-BMAD YAML file. For BMAD v6.5+, it reads the BMAD module config, such as `_bmad/bmm/config.yaml`, then resolves configured output paths like `implementation_artifacts` to find `sprint-status.yaml`.

## Prerequisites

Install BMAD v6.5+ in your project first:

```bash
npx bmad-method install
```

For quick mode, BMAD-METHOD is enough. TEA is only needed for full BMM pipelines, and GDS is only needed for game-development pipelines.

## Install Auto-BMAD

Install the Auto-BMAD plugin in Codex using the normal Codex plugin flow for this repository.

After installation, Codex may show both plugin and skill entries, for example:

```text
Auto-BMAD              [Plugin]
Auto-BMAD Menu         [Skill]
Auto-BMAD Check        [Skill]
Auto-BMAD Flow Check   [Skill]
```

The plugin row means the bundle is installed. The invocable workflows are the skills.

Some Codex surfaces may show namespaced skill names such as:

```text
auto-bmad:auto-bmad
auto-bmad:auto-bmad-check
auto-bmad:auto-bmad-codex
```

## Daily Flow

Use the main entrypoint:

```text
$auto-bmad
```

With no arguments, Auto-BMAD reads BMAD YAML status and suggests the next pending story and epic. It does not print the full menu during day-to-day use.

Example output:

```text
Auto-BMAD Status
Project: /path/to/project
Config: _bmad/bmm/config.yaml
Sprint status: _bmad-output/implementation-artifacts/sprint-status.yaml

Next pending story: 2-3 (event management admin ui)
Suggested: $auto-bmad quick story 2-3

Next pending epic: 2
Pending stories in epic 2: 1
Suggested: $auto-bmad quick sprint 2

Choose:
1. Run next story 2-3
2. Run next epic 2
```

Reply:

```text
1
```

to continue with the next story, or:

```text
2
```

to continue with the next epic/sprint.

`continue`, `ok`, `yes`, and similar short confirmations choose option 1.

## Command Menu

Only ask for the menu when you need discovery:

```text
$auto-bmad menu
```

This avoids repeatedly printing a large command list during normal progress checks.

## Readiness Check

Run:

```text
$auto-bmad-check
```

This is read-only. It checks BMAD skill availability, module configs, optional modules, and output paths.

Quick mode is the baseline. Missing TEA or GDS is reported as an optional capability warning, not a quick-mode failure.

## Dry-Run Flow Check

Run:

```text
$auto-bmad-codex
```

or provide a slash-like command to check routing:

```text
$auto-bmad-codex /auto-bmad-story-quick 1-1
```

This validates that Auto-BMAD can resolve the command and referenced BMAD skills. It does not run a full BMAD story, sprint, or TEA flow.

## Dirty Worktree Preflight

Before real execution, Auto-BMAD checks for uncommitted changes.

If the worktree is dirty, execution blocks and Codex should ask you to choose:

```text
1. Commit/stash/clean manually, then rerun Auto-BMAD
2. Create a safety commit of all current changes, then continue
3. Abort
```

Auto-BMAD should not skip stories, run rollback logic, or continue over dirty user work.

## New Projects

If `sprint-status.yaml` does not exist yet, `$auto-bmad` treats the project as pre-sprint.

In that case, run planning and sprint planning first. Auto-BMAD will point you toward the next useful command instead of requiring a separate Auto-BMAD config file.

## When To Use Claude Code Instead

Use Claude Code for full unattended Auto-BMAD pipeline runs:

```text
/auto-bmad-sprint-quick 1
/auto-bmad-sprint 1
```

Use Codex when you want fast status, readiness checks, dry-run validation, and carefully confirmed quick-mode execution from the shared BMAD v6.5 skill layout.
