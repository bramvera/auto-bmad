---
name: 'auto-bmad-change-dev'
description: 'Implement a brownfield change with regression safety: lock existing behavior, implement, verify, review'
---

# Load Configuration

Read `_bmad/bmm/config.yaml` and `_bmad/tea/config.yaml` (if exists) and set the following variables:

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | bmm `output_folder` | `_bmad-output` |
| `{{implementation_artifacts}}` | bmm `implementation_artifacts` | `_bmad-output/implementation-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

# Load Project Context

Read `{{output_folder}}/project-context.md` if it exists.

# Detect Change Spec

The user MUST provide a path to a change spec file (from `/auto-bmad-change-spec`). This can be either:
- A Sprint Change Proposal (from `bmad-correct-course`)
- A Quick Tech Spec (from `bmad-quick-spec`)

IF user provides a file path:
THEN set `{{CHANGE_SPEC}}` to the path and read the file.
ELSE ask the user to provide the path to the change spec.

If no change spec exists, tell the user: "Run `/auto-bmad-change-spec` first to create a spec with impact analysis."

# Change Dev Pipeline

Implement the brownfield change with regression safety. The key difference from `bmad-quick-dev`: regression tests BEFORE touching anything, full test suite verification AFTER, and code review.

Each step MUST run in its own **foreground Task tool call** (subagent_type: "general-purpose") so that each agent gets a fresh context window.

**CRITICAL — Tool usage rules:**
- **DO** use the Task tool (foreground, default mode) for each step.
- **DO NOT** launch multiple Task calls simultaneously.
- **DO NOT** execute any step yourself — always delegate to a Task agent.

**Retry policy:** If a step fails, run `git reset --hard HEAD` to discard its partial changes, then retry **once**. If the retry also fails, stop the pipeline and tell the user which step failed and why.

# Pre-flight

Record before running any steps:
- `{{START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash
- `{{START_COMMIT_HASH}}` — run `git rev-parse --short HEAD`

# Pipeline Steps

After each successful step, run `git add -A && git commit --no-verify -m "wip(change): step N/7 <step-name> - done"`.

## Step 1: Regression Tests

Lock down existing behavior BEFORE changing anything. This is the safety net.

- **Task prompt:** `/bmad-testarch-automate yolo — REGRESSION MODE: Read {{CHANGE_SPEC}} and identify the existing behavior that must be preserved (the "Regression Scope" or "Impact Analysis" section). Write tests that lock down this existing behavior — focus on the code paths that the change will touch. Do NOT write tests for the new behavior yet. Do NOT modify any production code. Only write tests that pass against the current codebase. Run the tests to confirm they all pass.`

## Step 2: ATDD

Write failing tests for the NEW behavior defined in the change spec.

- **Task prompt:** `/bmad-testarch-atdd {{CHANGE_SPEC}} yolo — follow the test pyramid: prefer unit and integration tests over E2E. Only create E2E tests for criteria that genuinely require browser interaction. Your scope is strictly TDD red phase: generate failing acceptance tests ONLY. Do not modify any production code.`

## Step 3: Implement

Make the change.

- **Task prompt:** `/bmad-quick-dev {{CHANGE_SPEC}} yolo`

## Step 4: Full Test Suite

Verify nothing broke — both the new tests AND the regression tests AND all existing tests.

- **Task prompt (via Bash):** Run the project's test command (detect from `package.json` scripts, `Makefile`, `pytest.ini`, etc.). If any test fails, read the failure output and attempt to fix. Re-run until green or report what can't be fixed.

## Step 5: Edge-Case Hunt

- **Task prompt:** `/bmad-review-edge-case-hunter ultrathink yolo — run git diff {{START_COMMIT_HASH}} to get the production code changes as content. Fix all relevant findings by adding the suggested guards.`

## Step 6: Code Review

- **Task prompt:** `/bmad-code-review {{CHANGE_SPEC}} ultrathink yolo — fix all critical, high, and medium issues. For low issues, fix if they have concrete evidence (file:line), do not fix style preferences or hypothetical concerns as low findings. Pay special attention to regressions — verify the change doesn't break existing functionality identified in the change spec's impact analysis.`
- After Task returns, extract issue count. If 0 issues, skip the second review below.

**Code Review #2** (only if review #1 found issues):
- **Task prompt:** `/bmad-code-review {{CHANGE_SPEC}} yolo — fix all critical, high, and medium issues.`

## Step 7: Trace

- **Task prompt:** `/bmad-testarch-trace {{CHANGE_SPEC}} yolo — map the change spec's acceptance criteria to tests and implementation code. Verify full coverage.`

# Pipeline Report

1. Record `{{END_TIME}}`.
2. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
3. Generate report at `{{auto_bmad_artifacts}}/change-YYYY-MM-DD-HHMMSS.md`.
4. Print the report.

Run the token cost report: `python3 "$(find ~/.claude/plugins/cache/bramvera-plugins/auto-bmad -name token-report.py | sort | tail -1)" .` — saves accurate billing breakdown to `{{auto_bmad_artifacts}}/`. Use the `Cost: $X.XX standard` line for the Est. Cost row.

```markdown
# Change Report

| Field | Value |
|-------|-------|
| Pipeline | change-dev |
| Spec | {{CHANGE_SPEC}} |
| Start | {{START_TIME}} |
| End | {{END_TIME}} |
| Duration | <minutes>m |
| Est. Cost | ~$X.XX (see token-report-*.md) |
| Initial Commit | {{START_COMMIT_HASH}} |

## Pipeline Outcome

| # | Step | Status | Duration | Summary |
|---|------|--------|----------|---------|
| 1 | Regression Tests | done | Xm | <tests written to lock existing behavior> |
| 2 | ATDD | done | Xm | <failing tests for new behavior> |
| 3 | Implement | done | Xm | <files modified, key changes> |
| 4 | Full Test Suite | done | Xm | <all tests passing / failures found> |
| 5 | Edge-Case Hunt | done | Xm | <findings fixed> |
| 6 | Code Review | done | Xm | <issues found/fixed> |
| 7 | Trace | done | Xm | <coverage result> |

## Key Decisions & Learnings

Summarize notable decisions. If nothing notable, write "None."

**IMPORTANT: Use dash syntax (e.g. `/auto-bmad-change-dev`) NOT colon syntax when suggesting commands.**
```

# Final Commit

1. `git reset --soft {{START_COMMIT_HASH}}` — squash all checkpoint commits.
2. Determine commit type from the change spec:
   - `feat` for new features, `fix` for bug fixes, `refactor` for restructuring, `perf` for performance
3. Commit: `git add -A && git commit -m "<type>: <one-line summary from change spec>"`

**From this point on, do NOT auto-commit.**
