---
name: 'auto-bmad-story-quick'
description: 'Quick mode: develop a BMAD story in 3 steps — create, develop, code review (no TEA required)'
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

**NOTE:** This is quick mode. Do NOT read `_bmad/tea/config.yaml`. TEA is not required.

# Load Project Context

Read `{{output_folder}}/project-context.md` if it exists. This gives you general context about the project — its purpose, stack, conventions, and current state. Use this context to make informed decisions throughout the pipeline.

# Detect Story ID

A story ID is composed by exactly 2 numbers: the epic number and the story number within that epic, separated by a dash, a dot, or a space. For example, "1-1" would be the first story in the first epic, "2-3" would be the third story in the second epic, and so on. A story ID can also be inferred from the path name if a path is provided when launching the workflow (e.g., `{{implementation_artifacts}}/1-2-authentication-system.yaml` would set the story ID to "1-2").

**IMPORTANT**: The dash (or dot/space) in a story ID is a SEPARATOR, not a range. `1-7` (or `1.7` or `1 7`) means "epic 1, story 7" — it does NOT mean "stories 1 through 7". This pipeline processes exactly ONE story per run. Never interpret a story ID as a range of stories.

IF user provides epic-story number (e.g. 1-1, 1-2, 2.1, 2.2, etc.) or a file path containing an epic-story pattern:
THEN set {{STORY_ID}} to the provided epic-story number (always a single story).
ELSE ask to provide a epic-story number to identify the story to work on and set {{STORY_ID}} to the provided value.

Set {{EPIC_ID}} and {{STORY_NUM}} by splitting {{STORY_ID}} on the dash/dot/space separator.

# Story Pipeline (Quick Mode — 3 Steps)

Run the BMAD story pipeline for story {{STORY_ID}} as a minimal sequence of BMAD slash commands — lightweight orchestration with git safety.

Each step MUST run in its own **foreground Task tool call** (subagent_type: "general-purpose") so that each agent gets a fresh context window.

**CRITICAL — Tool usage rules:**
- **DO** use the Task tool (foreground, default mode) for each step. It blocks and returns the result.
- **DO NOT** use TeamCreate, SendMessage, TaskOutput, TaskCreate, or TaskList. This is a sequential pipeline, not a team collaboration.
- **DO NOT** launch multiple Task calls simultaneously. Wait for each to return before launching the next.
- **DO NOT** execute any step, fix, or implement new code yourself — always delegate to a Task agent.

**Retry policy:** If a step fails, run `git reset --hard HEAD` to discard its partial changes, then retry **once**. If the retry also fails, stop the pipeline and tell the user:
- Which step failed and why
- Recovery commands: `git reset --hard {{START_COMMIT_HASH}}` to roll back the entire pipeline, or `git reset --hard HEAD` to retry the failed step.

## Pre-flight

Record before running any steps:
- `{{START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output
- `{{START_COMMIT_HASH}}` — run `git rev-parse --short HEAD` and store the result

## Story File Path Resolution

After step 1 (Create) succeeds, glob `{{implementation_artifacts}}/{{STORY_ID}}-*.md` to find the story file and set {{STORY_FILE}} to its path. If the story file already existed (step 1 was skipped), set {{STORY_FILE}} the same way. All subsequent steps use {{STORY_FILE}}.

# Pipeline Steps

After each successful step, the coordinator runs `git add -A && git commit --no-verify -m "wip({{STORY_ID}}): step N/3 <step-name> - done"` and prints a 1-line progress update: `Step N/3: <step-name> — <status>`. The coordinator must also track a running list of `(step_name, status, start_time, end_time)` — note the wall-clock time before and after each Task call to use in the final report.

## Step 1: Create Story

- **Skip if:** a story file for {{STORY_ID}} already exists in `{{implementation_artifacts}}/` (glob for `{{STORY_ID}}-*.md`). Log "Story file already exists" with the file path. Set `{{STORY_FILE}}` to the existing file path.
- **Task prompt:** `/bmad-create-story story {{STORY_ID}} yolo`

## Step 2: Develop

- **Task prompt:** `/bmad-dev-story {{STORY_FILE}} ultrathink yolo`

## Step 3: Code Review

- **Task prompt:** `/bmad-code-review {{STORY_FILE}} ultrathink yolo — fix all critical, high, and medium issues. For low issues, fix if they have concrete evidence (file:line), do not fix style preferences or hypothetical concerns as low findings.`

# Story File Update

After step 3 is complete, the coordinator MUST:

1. **Mark all tasks as done.** Read `{{STORY_FILE}}` and replace every unchecked task checkbox (`- [ ]`) with a checked one (`- [x]`). All tasks were implemented — the dev step built the code, the reviews confirmed it. Do not leave unchecked boxes in a completed story.
2. **Check completeness.** Verify the story file contains the review findings and fixes, and that anything after `## Dev Agent Record` is not empty or placeholder text.
3. **Fill gaps.** If something is missing, update the story file with that information.

# Status Update

Before generating the report, the coordinator MUST check and update the story status:

1. Read `{{STORY_FILE}}` — if the story status is not updated to reflect completion of all pipeline steps, update it accordingly.
2. Read `{{implementation_artifacts}}/sprint-status.yaml` — if the story's status is not updated to reflect completion, update it accordingly.
3. Run `git add -A && git commit --no-verify -m "wip({{STORY_ID}}): update story and sprint status"` to checkpoint the status updates.

# Pipeline Report

1. Record `{{END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output.
2. Scan `{{output_folder}}/` recursively for files modified after `{{START_TIME}}` to build the artifact list.
3. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
4. Generate the report and save it to `{{auto_bmad_artifacts}}/epic-{{EPIC_ID}}-story-{{STORY_NUM}}-YYYY-MM-DD-HHMMSS.md` (using `{{END_TIME}}` for the timestamp).
5. Print the full report to the user.

Run the token cost report: `python3 "$(find ~/.claude/plugins/cache/bramvera-plugins/auto-bmad -name token-report.py | sort | tail -1)" .` — saves accurate billing breakdown to `{{auto_bmad_artifacts}}/`. Use the `Cost: $X.XX standard` line for the Est. Cost row.

Use this template for the report:

```markdown
# Pipeline Report: epic {{EPIC_ID}} story {{STORY_NUM}} (quick mode)

| Field | Value |
|-------|-------|
| Pipeline | story-quick |
| Story | {{STORY_ID}} |
| Start | {{START_TIME}} |
| End | {{END_TIME}} |
| Duration | <minutes>m |
| Est. Cost | ~$X.XX (see token-report-*.md) |
| Initial Commit | {{START_COMMIT_HASH}} |

## Artifacts

- `<relative-path>` — new/updated

## Pipeline Outcome

| # | Step | Status | Duration | Summary |
|---|------|--------|----------|---------|
| 1 | Story Create | done/skipped | Xm | <story title/scope> |
| 2 | Develop | done | Xm | <files created/modified, key implementation summary> |
| 3 | Code Review | done | Xm | <issues found/fixed count by severity> |

## Key Decisions & Learnings

Summarize notable decisions, issues, and learnings from the pipeline run. Include only items worth remembering — skip routine outcomes. If nothing notable, write "None."

## Action Items

Report only items that genuinely require human action. If the pipeline completed cleanly with no concerns, write "None — pipeline completed without issues requiring human attention."

**IMPORTANT: Use dash syntax (e.g. `/auto-bmad-story-quick`) NOT colon syntax (e.g. `/auto-bmad:story-quick`) when suggesting next commands to the user.**

### Next
- Start a new session with fresh context, then run `/auto-bmad-story-quick <next-story>` for the next story in the sprint
- After all stories in the epic are done, run Quinn QA manually: `/bmad-qa-generate-e2e-tests yolo` and then `/bmad-retrospective epic <epic-number> ultrathink yolo`
- Or use `/auto-bmad-sprint-quick <epic-number>` to run all stories + epic-end hands-off
```

# Final Commit

1. `git reset --soft {{START_COMMIT_HASH}}` — squash all checkpoint commits, keep changes staged.
2. Read {{STORY_FILE}} to determine the story type and what was built, then commit:

```
git add -A && git commit -m "<type>({{STORY_ID}}): <one-line summary>

<2-5 line summary or list of what was implemented>"
```

Derive `<type>` from the story using this table (default to `feat` if ambiguous):

| Type | When to use |
|------|------------|
| `feat` | New user-facing feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `chore` | Dependencies, configs, tooling, maintenance |
| `docs` | Documentation only |
| `test` | Tests only, no production code |
| `style` | Formatting, whitespace, no logic change |
| `ci` | CI/CD pipeline changes |
| `build` | Build system or external dependency changes |

The one-line summary should describe the user-facing outcome, not "story complete".

**From this point on, do NOT auto-commit.** Only commit when the user explicitly asks you to.
