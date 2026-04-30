# Auto BMAD

[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE.md) [![Claude Code](https://img.shields.io/badge/Claude_Code-Slash_Commands-blueviolet)](https://docs.anthropic.com/en/docs/claude-code) [![Codex](https://img.shields.io/badge/Codex-$auto--bmad--check-111827)](docs/tutorial-codex.md) [![Agent Skills](https://img.shields.io/badge/Agent_Skills-.agents%2Fskills-0f766e)](docs/installation.md#codex-and-shared-agent-skills-hosts) [![BMAD v6.5.0](https://img.shields.io/badge/BMAD-v6.5.0-orange)](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0)

Auto-BMAD runs BMAD 6.5 execution pipelines across Claude Code, Codex, and shared Agent Skills hosts. It does not generate an app from one prompt. It orchestrates existing BMAD skills with checkpoints, reviews, reports, and resumable sprint state.

> Fork of [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad), updated for BMAD-METHOD v6.5.0 with quick/full modes, sprint automation, diagnostics, and flattened agent architecture.

## Requirements

Auto-BMAD runs on top of an existing BMAD project. Before installing Auto-BMAD, set up the required BMAD modules from their own documentation:

- [BMAD-METHOD v6.5.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0) - required for every Auto-BMAD workflow
- [TEA v1.15.1](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise) - required only for full BMM mode
- [GDS v0.2.2](https://github.com/bmad-code-org/bmad-module-game-dev-studio/releases/tag/v0.2.2) - required only for game-development workflows

Quick mode only needs BMAD-METHOD. Auto-BMAD assumes BMAD skills and config files already exist in the target project.

## Install Auto-BMAD

### Claude Code

Fast path:

```bash
npx @bramvera/auto-bmad
```

Or install manually inside Claude Code:

```text
/plugin marketplace add bramvera/claude-code-plugins
/plugin install auto-bmad@bramvera-plugins --scope user
/reload-plugins
```

Smoke test:

```text
/auto-bmad-check
```

For unattended sprint runs, start Claude Code with `claude --dangerously-skip-permissions` in a repo you trust. Without it, Claude will prompt for approval on most actions.

### Codex and Shared Agent Skills Hosts

Use this path for Codex, Pi, and other hosts that read project-local `.agents/skills`:

```bash
cd /path/to/your/project
npx @bramvera/auto-bmad init
```

Smoke tests:

| Host | Command |
|------|---------|
| Codex | `$auto-bmad-check` |
| Pi / slash-skill hosts | `/skill:auto-bmad-check` |

See [Installation](docs/installation.md) for local checkout installs, updates, uninstall commands, and host-specific notes.

## First Run

Start with quick mode unless you already know you need the heavier full pipeline.

| Step | Claude Code | Codex | Shared Agent Skills |
|------|-------------|-------|---------------------|
| Check install | `/auto-bmad-check` | `$auto-bmad-check` | `/skill:auto-bmad-check` |
| Create/update plan | `/auto-bmad-plan <product description or @file>` | `$auto-bmad-plan <product description or @file>` | `/skill:auto-bmad-plan <product description or @file>` |
| Run first quick sprint | `/auto-bmad-sprint-quick 1` | `$auto-bmad-sprint-quick 1` | `/skill:auto-bmad-sprint-quick 1` |

Codex and shared Agent Skills installs use the same generated skill names. Only the host prefix changes: `$auto-bmad-sprint-quick` in Codex, `/skill:auto-bmad-sprint-quick` in slash-skill hosts.

## Sprint Wizard Resume And Reset

The sprint wizard is for selecting multiple epics and optional steps, then resuming from `auto-bmad-artifacts/sprint-plan.yaml`.

Common Codex forms:

```text
$auto-bmad sprint wizard
$auto-bmad sprint wizard autonomous
$auto-bmad sprint wizard reset
```

- `sprint wizard` shows existing plan status, remaining tasks, capability warnings, and asks what to do.
- `sprint wizard autonomous` resumes the saved plan without routine prompts.
- `sprint wizard reset` backs up and archives the existing plan, then asks the wizard questions again.
- `sprint wizard reset autonomous` still shows the rebuilt wizard questions first, then asks whether to proceed autonomously.
- The wizard asks whether to run BMAD steps through fresh workers/subagents or in the current session. Codex only spawns subagents when that option, or an explicit subagent/worker request, is present.
- In the wizard, `all` means all runnable/pending epics. Completed epics are excluded unless you explicitly enter `all including completed`.

Reset creates timestamped safety files before rebuilding:

```text
_bmad-output/auto-bmad-artifacts/sprint-plan-backup-before-reset-<datetime>.yaml
_bmad-output/auto-bmad-artifacts/sprint-plan-archived-<datetime>.yaml
```

Wizard status also reports whether your selected steps match the installed capabilities. Quick mode needs only BMAD-METHOD. E2E requires `bmad-qa-generate-e2e-tests`. Full/TEA steps require `_bmad/tea/config.yaml` and matching `bmad-testarch-*` skills.

## Choose a Mode

| | Quick Mode | Full Mode |
|---|---|---|
| BMAD modules | BMAD-METHOD only | BMAD-METHOD + TEA |
| Per story | Create, develop, code review | Create, adversarial review, ATDD, develop, edge-case hunt, 3x review, trace, automate |
| Best for | Prototypes, side projects, familiar domains, token control | Production systems, complex domains, brownfield risk, traceability |
| Typical sprint | 2.5-3.5h, ~350-450k tokens | 5-6h, ~800k-1M tokens |

Game-development pipelines use GDS. See [GDS Tutorial](docs/tutorial-gds.md).

## What Auto-BMAD Runs

Auto-BMAD automates BMAD execution after your analysis and planning inputs are ready:

- planning pipelines for BMM and GDS projects
- quick story and sprint execution
- full story and sprint execution with TEA quality gates
- brownfield change specs and change development
- progress files, reports, git checkpoints, rollback, and resume

It intentionally does not automate interactive discovery work such as brainstorming, party-mode debates, product discovery, or human approval checkpoints. See [Concepts](docs/concepts.md) for the reasoning.

## Documentation

- [Installation](docs/installation.md) - install commands, smoke tests, updates, local development installs
- [Getting Started](docs/getting-started.md) - new-user flow from check to first sprint
- [Concepts](docs/concepts.md) - where Auto-BMAD fits, mode tradeoffs, compatible BMAD skills
- [Sprints](docs/sprints.md) - sprint lifecycle, resume behavior, failure handling, duration
- [Commands Reference](docs/commands-reference.md) - every command mapped to the BMAD skills it calls
- [BMM Tutorial](docs/tutorial-bmm.md) - Business Model Method walkthrough
- [GDS Tutorial](docs/tutorial-gds.md) - Game Dev Suite walkthrough
- [Codex Tutorial](docs/tutorial-codex.md) - Codex install and skill command syntax
- [FAQ](docs/faq.md) - common questions and troubleshooting

## Credits

Built on the original [auto-bmad](https://github.com/stefanoginella/auto-bmad) by [Stefano Ginella](https://github.com/stefanoginella), who designed the core pipeline orchestration concept and the BMM/GDS command structure.

The pipelines are powered by the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) by [bmad-code-org](https://github.com/bmad-code-org).

## License

[MIT](LICENSE.md)
