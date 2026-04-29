# Getting Started

This is the shortest path from install to the first automated sprint.

## 1. Install and Smoke Test

Confirm the target project already meets the BMAD requirements, then install Auto-BMAD for your host. See [Installation](installation.md) for host-specific setup.

Run the read-only check:

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-check` |
| Codex | `$auto-bmad-check` |
| Shared Agent Skills | `/skill:auto-bmad-check` |

If quick mode is ready, you can run a BMM quick sprint with only BMAD-METHOD installed. TEA is only required for full BMM mode. GDS is only required for game-development pipelines.

## 2. Prepare Input

Auto-BMAD is strongest when the product direction is clear. Use either:

- a short product description
- a product brief file
- existing BMAD artifacts from a manual planning session

For complex or unfamiliar products, do analysis manually first with BMAD skills such as `/bmad-brainstorming`, `/bmad-party-mode`, `/bmad-domain-research`, and `/bmad-product-brief`.

## 3. Create or Update the Plan

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-plan <product description or @file>` |
| Codex | `$auto-bmad-plan <product description or @file>` |
| Shared Agent Skills | `/skill:auto-bmad-plan <product description or @file>` |

The plan pipeline creates or updates PRD, UX, architecture, test-design, epics, stories, project context, and sprint planning artifacts where applicable.

## 4. Run a Quick Sprint First

Quick mode runs three steps per story: create story, develop, code review. It is the recommended first run.

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-sprint-quick 1` |
| Codex | `$auto-bmad-sprint-quick 1` |
| Shared Agent Skills | `/skill:auto-bmad-sprint-quick 1` |

For a single story:

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-story-quick 1-1` |
| Codex | `$auto-bmad-story-quick 1-1` |
| Shared Agent Skills | `/skill:auto-bmad-story-quick 1-1` |

## 5. Review the Output

After the sprint, review:

- story commits and final sprint commit
- sprint report
- failed or skipped stories
- test output and review findings
- updated `sprint-status.yaml`

If a story failed because an earlier dependent story failed, fix the root cause and rerun the same sprint command. Auto-BMAD skips completed stories and resumes pending work.

## 6. Move to Full Mode When Needed

Full mode is slower and more expensive, but adds heavier quality gates:

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-sprint 1` |
| Codex | `$auto-bmad-sprint 1` |
| Shared Agent Skills | `/skill:auto-bmad-sprint 1` |

Use full mode for production systems, complex domains, brownfield changes with regression risk, or work that needs traceability from requirements to tests to code.

## Codex Daily Flow

Codex uses the same generated skill names as slash-skill hosts, with a `$` prefix:

```text
$auto-bmad-sprint-quick 1
```

For story, sprint, and epic skills, you can omit the id and let the generated wrapper suggest the next item from BMAD sprint status.

Before execution, Codex checks for uncommitted changes. If the worktree is dirty, Auto-BMAD blocks until you choose manual cleanup, a safety commit, or abort.
