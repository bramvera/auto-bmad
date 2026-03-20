---
name: 'auto-bmad-sprint'
description: 'Run all stories in an epic autonomously: epic-start, all stories, epic-end — fully hands-off'
---

# Load Configuration

Read `_bmad/bmm/config.yaml` and `_bmad/tea/config.yaml` and set the following variables (resolve `{project-root}` to the actual project root path):

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | bmm `output_folder` | `_bmad-output` |
| `{{planning_artifacts}}` | bmm `planning_artifacts` | `_bmad-output/planning-artifacts` |
| `{{implementation_artifacts}}` | bmm `implementation_artifacts` | `_bmad-output/implementation-artifacts` |
| `{{test_artifacts}}` | tea `test_artifacts` | `_bmad-output/test-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

All paths in this command that reference BMAD output directories MUST use these variables — never hardcode `_bmad-output` paths.

# Load Project Context

Read `{{output_folder}}/project-context.md` if it exists. This gives you general context about the project — its purpose, stack, conventions, and current state. Use this context to make informed decisions throughout the pipeline.

# Detect Epic Number

An epic number is a single integer identifying the epic (e.g., `1`, `2`, `3`).

IF user provides an epic number:
THEN set {{EPIC_ID}} to the provided number.
ELSE ask the user to provide the epic number to run and set {{EPIC_ID}} to the provided value.

# Sprint Pipeline

Run the entire epic lifecycle autonomously — epic-start, all stories in sequence, then epic-end. This is fully hands-off: kick it off and walk away.

Each step MUST run in its own **foreground Task tool call** (subagent_type: "general-purpose") so that each agent gets a fresh context window.

**CRITICAL — Tool usage rules:**
- **DO** use the Task tool (foreground, default mode) for each step. It blocks and returns the result.
- **DO NOT** use TeamCreate, SendMessage, TaskOutput, TaskCreate, or TaskList. This is a sequential pipeline, not a team collaboration.
- **DO NOT** launch multiple Task calls simultaneously. Wait for each to return before launching the next.
- **DO NOT** execute any step, fix, or implement new code yourself — always delegate to a Task agent.

**CRITICAL — Context management (prevents degradation on long runs):**

The sprint coordinator can run for many hours across many stories. To prevent context window exhaustion and quality degradation:

1. **Discard Task results immediately.** When a story Task returns, extract ONLY: pass/fail status, one-line summary (e.g., "4 patches applied" or "clean"), and duration. Do NOT retain the full story report, code diffs, or review findings in your context.
2. **Write to disk, not memory.** All details go into the progress file on disk. If you need to reference previous story results, read the progress file — do not rely on your conversation history.
3. **Keep coordinator messages minimal.** Print only the one-line progress update per story. Do not summarize, reflect, or analyze between stories.
4. **Never re-read story reports.** The story pipeline already writes its own report to `{{auto_bmad_artifacts}}/`. The coordinator does not need to read or reprocess them.
5. **Do not accumulate lists.** Track story results as a simple list of `(story_id, status, duration, one_line_summary)` tuples — nothing more.

**Retry policy:** If a story step fails, run `git reset --hard HEAD` to discard its partial changes, then retry **once**. If the retry also fails:
- Log the failure with story ID and reason
- **Skip the failed story and continue with the next one** — do NOT stop the entire sprint
- Record the failure in the final report so the user can address it manually

# Discover Stories

1. Read `{{implementation_artifacts}}/sprint-status.yaml` to get all stories for epic {{EPIC_ID}}.
2. Parse the story list — extract story IDs (e.g., `1-1`, `1-2`, `1-3`, etc.) and their current status.
3. Filter to only stories that are NOT already completed (status is not `done`, `completed`, or `shipped`).
4. Sort by story number ascending (1-1 before 1-2 before 1-3).
5. Set `{{STORY_LIST}}` to the ordered list of pending story IDs.
6. Set `{{TOTAL_STORIES}}` to the count.

If no pending stories found, STOP and tell the user: "All stories in epic {{EPIC_ID}} are already completed."

Report: "Found {{TOTAL_STORIES}} pending stories for epic {{EPIC_ID}}: {{STORY_LIST}}"

# Pre-flight

Before running any steps, record:
- `{{SPRINT_START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output
- `{{SPRINT_START_COMMIT}}` — run `git rev-parse --short HEAD` and store the result

# Pipeline Phases

## Phase 1: Epic Start

Check if epic-level test design already exists for epic {{EPIC_ID}} (scan `{{test_artifacts}}/` for epic-{{EPIC_ID}} test design files).

- **Skip if:** epic test design already exists. Log "Epic test design already exists".
- **Task prompt:** `/auto-bmad-epic-start {{EPIC_ID}}`

Print: `Epic Start — done`

## Phase 2: Stories

For each story ID in {{STORY_LIST}}, in order:

1. Print: `Starting story {{STORY_ID}} ({{CURRENT}}/{{TOTAL_STORIES}})...`
2. Record `{{STORY_START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"`
3. Record `{{STORY_START_COMMIT}}` — run `git rev-parse --short HEAD`
4. Run the story pipeline:
   - **Task prompt:** `/auto-bmad-story {{STORY_ID}}`
5. Record `{{STORY_END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"`
6. Calculate duration
7. Print: `Story {{STORY_ID}} — done ({{DURATION}}m) [{{CURRENT}}/{{TOTAL_STORIES}}]`
8. **Write progress report** — after each story (success or failure), update the progress file (see below)

**On failure after retry:**
- Record the failure reason, which step failed, and the commit hash before the story started
- Print: `Story {{STORY_ID}} — FAILED, skipping to next story`
- Continue with next story

**Between stories:** No manual intervention needed. The Task tool gives each story a fresh context window automatically.

### Progress Report (written after every story)

After each story completes (or fails), write/update `{{auto_bmad_artifacts}}/sprint-epic-{{EPIC_ID}}-progress.md`. This is a **live file** — overwritten after each story so you always have a record even if the sprint crashes.

```markdown
# Sprint Progress: Epic {{EPIC_ID}} (LIVE)

Last updated: {{STORY_END_TIME}}
Sprint started: {{SPRINT_START_TIME}}
Stories completed: {{COMPLETED}} / {{TOTAL_STORIES}}

| # | Story | Status | Duration | Commit Before | Summary |
|---|-------|--------|----------|---------------|---------|
| 1 | 1-1 | done | 62m | abc1234 | Project scaffold |
| 2 | 1-2 | done | 58m | def5678 | Auth system |
| 3 | 1-3 | FAILED | 12m | ghi9012 | Payment integration — ATDD failed: Stripe SDK not installed |
| 4 | 1-4 | pending | - | - | - |
| 5 | 1-5 | pending | - | - | - |

## Failed Stories

- **Story 1-3** (failed at step 4 — ATDD): Stripe SDK not installed, test framework could not resolve import
  - Commit before story: ghi9012
  - Recovery: `git reset --hard ghi9012`, fix the issue, then `/auto-bmad-story 1-3`
```

This ensures that even if the sprint process crashes, the terminal closes, or context runs out — you have a file on disk showing exactly what happened, which stories passed, which failed and why, and the commit hashes needed to recover.

## Phase 3: Epic End

After all stories have been attempted (whether all succeeded or some failed):

- **Task prompt:** `/auto-bmad-epic-end {{EPIC_ID}}`

Print: `Epic End — done`

# Sprint Report

1. Record `{{SPRINT_END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output.
2. Calculate total duration.
3. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
4. Generate the report and save it to `{{auto_bmad_artifacts}}/sprint-epic-{{EPIC_ID}}-YYYY-MM-DD-HHMMSS.md` (using `{{SPRINT_END_TIME}}` for the timestamp).
5. Print the full report to the user.

Use this template for the report:

```markdown
# Sprint Report: Epic {{EPIC_ID}}

| Field | Value |
|-------|-------|
| Pipeline | sprint |
| Epic | {{EPIC_ID}} |
| Start | {{SPRINT_START_TIME}} |
| End | {{SPRINT_END_TIME}} |
| Duration | <hours>h <minutes>m |
| Initial Commit | {{SPRINT_START_COMMIT}} |
| Stories Attempted | {{TOTAL_STORIES}} |
| Stories Completed | <count> |
| Stories Failed | <count> |

## Story Results

| # | Story | Status | Duration | Summary |
|---|-------|--------|----------|---------|
| 1 | {{STORY_ID}} | done/failed | Xm | <one-line summary from story report> |
| 2 | ... | ... | ... | ... |

## Failed Stories

List any stories that failed with the reason. If none, write "None — all stories completed successfully."

For each failed story:
- **Story {{STORY_ID}}**: <failure reason>
- **Recovery**: `git reset --hard <commit-before-story>` to clean up, then run `/auto-bmad-story {{STORY_ID}}` manually

## Sprint Summary

- Total tests written: <sum across all stories>
- Total files created/modified: <sum across all stories>
- Code review passes: <how many reviews came back clean across all stories>

## Key Decisions & Learnings

Summarize notable decisions, issues, and learnings across the entire sprint. Include only items worth remembering — skip routine outcomes. If nothing notable, write "None."

**IMPORTANT: Use dash syntax (e.g. `/auto-bmad-story`) NOT colon syntax (e.g. `/auto-bmad:story`) when suggesting next commands to the user.**

### Next
- Review the sprint report and any failed stories
- If failed stories exist, run them individually: `/auto-bmad-story <story-id>`
- If more epics remain, run `/auto-bmad-sprint <next-epic-number>` for the next epic
- If all epics are done, the project is complete
```

**From this point on, do NOT auto-commit.** Only commit when the user explicitly asks you to.
