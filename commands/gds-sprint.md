---
name: 'auto-gds-sprint'
description: 'Run all GDS stories in an epic autonomously: epic-start, all stories, epic-end — fully hands-off'
---

# Load Configuration

Read `_bmad/gds/config.yaml` and set the following variables (resolve `{project-root}` to the actual project root path):

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | gds `output_folder` | `_bmad-output` |
| `{{planning_artifacts}}` | gds `planning_artifacts` | `_bmad-output/planning-artifacts` |
| `{{implementation_artifacts}}` | gds `implementation_artifacts` | `_bmad-output/implementation-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

All paths in this command that reference GDS output directories MUST use these variables — never hardcode `_bmad-output` paths.

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

Check if epic-level test design already exists for epic {{EPIC_ID}} (scan test artifacts for epic-{{EPIC_ID}} test design files).

- **Skip if:** epic test design already exists. Log "Epic test design already exists".
- **Task prompt:** `/auto-gds-epic-start {{EPIC_ID}}`

Print: `Epic Start — done`

## Phase 2: Stories

For each story ID in {{STORY_LIST}}, in order:

1. Print: `Starting story {{STORY_ID}} ({{CURRENT}}/{{TOTAL_STORIES}})...`
2. Record `{{STORY_START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"`
3. Run the story pipeline:
   - **Task prompt:** `/auto-gds-story {{STORY_ID}}`
4. Record `{{STORY_END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"`
5. Calculate duration
6. Print: `Story {{STORY_ID}} — done ({{DURATION}}m) [{{CURRENT}}/{{TOTAL_STORIES}}]`

**On failure after retry:**
- Print: `Story {{STORY_ID}} — FAILED, skipping to next story`
- Record failure in results list
- Continue with next story

**Between stories:** No manual intervention needed. The Task tool gives each story a fresh context window automatically.

## Phase 3: Epic End

After all stories have been attempted (whether all succeeded or some failed):

- **Task prompt:** `/auto-gds-epic-end {{EPIC_ID}}`

Print: `Epic End — done`

# Sprint Report

1. Record `{{SPRINT_END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output.
2. Calculate total duration.
3. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
4. Generate the report and save it to `{{auto_bmad_artifacts}}/gds-sprint-epic-{{EPIC_ID}}-YYYY-MM-DD-HHMMSS.md` (using `{{SPRINT_END_TIME}}` for the timestamp).
5. Print the full report to the user.

Use this template for the report:

```markdown
# Sprint Report: GDS Epic {{EPIC_ID}}

| Field | Value |
|-------|-------|
| Pipeline | gds-sprint |
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
- **Recovery**: `git reset --hard <commit-before-story>` to clean up, then run `/auto-gds-story {{STORY_ID}}` manually

## Sprint Summary

- Total tests written: <sum across all stories>
- Total files created/modified: <sum across all stories>
- Code review passes: <how many reviews came back clean across all stories>

## Key Decisions & Learnings

Summarize notable decisions, issues, and learnings across the entire sprint. Include only items worth remembering — skip routine outcomes. If nothing notable, write "None."

**IMPORTANT: Use dash syntax (e.g. `/auto-gds-story`) NOT colon syntax (e.g. `/auto-gds:story`) when suggesting next commands to the user.**

### Next
- Review the sprint report and any failed stories
- If failed stories exist, run them individually: `/auto-gds-story <story-id>`
- If more epics remain, run `/auto-gds-sprint <next-epic-number>` for the next epic
- If all epics are done, the project is complete
```

**From this point on, do NOT auto-commit.** Only commit when the user explicitly asks you to.
