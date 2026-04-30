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
| Complexity assessment | `$auto-bmad-assess [epic]` | `/skill:auto-bmad-assess [epic]` |
| Sprint wizard | `$auto-bmad-sprint-wizard` | `/skill:auto-bmad-sprint-wizard` |
| BMM plan | `$auto-bmad-plan <context>` | `/skill:auto-bmad-plan <context>` |
| BMM quick story | `$auto-bmad-story-quick 1-1` | `/skill:auto-bmad-story-quick 1-1` |
| BMM quick sprint | `$auto-bmad-sprint-quick 1` | `/skill:auto-bmad-sprint-quick 1` |
| BMM full story | `$auto-bmad-story 1-1` | `/skill:auto-bmad-story 1-1` |
| BMM full sprint | `$auto-bmad-sprint 1` | `/skill:auto-bmad-sprint 1` |
| BMM epic start | `$auto-bmad-epic-start 1` | `/skill:auto-bmad-epic-start 1` |
| BMM epic end | `$auto-bmad-epic-end 1` | `/skill:auto-bmad-epic-end 1` |
| Change spec | `$auto-bmad-change-spec <change>` | `/skill:auto-bmad-change-spec <change>` |
| Change dev | `$auto-bmad-change-dev <spec>` | `/skill:auto-bmad-change-dev <spec>` |
| GDS plan | `$auto-gds-plan <context>` | `/skill:auto-gds-plan <context>` |
| GDS quick story | `$auto-gds-story-quick 1-1` | `/skill:auto-gds-story-quick 1-1` |
| GDS quick sprint | `$auto-gds-sprint-quick 1` | `/skill:auto-gds-sprint-quick 1` |
| GDS full story | `$auto-gds-story 1-1` | `/skill:auto-gds-story 1-1` |
| GDS full sprint | `$auto-gds-sprint 1` | `/skill:auto-gds-sprint 1` |
| GDS epic start | `$auto-gds-epic-start 1` | `/skill:auto-gds-epic-start 1` |
| GDS epic end | `$auto-gds-epic-end 1` | `/skill:auto-gds-epic-end 1` |

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

For id-taking story, sprint, and epic skills, you can omit the id. The generated wrapper runs the fast status helper and suggests the next story or epic from BMAD sprint status. `$auto-bmad-sprint-wizard` is interactive and does not require an id.

Sprint wizard reset and monitoring:

```text
$auto-bmad sprint wizard
$auto-bmad sprint wizard autonomous
$auto-bmad sprint wizard reset
```

Use `reset` when the saved wizard plan is stale or you want to choose epics/steps again. Reset backs up and archives the old `sprint-plan.yaml`, then asks the wizard questions again. `reset autonomous` still shows the rebuilt plan questions before proceeding.

The wizard also asks for execution style. Choose fresh workers/subagents when you want Codex to run each BMAD step in a separate worker context. Choose current session when you want simpler sequential execution. Codex only spawns subagents when the wizard plan or user request explicitly asks for them.

When selecting epics, choose `A` for recommended runnable epics or type explicit epic numbers. Completed epics are skipped; hard startovers require an intentional project/git reset outside the wizard.

Typical quick-mode wizard answers:

```text
A   # recommended runnable epics
n   # no optional steps
1   # fresh workers/subagents
y   # apply to all selected epics
y   # proceed
```

Use `c` instead of `n` at the optional-step prompt when you want epic-end E2E generation and the project has `bmad-qa-generate-e2e-tests` installed.

For read-only monitoring:

```bash
node .agents/skills/_auto-bmad-runtime/scripts/status-auto-bmad.mjs --project-root . --wizard
```

The wizard status shows remaining tasks and warns when the plan contains optional/full steps that the current installation cannot run. Quick mode only requires BMAD-METHOD; E2E requires `bmad-qa-generate-e2e-tests`; full/TEA mode requires `_bmad/tea/config.yaml` and matching `bmad-testarch-*` skills.

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
