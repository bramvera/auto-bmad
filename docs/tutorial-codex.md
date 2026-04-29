# Auto-BMAD with Codex

This tutorial shows how to use Auto-BMAD from Codex against a BMAD v6.5 project.

Codex uses the same generated Agent Skills install as Pi and other shared-skill hosts. The difference is command syntax: Codex uses `$skill-name`, while slash-skill hosts use `/skill:skill-name`.

## Prerequisites

Auto-BMAD assumes the target project already has BMAD v6.5+ installed and configured. Follow the [BMAD-METHOD documentation](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0) for BMAD setup before using Auto-BMAD.

For quick mode, BMAD-METHOD is enough. TEA is only needed for full BMM pipelines, and GDS is only needed for game-development pipelines.

## Install Auto-BMAD

Run this from each target project:

```bash
cd /path/to/your/project
npx @bramvera/auto-bmad init
```

This writes generated Auto-BMAD workflow skills into the target project's `.agents/skills` directory. It writes only under `.agents/skills`.

Preview first:

```bash
npx @bramvera/auto-bmad init --dry-run
```

If `.agents/skills` does not exist, complete the BMAD project setup from BMAD's documentation first.

For local development from a source checkout:

```bash
git clone https://github.com/bramvera/auto-bmad.git /path/to/auto-bmad-source
cd /path/to/your/project
node /path/to/auto-bmad-source/package/cli.js init
```

## Command List

| Workflow | Codex | Slash-skill host |
|----------|-------|------------------|
| Readiness check | `$auto-bmad-check` | `/skill:auto-bmad-check` |
| BMM plan | `$auto-bmad-plan <context>` | `/skill:auto-bmad-plan <context>` |
| BMM quick story | `$auto-bmad-story-quick 1-1` | `/skill:auto-bmad-story-quick 1-1` |
| BMM quick sprint | `$auto-bmad-sprint-quick 1` | `/skill:auto-bmad-sprint-quick 1` |
| BMM full story | `$auto-bmad-story 1-1` | `/skill:auto-bmad-story 1-1` |
| BMM full sprint | `$auto-bmad-sprint 1` | `/skill:auto-bmad-sprint 1` |
| GDS plan | `$auto-gds-plan <context>` | `/skill:auto-gds-plan <context>` |
| GDS quick story | `$auto-gds-story-quick 1-1` | `/skill:auto-gds-story-quick 1-1` |
| GDS quick sprint | `$auto-gds-sprint-quick 1` | `/skill:auto-gds-sprint-quick 1` |
| GDS full story | `$auto-gds-story 1-1` | `/skill:auto-gds-story 1-1` |
| GDS full sprint | `$auto-gds-sprint 1` | `/skill:auto-gds-sprint 1` |

## Readiness Check

Start with:

```text
$auto-bmad-check
```

This is read-only. It checks BMAD skill availability, module configs, optional modules, and output paths.

Quick mode is the baseline. Missing TEA or GDS is reported as an optional capability warning, not a quick-mode failure.

## Running Workflows

Use the direct generated skill name:

```text
$auto-bmad-sprint-quick 1
$auto-bmad-story-quick 1-1
```

For story, sprint, and epic skills, you can omit the id. The generated wrapper runs the fast status helper and suggests the next story or epic from BMAD sprint status.

Before real execution, Auto-BMAD checks for uncommitted changes. If the worktree is dirty, execution blocks until you choose manual cleanup, a safety commit, or abort.

## New Projects

If `sprint-status.yaml` does not exist yet, story and sprint skills cannot suggest the next item. Run planning and sprint planning first:

```text
$auto-bmad-plan <product description or @file>
```

Auto-BMAD does not require a separate Auto-BMAD config file.

## Claude Code vs Codex

Use Claude Code slash commands when running in Claude Code:

```text
/auto-bmad-sprint-quick 1
```

Use Codex skill commands when running in Codex:

```text
$auto-bmad-sprint-quick 1
```

The workflow intent is the same. The install path is the same as other shared Agent Skills hosts; only the command prefix changes.
