---
name: 'auto-bmad-wds'
description: 'Run the WDS design pipeline: project brief, trigger mapping, scenarios, specs, and design delivery'
---

# Load Configuration

Read `_bmad/wds/config.yaml` and set the following variables (resolve `{project-root}` to the actual project root path):

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | wds `output_folder` | `_bmad-output` |
| `{{design_artifacts}}` | wds `design_artifacts` | `design-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

All paths in this command that reference WDS output directories MUST use these variables — never hardcode paths.

# Load Project Context

Read `{{output_folder}}/project-context.md` if it exists. This gives you general context about the project — its purpose, stack, conventions, and current state. Use this context to make informed decisions throughout the pipeline.

# WDS Design Pipeline

Run the WDS design lifecycle as a minimal sequence of BMAD slash commands — lightweight orchestration with git safety.

Each step MUST run in its own **foreground Task tool call** (subagent_type: "general-purpose") so that each agent gets a fresh context window.

## User Input

The user MUST provide input alongside the command — a product idea, a description, a file path, or any context about what they want to design. Capture everything the user provides as {{USER_INPUT}}.

- If the input references a file (e.g., `@rough-idea.md`, a path), **read the file contents** and include them verbatim as part of {{USER_INPUT}}.
- **If no input is provided, STOP.** Tell the user that the WDS pipeline requires product context.

**CRITICAL — Tool usage rules:**
- **DO** use the Task tool (foreground, default mode) for each step. It blocks and returns the result.
- **DO NOT** use TeamCreate, SendMessage, TaskOutput, TaskCreate, or TaskList. This is a sequential pipeline, not a team collaboration.
- **DO NOT** launch multiple Task calls simultaneously. Wait for each to return before launching the next.
- **DO NOT** execute any step, fix, or implement new code yourself — always delegate to a Task agent.

**Retry policy:** If a step fails, run `git reset --hard HEAD` to discard its partial changes, then retry **once**. If the retry also fails, stop the pipeline and tell the user:
- Which step failed and why
- Recovery commands: `git reset --hard {{START_COMMIT_HASH}}` to roll back the entire pipeline, or `git reset --hard HEAD` to retry the failed step.

## Artifact Scan

Before running, scan for existing artifacts to determine which steps to skip:

1. Scan `{{design_artifacts}}/A-Product-Brief/` for:
   - `project-brief.md` — project brief exists
   - `pitch*` or `service-agreement*` or `signoff*` — alignment & signoff exists
   - `platform-requirements.md` — platform requirements exist
2. Scan `{{design_artifacts}}/B-Trigger-Map/` for:
   - `trigger-map.md` — trigger mapping exists
3. Scan `{{design_artifacts}}/C-UX-Scenarios/` for:
   - `scenario-overview.md` — scenarios exist
   - `page-specs/` or `scenario-specs/` — conceptual specs exist
4. Scan `{{design_artifacts}}/D-Design-System/` for:
   - `components/` or `design-tokens.md` — design system exists
5. Scan `{{design_artifacts}}/E-PRD/Design-Deliveries/` for:
   - `*.yaml` or `*.yml` — design delivery exists

Report which artifacts already exist and which steps will be skipped.

Set `{{USER_INPUT_INSTRUCTION}}` to: `The user provided the following vision for this product — treat it as the primary input and build the project brief around it:\n\n{{USER_INPUT}}`

# Pre-flight

Before running any steps, record:
- `{{START_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output
- `{{START_COMMIT_HASH}}` — run `git rev-parse --short HEAD` and store the result

# Pipeline Steps

After each successful step, the coordinator runs `git add -A && git commit --no-verify -m "wip(wds): step N/9 <step-name> - done"` and prints a 1-line progress update: `Step N/9: <step-name> — <status>`. The coordinator must also track a running list of `(step_name, status, start_time, end_time)` — note the wall-clock time before and after each Task call to use in the final report.

## Phase 0: Alignment (Optional)

1. **Alignment & Signoff**
   - **Skip if:** alignment artifacts already exist, OR the user is building their own product (not client work). Log reason.
   - **Task prompt:** `/bmad-wds-alignment yolo — {{USER_INPUT_INSTRUCTION}}`

## Phase 1: Strategy

2. **Project Brief**
   - **Skip if:** project brief already exists. Log "Project brief already exists".
   - **Task prompt:** `/bmad-wds-project-brief yolo — {{USER_INPUT_INSTRUCTION}}`

3. **Trigger Mapping**
   - **Skip if:** trigger map already exists. Log "Trigger map already exists".
   - **Task prompt:** `/bmad-wds-trigger-mapping ultrathink yolo`

4. **Platform Requirements**
   - **Skip if:** platform requirements already exist. Also skip if the project is simple (landing page, basic website). Log reason.
   - **Task prompt:** `/bmad-wds-platform-requirements yolo`

## Phase 2: Design

5. **Outline Scenarios**
   - **Skip if:** scenario overview already exists. Log "Scenarios already exist".
   - **Task prompt:** `/bmad-wds-outline-scenarios ultrathink yolo`

6. **Conceptual Sketching**
   - **Skip if:** sketches already exist. Also skip if scenarios are simple enough to spec directly. Log reason.
   - **Task prompt:** `/bmad-wds-conceptual-sketching yolo`

7. **Conceptual Specifications**
   - **Skip if:** page specs or scenario specs already exist. Log "Conceptual specs already exist".
   - **Task prompt:** `/bmad-wds-conceptual-specs ultrathink yolo`

8. **Functional Components**
   - **Skip if:** design system mode is "none" in WDS config, OR no reusable patterns detected. Log reason.
   - **Task prompt:** `/bmad-wds-functional-components yolo`

9. **Design Delivery**
   - **Skip if:** design delivery YAML files already exist. Log "Design delivery already exists".
   - **Task prompt:** `/bmad-wds-design-delivery ultrathink yolo`

# Pipeline Report

1. Record `{{END_TIME}}` — run `date -u +"%Y-%m-%dT%H:%M:%S"` via Bash and store the output.
2. Scan `{{design_artifacts}}/` recursively for files modified after `{{START_TIME}}` to build the artifact list.
3. Create `{{auto_bmad_artifacts}}/` directory if it doesn't exist.
4. Generate the report and save it to `{{auto_bmad_artifacts}}/wds-report-YYYY-MM-DD-HHMMSS.md` (using `{{END_TIME}}` for the timestamp).
5. Print the full report to the user.

Use this template for the report:

```markdown
# Pipeline Report: wds

| Field | Value |
|-------|-------|
| Pipeline | wds |
| Start | {{START_TIME}} |
| End | {{END_TIME}} |
| Duration | <minutes>m |
| Initial Commit | {{START_COMMIT_HASH}} |

## Artifacts

- `<relative-path>` — new/updated

## Pipeline Outcome

| # | Step | Status | Duration | Summary |
|---|------|--------|----------|---------|
| 1 | Alignment & Signoff | done/skipped | Xm | <pitch/signoff created, or why skipped> |
| 2 | Project Brief | done/skipped | Xm | <product vision captured, key positioning> |
| 3 | Trigger Mapping | done/skipped | Xm | <personas count, driving forces mapped, features scored> |
| 4 | Platform Requirements | done/skipped | Xm | <platforms defined, or why skipped> |
| 5 | Outline Scenarios | done/skipped | Xm | <scenario count, key user journeys identified> |
| 6 | Conceptual Sketching | done/skipped | Xm | <flows explored, or why skipped> |
| 7 | Conceptual Specs | done/skipped | Xm | <pages/sections specified, detail level> |
| 8 | Functional Components | done/skipped | Xm | <reusable components identified, or why skipped> |
| 9 | Design Delivery | done/skipped | Xm | <delivery packages validated, acceptance criteria count> |

## Key Decisions & Learnings

Summarize notable decisions, issues, and learnings from the pipeline run. Include only items worth remembering — skip routine outcomes. If nothing notable, write "None."

## Action Items

Report only items that genuinely require human action based on what happened during this pipeline run. If the pipeline completed cleanly with no concerns, write "None — pipeline completed without issues requiring human attention."

For each item, prefix with one of:
- **[Review]** — a design decision that needs human judgement (e.g., persona accuracy, trigger mapping assumptions, scenario completeness)
- **[Verify]** — something the pipeline couldn't validate (e.g., brand alignment, visual feel, competitive differentiation accuracy)
- **[Attention]** — a risk or gap flagged during design (e.g., missing user journey, accessibility concern, unclear success criteria)

Do NOT include items the pipeline already handled successfully. Do NOT fabricate items to fill a quota.

### Next
- Review the design artifacts in `{{design_artifacts}}/` — especially the trigger map and conceptual specs
- Run `/auto-bmad-plan` to continue with PRD, architecture, epics, and sprint setup (the UX step will be skipped since WDS artifacts exist)
- Then follow the standard flow: `/auto-bmad-epic-start`, `/auto-bmad-story`, `/auto-bmad-epic-end`
```

# Final Commit

1. `git reset --soft {{START_COMMIT_HASH}}` — squash all checkpoint commits, keep changes staged.
2. Commit with: `git add -A && git commit -m "chore: WDS design pipeline complete"`
3. Record the final git commit hash and print it to the user.

**From this point on, do NOT auto-commit.** Only commit when the user explicitly asks you to.
