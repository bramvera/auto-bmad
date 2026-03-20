# Tutorial: BMM Pipeline (Business Model Method)

The BMM pipeline takes a product idea through the full BMAD lifecycle -- from planning artifacts (PRD, architecture, UX, epics) through story-by-story implementation with automated testing, code reviews, and traceability.

## Prerequisites

### BMAD Modules

Install these modules in your project before running any BMM commands:

- **BMAD-METHOD v6.2.0** -- the core method ([repo](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.2.0))
- **TEA v1.7.1** -- Test Engineering Architect, provides test strategy and ATDD ([repo](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/releases/tag/v1.7.1))

Optional but helpful:

- **CIS** (Creative Intelligence Suite) -- improves UX design quality during the plan pipeline

### Config Files

Your project must have these BMAD config files (created by the BMAD CLI during project init):

- `_bmad/bmm/config.yaml` -- BMM configuration (output folders, artifact paths)
- `_bmad/tea/config.yaml` -- TEA configuration (test artifact paths)

### CLI Tools

- `jq` -- required for JSON processing in pipeline steps

### Claude Code Plugins (Optional)

- **context7** -- live documentation lookups during architecture and story development
- **security-guidance** -- security recommendations during development
- Any relevant **lsp** plugin for your codebase (improves lint/test feedback)

### Claude Code Subscription

The pipelines are long-running and token-heavy. A Claude Code Max x5 or x20 subscription is recommended to avoid hitting limits mid-run.

---

## Step-by-Step Walkthrough

### Step 1: Prepare Your Input

Before running the plan pipeline, you need a strong, detailed product description. A one-liner like "Create a todo app" will be rejected. The pipeline validates that your input has enough substance to build a real plan from.

Recommended approach: run a few `/bmad-brainstorming` and `/bmad-party-mode` sessions first to flesh out your idea. Save the output to a file you can reference later.

### Step 2: Run the Plan Pipeline

Start a new Claude Code session and run:

```
/auto-bmad-plan <your product description or @path-to-file>
```

You can provide your input inline or reference a file. Examples:

```
/auto-bmad-plan A SaaS platform for managing freelance contracts with invoicing, time tracking, and client portals.
```

```
/auto-bmad-plan @rough-idea.md
```

**What happens (11 steps):**

1. Creates a product brief from your input
2. Generates a PRD (Product Requirements Document)
3. Validates and fixes the PRD
4. Creates UX design specifications (skipped if no frontend)
5. Creates architecture documentation
6. Sets up the test framework (Playwright, Vitest, etc.)
7. Creates system-level test design
8. Generates epics and stories
9. Checks implementation readiness and fixes issues
10. Generates project context
11. Creates sprint plan

The pipeline skips steps when artifacts already exist. If you re-run it after a partial failure, it picks up where it left off.

**Duration:** This can take 30-60+ minutes depending on project complexity.

**What to check after:** Review the generated artifacts in your `_bmad-output/planning-artifacts/` directory. Pay attention to:

- The PRD -- does it capture your vision correctly?
- The architecture -- is the tech stack appropriate?
- The epics -- are they scoped correctly?
- The sprint plan -- is the first sprint achievable?

Use `/bmad-party-mode` to iterate on any artifacts that need refinement before moving on.

### Step 3: Start the First Epic

Start a **new Claude Code session** (fresh context is important) and run:

```
/auto-bmad-epic-start 1
```

Replace `1` with whatever epic number you want to start.

**What happens (1 step):**

1. Creates epic-level test design -- plans which tests need to be written for this epic's stories, following the test pyramid (unit > integration > E2E)

**What to check after:** Review the test design artifact. Make sure the test strategy makes sense for the epic's scope. Confirm that E2E tests are limited to critical happy-path flows.

### Step 4: Develop Stories

Start a **new Claude Code session for each story** and run:

```
/auto-bmad-story 1-1
```

The story ID is two numbers separated by a dash: `<epic>-<story>`. So `1-1` means epic 1, story 1. `2-3` means epic 2, story 3. This is NOT a range -- `1-7` means epic 1, story 7, not stories 1 through 7.

You can also use dots or spaces as separators: `1.1` or `1 1`.

**What happens (11 steps):**

1. Creates the story file
2. Validates the story specification
3. Runs an adversarial review of the story spec and fixes issues
4. Generates ATDD acceptance tests (test-first, red phase only)
5. Develops the story implementation (makes tests pass)
6. Hunts for edge cases and adds guards
7. Code review #1 -- fixes critical, high, and medium issues
8. Code review #2 -- second pass
9. Code review #3 -- final pass
10. Traces the story for traceability
11. Automates remaining tests

**Duration:** This is the longest pipeline -- it can run for 60+ minutes per story.

**What to check after:** Review the pipeline report that gets printed at the end. Look at:

- Action items flagged for human attention
- The story file in `_bmad-output/implementation-artifacts/`
- Any code changes -- do a quick manual test of the feature
- Test results -- are all tests passing?

Then repeat for the next story:

```
/auto-bmad-story 1-2
```

### Step 5: Close the Epic

After all stories in an epic are done, start a **new Claude Code session** and run:

```
/auto-bmad-epic-end 1
```

**What happens (5 steps):**

1. Runs epic-level traceability check
2. Runs NFR (non-functional requirements) assessment
3. Reviews all tests for the epic (including test pyramid compliance)
4. Conducts a retrospective and fixes implementable action items
5. Refreshes the project context

**What to check after:** Review the retrospective findings. Look for:

- Deferred action items that need human decision
- Technical debt patterns
- Process improvements for the next epic

### Step 6: Repeat for Next Epic

If more epics remain, go back to Step 3 with the next epic number:

```
/auto-bmad-epic-start 2
```

Then stories (`/auto-bmad-story 2-1`, `2-2`, ...), then epic-end (`/auto-bmad-epic-end 2`).

---

## Common Issues and Tips

**Pipeline fails mid-run.** The report tells you which step failed. You can roll back the entire pipeline with `git reset --hard <commit-hash>` (the hash is printed in the report), or roll back just the failed step with `git reset --hard HEAD` and retry.

**"Plan pipeline requires product context."** You ran `/auto-bmad-plan` without providing input. Add a product description or file reference after the command.

**Artifacts already exist.** The pipeline skips steps when it finds existing artifacts. This is intentional -- it lets you re-run after partial failures. If you want to regenerate an artifact, delete it first.

**Permission prompts.** The first few runs will prompt you to approve various bash commands and tools. These approvals accumulate and subsequent runs will be more autonomous.

**Token limits hit.** If a pipeline run gets cut off, start a new session and re-run the same command. It will pick up from where it left off thanks to artifact scanning.

**Always use fresh sessions.** Start a new Claude Code session for each pipeline command. The pipelines are context-heavy, and a fresh window gives each step the space it needs.

**One story per session.** Never try to run multiple stories in a single session. Each `/auto-bmad-story` call should be its own session.

---

## Quick Reference

All commands in order for a full BMM lifecycle:

```
# 1. Plan (once per project, provide product input)
/auto-bmad-plan <description or @file>

# 2. Start epic (once per epic)
/auto-bmad-epic-start <epic-number>

# 3. Develop stories (once per story, new session each time)
/auto-bmad-story <epic>-<story>

# 4. Close epic (once per epic, after all stories done)
/auto-bmad-epic-end <epic-number>

# Repeat steps 2-4 for each epic
```

Example for a project with 2 epics, 3 stories each:

```
/auto-bmad-plan @my-product-idea.md

/auto-bmad-epic-start 1
/auto-bmad-story 1-1
/auto-bmad-story 1-2
/auto-bmad-story 1-3
/auto-bmad-epic-end 1

/auto-bmad-epic-start 2
/auto-bmad-story 2-1
/auto-bmad-story 2-2
/auto-bmad-story 2-3
/auto-bmad-epic-end 2
```

Each line above should be run in its own Claude Code session.
