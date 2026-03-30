---
name: 'auto-bmad-sprint-quick'
description: 'Quick mode: run all stories in an epic — 3 steps per story, Quinn QA at epic end (no TEA required)'
---

# Load Configuration

Read `_bmad/bmm/config.yaml` and set the following variables (resolve `{project-root}` to the actual project root path):

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | bmm `output_folder` | `_bmad-output` |
| `{{planning_artifacts}}` | bmm `planning_artifacts` | `_bmad-output/planning-artifacts` |
| `{{implementation_artifacts}}` | bmm `implementation_artifacts` | `_bmad-output/implementation-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

All paths in this command that reference BMAD output directories MUST use these variables — never hardcode `_bmad-output` paths.

**COSMETIC RULE:** The `{{variable}}` syntax in this document is for YOUR internal use only. NEVER print `{{variable}}` literally in terminal output — always resolve to the actual value. For example, print `Story 1-3 — done` not `Story {{STORY_ID}} — done`.

**NOTE:** This is quick mode. Do NOT read `_bmad/tea/config.yaml`. TEA is not required.

# Load Project Context

Read `{{output_folder}}/project-context.md` if it exists. This gives you general context about the project — its purpose, stack, conventions, and current state. Use this context to make informed decisions throughout the pipeline.

# Detect Epic Number

An epic number is a single integer identifying the epic (e.g., `1`, `2`, `3`).

IF user provides an epic number:
THEN set {{EPIC_ID}} to the provided number.
ELSE ask the user to provide the epic number to run and set {{EPIC_ID}} to the provided value.

# Sprint Pipeline (Quick Mode)

Run the entire epic lifecycle in quick mode — no epic-start, 3 steps per story, then Quinn QA + retrospective at epic-end. Fully hands-off.

**ARCHITECTURE NOTE:** The sprint coordinator runs each story step as a direct Task call — it does NOT delegate to `/auto-bmad-story-quick`. This avoids context exhaustion from nested agents. Sprint → Step agent (2 levels only).

Each step MUST run in its own **foreground Task tool call** (subagent_type: "general-purpose") so that each agent gets a fresh context window.

**CRITICAL — Tool usage rules:**
- **DO** use the Task tool (foreground, default mode) for each step. It blocks and returns the result.
- **DO NOT** use TeamCreate, SendMessage, TaskOutput, TaskCreate, or TaskList. This is a sequential pipeline, not a team collaboration.
- **DO NOT** launch multiple Task calls simultaneously. Wait for each to return before launching the next.
- **DO NOT** execute any step, fix, or implement new code yourself — always delegate to a Task agent.
- **DO NOT** invoke `/auto-bmad-story-quick` as a nested skill. Run the underlying BMAD skills directly to avoid nesting.

**CRITICAL — Context management (prevents degradation on long runs):**

1. **Discard Task results immediately.** Extract ONLY: pass/fail status and a one-line summary.
2. **Write to disk, not memory.** All details go into the progress file on disk.
3. **Keep coordinator messages minimal.** Print only the one-line progress update per step.
4. **Do not accumulate lists.** Track results as simple tuples — nothing more.

**Retry policy:** If a step fails, run `git reset --hard HEAD` to discard its partial changes, then retry **once**. If the retry also fails:
- Roll back the entire story: `git reset --hard {{STORY_START_COMMIT}}`
- Log the failure with story ID, step number, and reason
- Record the failure in the progress file
- **STOP the sprint and ask the user for guidance** — do not skip to the next story. Two consecutive failures indicate a real issue that needs human attention. Present the user with options: fix manually and resume, skip this story, or abort the sprint.

# Discover Stories

1. Read `{{implementation_artifacts}}/sprint-status.yaml` to get all stories for epic {{EPIC_ID}}.
2. Parse the story list — extract story IDs (e.g., `1-1`, `1-2`, `1-3`, etc.) and their current status.
3. Filter to only stories that are NOT already completed (status is not `done`, `completed`, or `shipped`).
4. Sort by story number ascending (1-1 before 1-2 before 1-3).
5. Set `{{STORY_LIST}}` to the ordered list of pending story IDs.
6. Set `{{TOTAL_STORIES}}` to the count.

If no pending stories found, STOP and tell the user: "All stories in epic {{EPIC_ID}} are already completed."

Report: "Quick Mode — Found {{TOTAL_STORIES}} pending stories for epic {{EPIC_ID}}: {{STORY_LIST}}"

# Pre-flight

Before running any steps, record:
- `{{SPRINT_START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output
- `{{SPRINT_START_COMMIT}}` — run `git rev-parse --short HEAD` and store the result

Print: `Quick Mode — no epic-start step (test design skipped)`

# Phase 1: Stories

For each story ID `{{STORY_ID}}` in `{{STORY_LIST}}`, in order:

1. Print: `=== Story {{STORY_ID}} ({{CURRENT}}/{{TOTAL_STORIES}}) [quick] ===`
2. Record `{{STORY_START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"`
3. Record `{{STORY_START_COMMIT}}` — run `git rev-parse --short HEAD`
4. Set `{{EPIC_ID}}` and `{{STORY_NUM}}` by splitting `{{STORY_ID}}` on the dash separator.

Run the 3 story steps below. After each successful step, run `git add -A && git diff --cached --quiet || git commit --no-verify -m "wip({{STORY_ID}}): step N/3 <step-name> - done"`. This skips the commit if the BMAD skill already committed its own changes. Do NOT treat "nothing to commit" as an error.

If any step fails after retry, roll back: `git reset --hard {{STORY_START_COMMIT}}`, log the failure, update the progress file, and STOP — ask the user for guidance before continuing.

## Story Steps

### Step 1: Create Story
- **Skip if:** a story file for {{STORY_ID}} already exists in `{{implementation_artifacts}}/` (glob for `{{STORY_ID}}-*.md`). Set `{{STORY_FILE}}` to the existing file path.
- **Task prompt:** `/bmad-create-story story {{STORY_ID}} yolo`
- After success: glob `{{implementation_artifacts}}/{{STORY_ID}}-*.md` to set `{{STORY_FILE}}`.

### Step 2: Develop
- **Task prompt:** `/bmad-dev-story {{STORY_FILE}} ultrathink yolo`

### Step 3: Code Review
- **Task prompt:** `/bmad-code-review {{STORY_FILE}} ultrathink yolo — fix all critical, high, and medium issues. For low issues, fix if they have concrete evidence (file:line), do not fix style preferences or hypothetical concerns as low findings.`

## Story Completion

After step 3 completes successfully:

1. **Mark all tasks as done in the story file.** Read `{{STORY_FILE}}` and replace every unchecked task checkbox (`- [ ]`) with a checked one (`- [x]`).
2. Update `{{STORY_FILE}}` status if not already marked done.
3. Update `{{implementation_artifacts}}/sprint-status.yaml` to mark the story as completed.
4. Squash story commits: `git reset --soft {{STORY_START_COMMIT}}` then determine commit type from story content:
   - `feat` for new features, `fix` for bug fixes, `refactor` for restructuring, `chore` for configs/tooling
   - Commit: `git add -A && git commit -m "<type>({{STORY_ID}}): <one-line summary>"`
5. Print: `Story {{STORY_ID}} — done ({{DURATION}}m) [{{CURRENT}}/{{TOTAL_STORIES}}]`
6. Update progress file (see below).

## Progress Report (written after every story)

After each story completes (or fails), create `{{auto_bmad_artifacts}}/` directory if it doesn't exist, then write/update `{{auto_bmad_artifacts}}/quick-sprint-epic-{{EPIC_ID}}-progress.md`. This is a **live file** — overwritten after each story so you always have a record even if the sprint crashes.

```markdown
# Sprint Progress: Epic {{EPIC_ID}} — Quick Mode (LIVE)

Last updated: {{STORY_END_TIME}}
Sprint started: {{SPRINT_START_TIME}}
Mode: quick (3 steps per story)
Stories completed: {{COMPLETED}} / {{TOTAL_STORIES}}

| # | Story | Status | Duration | Commit Before | Summary |
|---|-------|--------|----------|---------------|---------|
| 1 | 1-1 | done | 28m | abc1234 | Project scaffold |
| 2 | 1-2 | done | 32m | def5678 | Auth system |
| 3 | 1-3 | FAILED (step 2) | 8m | ghi9012 | Develop failed: missing dependency |
| 4 | 1-4 | pending | - | - | - |

## Failed Stories

- **Story 1-3** (failed at step 2 — Develop): Missing dependency
  - Commit before story: ghi9012
  - Recovery: `git reset --hard ghi9012`, fix the issue, then `/auto-bmad-story-quick 1-3`
```

# Phase 2: Epic End (2 Steps)

After all stories have been attempted (whether all succeeded or some failed):

Record `{{EPIC_END_START_COMMIT}}` — run `git rev-parse --short HEAD`.

### Step 1: Quinn QA — Generate E2E Tests

- **Task prompt:** `/bmad-qa-generate-e2e-tests yolo — generate end-to-end automated tests for all features implemented in epic {{EPIC_ID}}. Focus on critical happy-path user journeys. Follow the test pyramid: only create E2E tests for scenarios that genuinely require full user interaction.`
- After Task completes: `git add -A && git diff --cached --quiet || git commit --no-verify -m "wip(epic-{{EPIC_ID}}-end): quinn-qa - done"`

### Step 2: Retrospective

- **Task prompt:** `/bmad-retrospective epic {{EPIC_ID}} ultrathink yolo - and fix all implementable action items required before the next epic, mark them as done/resolved, and defer any non-implementable items with a clear explanation`
- After Task completes: `git add -A && git diff --cached --quiet || git commit --no-verify -m "wip(epic-{{EPIC_ID}}-end): retrospective - done"`

**IMPORTANT — BMAD skills may commit and squash internally.** Some skills (especially `bmad-retrospective`) commit their own changes. Before running each epic-end step, check `git log --oneline -3` to see if the previous skill already handled it. If a step's work is already committed, skip it and move on.

After all epic-end steps complete, check if the BMAD skills already squashed. If a commit like `chore(epic-X): epic end` already exists, skip the squash. Otherwise: `git reset --soft {{EPIC_END_START_COMMIT}}` then `git add -A && git commit -m "chore(epic-{{EPIC_ID}}): epic end — Quinn QA and retro done"`

Print: `Epic End — done (quick mode)`

# Sprint Report

1. Record `{{SPRINT_END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output.
2. Calculate total duration.
3. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
4. Generate the report and save it to `{{auto_bmad_artifacts}}/quick-sprint-epic-{{EPIC_ID}}-YYYY-MM-DD-HHMMSS.md` (using `{{SPRINT_END_TIME}}` for the timestamp).
5. Print the full report to the user.

Run the token cost report: `python3 "$(find ~/.claude/plugins/cache/bramvera-plugins/auto-bmad -name token-report.py | sort | tail -1)" .` — saves accurate billing breakdown to `{{auto_bmad_artifacts}}/`. Use the `Cost: $X.XX standard` line for the Est. Cost row.

Use this template for the report:

```markdown
# Sprint Report: Epic {{EPIC_ID}} (Quick Mode)

| Field | Value |
|-------|-------|
| Pipeline | sprint-quick |
| Mode | quick (3 steps per story) |
| Epic | {{EPIC_ID}} |
| Start | {{SPRINT_START_TIME}} |
| End | {{SPRINT_END_TIME}} |
| Duration | <hours>h <minutes>m |
| Est. Cost | ~$X.XX (see token-report-*.md) |
| Initial Commit | {{SPRINT_START_COMMIT}} |
| Stories Attempted | {{TOTAL_STORIES}} |
| Stories Completed | <count> |
| Stories Failed | <count> |

## Story Results

| # | Story | Status | Duration | Summary |
|---|-------|--------|----------|---------|
| 1 | {{STORY_ID}} | done/failed | Xm | <one-line summary> |

## Epic End

| Step | Status | Summary |
|------|--------|---------|
| Quinn QA | done | <tests generated count, coverage areas> |
| Retrospective | done | <action items resolved/deferred> |

## Failed Stories

List any stories that failed with the reason. If none, write "None — all stories completed successfully."

## Sprint Summary

- Total files created/modified: <sum across all stories>
- Code review passes: <how many reviews came back clean>
- Quinn QA tests generated: <count>

## Key Decisions & Learnings

Summarize notable decisions. If nothing notable, write "None."

**IMPORTANT: Use dash syntax (e.g. `/auto-bmad-sprint-quick`) NOT colon syntax when suggesting commands.**

### Next
- Review the sprint report and any failed stories
- If failed stories exist, run them individually: `/auto-bmad-story-quick <story-id>`
- If more epics remain, run `/auto-bmad-sprint-quick <next-epic-number>` for the next epic
- If all epics are done, the project is complete
```

**From this point on, do NOT auto-commit.** Only commit when the user explicitly asks you to.
