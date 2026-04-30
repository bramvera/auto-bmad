# Commands Reference

Every auto-bmad command orchestrates existing BMAD skills — it never bypasses BMAD guardrails or invents its own flows. This document maps each command to the exact BMAD skills it calls, so you know what's running under the hood.

Auto-BMAD exposes the same workflow intent through different host interfaces.

| Host | Invocation style | Example |
|------|------------------|---------|
| Claude Code | Slash command | `/auto-bmad-story-quick 1-1` |
| Codex | Skill command | `$auto-bmad-story-quick 1-1` |
| Agent Skills CLI | Slash skill | `/skill:auto-bmad-story-quick 1-1` |

Codex and other shared Agent Skills hosts use the same npm init install path: `npx @bramvera/auto-bmad init` from the target project. The generated skill names are the same; only the host prefix changes. Codex uses `$auto-bmad-sprint-quick 1`, while slash-skill hosts use `/skill:auto-bmad-sprint-quick 1`.

Before execution, Codex runs the same dirty-worktree preflight. Dirty uncommitted changes block execution until the user chooses manual cleanup, a safety commit, or abort.

For id-taking story, sprint, and epic skills, invoking a generated skill without the story id or epic number runs the fast status helper and suggests the next item from BMAD sprint status. `/auto-bmad-sprint-wizard` is interactive and does not require an id.

---

## Diagnostic Commands

### `/auto-bmad-check`

Read-only capability check. It verifies the current project can run Auto-BMAD and treats BMM quick mode as the baseline success path.

| Check | Required For | Missing Means |
|------|--------------|---------------|
| `_bmad/bmm/config.yaml` | BMM quick | Blocking issue |
| BMM quick skills | BMM quick | Blocking issue |
| `_bmad/tea/config.yaml` | BMM full, BMM plan, change-dev | Optional capability unavailable |
| `_bmad/gds/config.yaml` | GDS quick/full/plan | Optional capability unavailable |

The command does not create config files, install modules, migrate BMAD settings, or write reports.

---

### `/auto-bmad-assess [epic]`

Read-only/project-file assessment that recommends quick or full mode per epic. With no epic argument, it assesses the whole project and writes recommendation fields to `sprint-status.yaml`. With an epic argument, it updates only that epic's recommendation.

---

### `/auto-bmad-sprint-wizard`

Interactive sprint selection and resume workflow. It builds `auto-bmad-artifacts/sprint-plan.yaml`, lets the user select epics and optional steps, then executes the selected story steps with the same checkpoint discipline as quick sprint execution. It does not require an epic argument.

Reset variants:

```text
/auto-bmad-sprint-wizard reset
/auto-bmad-sprint-wizard reset autonomous
```

Reset backs up and archives the existing plan before showing the wizard questions again. `reset autonomous` does not silently proceed; it shows the rebuilt questions and asks before running autonomously.

The wizard resume view reports current epic/story/step, remaining tasks, selected story steps, selected epic-end steps, and capability warnings. If a plan includes `e2e`, TEA/test-architecture, or other non-quick steps that are not installed, the wizard must tell the user what is missing instead of silently dropping the step.

The wizard asks for execution style and stores it in the plan as `execution_style: subagents` or `execution_style: current-session`. Codex only spawns subagents when the selected execution style or user request explicitly asks for them.

For epic selection, the wizard accepts `A` for recommended runnable epics or `B` for explicit epic numbers. Completed epics are excluded from the runnable plan. Wizard reset only rebuilds the Auto-BMAD plan from current sprint status; it is not a hard project startover.

---

## Greenfield Commands

### `/auto-bmad-plan`

Planning pipeline for new projects. Each step runs as a fresh agent.

| Step | BMAD Skill | Purpose | Skippable |
|------|-----------|---------|-----------|
| 1 | `/bmad-product-brief` | Create product brief from user input | Yes — if brief or PRD exists |
| 2 | `/bmad-create-prd` | Create Product Requirements Document | Yes — if PRD exists |
| 3 | `/bmad-validate-prd` | Validate PRD and auto-fix issues | Yes — if PRD predates this run |
| 4 | `/bmad-create-ux-design` | Plan UX patterns and design specs | Yes — if UX spec exists or no frontend |
| 5 | `/bmad-create-architecture` | Create architecture and solution design | Yes — if architecture exists |
| 6 | `/bmad-testarch-framework` | Initialize test framework (TEA module) | Yes — if test framework configured |
| 7 | `/bmad-testarch-test-design` | System-level test plan (TEA module) | Yes — if test design exists |
| 8 | `/bmad-create-epics-and-stories` | Break requirements into epics and stories | Yes — if epics exist |
| 9 | `/bmad-check-implementation-readiness` | Validate all specs are complete | No — always runs |
| 10 | `/bmad-generate-project-context` | Generate project-context.md for AI agents | No — always runs |
| 11 | `/bmad-sprint-planning` | Create sprint plan from epics | Yes — if sprint-status.yaml exists |

---

### `/auto-bmad-sprint <epic>`

Runs an entire epic hands-off. Flattened architecture — the sprint coordinator calls each step directly (no nested story coordinator).

**Phase 1: Epic Start**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-test-design` | Epic-level test plan (TEA module) |

**Phase 2: Stories (repeated for each pending story)**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec from epics |
| 2 | `/bmad-review-adversarial-general` | Stress-test the spec, fix weaknesses |
| 3 | `/bmad-testarch-atdd` | Write failing acceptance tests — TDD red phase (TEA module) |
| 4 | `/bmad-dev-story` | Implement code to pass all tests |
| 5 | `/bmad-review-edge-case-hunter` | Find unhandled paths in new code, add guards |
| 6 | `/bmad-code-review` | Code review #1 — fix critical/high/medium issues |
| 7 | `/bmad-code-review` | Code review #2 — only if #1 found issues |
| 8 | `/bmad-code-review` | Code review #3 — only if #2 found issues |
| 9 | `/bmad-testarch-trace` | Map requirements to tests to code (TEA module) |
| 10 | `/bmad-testarch-automate` | Fill test coverage gaps (TEA module) |

**Phase 3: Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-trace` | Epic-level traceability (TEA module) |
| 2 | `/bmad-testarch-nfr` | Non-functional requirements assessment (TEA module) |
| 3 | `/bmad-testarch-test-review` | Test quality review with pyramid compliance (TEA module) |
| 4 | `/bmad-retrospective` | Post-epic review, resolve action items |
| 5 | `/bmad-generate-project-context` | Refresh project context with epic outcomes |

---

### `/auto-bmad-story <id>`

Runs a single story. Same 10 steps as the sprint's Phase 2, but as a standalone command with its own report.

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec |
| 2 | `/bmad-review-adversarial-general` | Adversarial review of spec |
| 3 | `/bmad-testarch-atdd` | Failing acceptance tests (TEA) |
| 4 | `/bmad-dev-story` | Implement |
| 5 | `/bmad-review-edge-case-hunter` | Edge-case hunt on diff |
| 6 | `/bmad-code-review` | Code review #1 |
| 7 | `/bmad-code-review` | Code review #2 (skipped if #1 clean) |
| 8 | `/bmad-code-review` | Code review #3 (skipped if #2 clean) |
| 9 | `/bmad-testarch-trace` | Traceability (TEA) |
| 10 | `/bmad-testarch-automate` | Expand test coverage (TEA) |

---

### `/auto-bmad-epic-start <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-test-design` | Epic-level test plan (TEA module) |

---

### `/auto-bmad-epic-end <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-trace` | Epic-level traceability (TEA) |
| 2 | `/bmad-testarch-nfr` | NFR assessment (TEA) |
| 3 | `/bmad-testarch-test-review` | Test quality and pyramid compliance (TEA) |
| 4 | `/bmad-retrospective` | Retrospective with action item resolution |
| 5 | `/bmad-generate-project-context` | Refresh project context |

---

## Brownfield Commands

### `/auto-bmad-change-spec`

Interactive change spec for brownfield modifications. The command assesses scope and routes to the appropriate BMAD skill. **This is human-driven — not automated.**

| Step | What | BMAD Skill |
|------|------|-----------|
| 1 | **Scope Assessment** | None — auto-bmad asks the user whether the change affects PRD, architecture, or epics |
| 2 | **Route to BMAD skill** | See below |

**Route A: Significant change** (affects PRD, architecture, or epics) → `/bmad-correct-course`

| Step | What |
|------|------|
| 1 | Load all BMAD artifacts (PRD, epics, architecture, UX, project context) |
| 2 | Run systematic impact analysis checklist with the user |
| 3 | Draft specific change proposals (old → new for each artifact) |
| 4 | Generate Sprint Change Proposal document |
| 5 | Get user approval |
| 6 | Finalize and route for implementation |

**Route B: Minor change** (contained code change) → Auto-BMAD minor change spec generation

| Step | What |
|------|------|
| 1 | Understand the change through conversation |
| 2 | Load BMAD project context and relevant planning artifacts |
| 3 | Investigate existing codebase for affected code |
| 4 | Generate implementation-ready minor change spec |
| 5 | Review spec with the user |

Both routes read project context and relevant BMAD artifacts. The human decides scope and approves the spec. Output is a spec file that `/auto-bmad-change-dev` takes as input.

---

### `/auto-bmad-change-dev <spec>`

Automated brownfield implementation with regression safety. Takes a spec file from `/auto-bmad-change-spec`.

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-automate` | Regression mode: lock down existing behavior BEFORE changing anything (TEA) |
| 2 | `/bmad-testarch-atdd` | Write failing tests for new behavior (TEA) |
| 3 | `/bmad-quick-dev` | Implement the change |
| 4 | Bash (test runner) | Run full test suite — regression + new + existing |
| 5 | `/bmad-review-edge-case-hunter` | Edge-case hunt on the diff |
| 6 | `/bmad-code-review` | Code review — focused on regressions (smart skip for #2) |
| 7 | `/bmad-testarch-trace` | Map change spec criteria to tests to code (TEA) |

**Key difference from `/bmad-quick-dev`:** Steps 1 (regression tests) and 4 (full test suite) are the safety net that quick-dev doesn't provide.

---

## GDS Commands

### `/auto-gds-plan`

| Step | BMAD Skill (GDS module) | Purpose | Skippable |
|------|------------------------|---------|-----------|
| 1 | `/gds-create-game-brief` | Game vision and concept | Yes — if brief or GDD exists |
| 2 | `/gds-create-gdd` | Game Design Document | Yes — if GDD exists |
| 3 | `/gds-create-narrative` | Narrative design and world-building | Yes — if exists or no narrative |
| 4 | `/gds-game-architecture` | Game architecture and engine design | Yes — if exists |
| 5 | `/gds-test-framework` | Game test framework setup | Yes — if configured |
| 6 | `/gds-test-design` | System-level game test scenarios | Yes — if exists |
| 7 | `/gds-generate-project-context` | Generate project context | No — always runs |
| 8 | `/gds-sprint-planning` | Sprint plan from epics | Yes — if exists |

### `/auto-gds-sprint <epic>`

Same structure as BMM sprint but with GDS skills:

**Phase 1: Epic Start**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-test-design` | Epic-level game test design |

**Phase 2: Stories**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-create-story` | Generate story spec |
| 2 | `/bmad-review-adversarial-general` | Adversarial review (core skill) |
| 3 | `/gds-dev-story` | Implement |
| 4 | `/bmad-review-edge-case-hunter` | Edge-case hunt (core skill) |
| 5 | `/gds-code-review` | Code review #1 |
| 6 | `/gds-code-review` | Code review #2 (skipped if #1 clean) |
| 7 | `/gds-code-review` | Code review #3 (skipped if #2 clean) |
| 8 | `/gds-performance-test` | Game performance assessment |
| 9 | `/gds-test-automate` | Expand game test coverage |
| 10 | `/gds-test-review` | Test quality review |

**Phase 3: Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-retrospective` | Retrospective with action items |
| 2 | `/gds-generate-project-context` | Refresh project context |

### `/auto-gds-story <id>`

Same 10 steps as GDS sprint Phase 2, standalone with its own report.

### `/auto-gds-epic-start <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-test-design` | Epic-level game test design |

### `/auto-gds-epic-end <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-retrospective` | Retrospective with action items |
| 2 | `/gds-generate-project-context` | Refresh project context |

---

## Quick Mode Commands

Quick mode uses BMAD-METHOD core only -- no TEA module required. 3 steps per story, retrospective at epic-end.

### `/auto-bmad-story-quick <id>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec from epics |
| 2 | `/bmad-dev-story` | Implement |
| 3 | `/bmad-code-review` | Code review -- fix critical/high/medium issues |

### `/auto-bmad-sprint-quick <epic>`

No epic-start phase. 3 steps per story. 1-step epic-end.

**Stories (repeated for each pending story)**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec |
| 2 | `/bmad-dev-story` | Implement |
| 3 | `/bmad-code-review` | Code review |

**Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-retrospective` | Retrospective with action item resolution |

### `/auto-gds-story-quick <id>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-create-story` | Generate story spec |
| 2 | `/gds-dev-story` | Implement |
| 3 | `/gds-code-review` | Code review |

### `/auto-gds-sprint-quick <epic>`

**Stories**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-create-story` | Generate story spec |
| 2 | `/gds-dev-story` | Implement |
| 3 | `/gds-code-review` | Code review |

**Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-retrospective` | Retrospective with action items |

---

## BMAD Module Dependencies

| auto-bmad Command | Requires |
|-------------------|----------|
| `/auto-bmad-check` | BMAD-METHOD for useful quick-mode result; no TEA/GDS required |
| `/auto-bmad-assess` | BMAD-METHOD |
| `/auto-bmad-sprint-wizard` | BMAD-METHOD |
| `/auto-bmad-plan` | BMAD-METHOD + TEA |
| `/auto-bmad-sprint` | BMAD-METHOD + TEA |
| `/auto-bmad-story` | BMAD-METHOD + TEA |
| `/auto-bmad-epic-start` | BMAD-METHOD + TEA |
| `/auto-bmad-epic-end` | BMAD-METHOD + TEA |
| `/auto-bmad-change-spec` | BMAD-METHOD |
| `/auto-bmad-change-dev` | BMAD-METHOD + TEA |
| `/auto-bmad-story-quick` | BMAD-METHOD |
| `/auto-bmad-sprint-quick` | BMAD-METHOD |
| `/auto-gds-story-quick` | BMAD-METHOD + GDS |
| `/auto-gds-sprint-quick` | BMAD-METHOD + GDS |
| `/auto-gds-plan` | BMAD-METHOD + GDS |
| `/auto-gds-sprint` | BMAD-METHOD + GDS |
| `/auto-gds-story` | BMAD-METHOD + GDS |
| `/auto-gds-epic-start` | BMAD-METHOD + GDS |
| `/auto-gds-epic-end` | BMAD-METHOD + GDS |
