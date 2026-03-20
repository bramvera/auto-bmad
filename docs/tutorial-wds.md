# Tutorial: WDS + BMM Combined Pipeline

The WDS (Whiteport Design Studio) pipeline produces deep UX design artifacts -- project briefs, trigger maps, user scenarios, page specs, and design deliveries. You run it before the BMM plan pipeline when your product needs thorough UX work. The BMM plan pipeline detects WDS artifacts and skips its own UX step, so the two pipelines fit together without overlap.

## Prerequisites

### BMAD Modules

Install these modules in your project:

- **BMAD-METHOD v6.2.0** -- the core method ([repo](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.2.0))
- **WDS latest** -- Whiteport Design Studio, provides UX design workflows ([repo](https://github.com/bmad-code-org/bmad-method-wds-expansion))
- **TEA v1.7.1** -- Test Engineering Architect, needed for the BMM pipeline that follows ([repo](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/releases/tag/v1.7.1))

### Config Files

Your project must have these BMAD config files:

- `_bmad/wds/config.yaml` -- WDS configuration (design artifact paths)
- `_bmad/bmm/config.yaml` -- BMM configuration (needed for the plan pipeline)
- `_bmad/tea/config.yaml` -- TEA configuration (needed for the plan pipeline)

### CLI Tools

- `jq` -- required for JSON processing in pipeline steps

### Claude Code Plugins (Optional)

- **context7** -- live documentation lookups
- **security-guidance** -- security recommendations
- Any relevant **lsp** plugin for your codebase

### Claude Code Subscription

A Claude Code Max x5 or x20 subscription is recommended. The combined WDS + BMM flow involves many long-running pipeline steps.

---

## The Combined Flow

The full WDS + BMM lifecycle runs in this order:

1. **WDS** -- deep UX design (project brief, trigger mapping, scenarios, specs, design delivery)
2. **BMM plan** -- PRD, architecture, test framework, epics, sprint plan (UX step is skipped because WDS artifacts exist)
3. **BMM epic-start** -- epic-level test design
4. **BMM story** -- develop each story
5. **BMM epic-end** -- close the epic

This tutorial walks through each stage.

---

## Step-by-Step Walkthrough

### Step 1: Prepare Your Input

You need a detailed product description for the WDS pipeline. This should cover what the product does, who it is for, and what kind of user experience you envision. The pipeline will reject input that is too vague.

Recommended: run `/bmad-brainstorming` and `/bmad-party-mode` sessions first. Save the refined concept to a file.

### Step 2: Run the WDS Pipeline

Start a new Claude Code session and run:

```
/auto-bmad-wds <your product description or @path-to-file>
```

Examples:

```
/auto-bmad-wds A project management dashboard for remote teams with real-time collaboration, timeline views, resource allocation, and automated status reporting.
```

```
/auto-bmad-wds @product-vision.md
```

**What happens (9 steps):**

1. Alignment and signoff -- creates pitch/service agreement (skipped if you are building your own product, not client work)
2. Creates a project brief from your input
3. Trigger mapping -- maps personas, driving forces, and feature priorities
4. Platform requirements -- defines supported platforms and constraints (skipped for simple projects like landing pages)
5. Outlines user scenarios and key journeys
6. Conceptual sketching -- explores flows visually (skipped if scenarios are simple enough to spec directly)
7. Conceptual specifications -- detailed page/section specs
8. Functional components -- identifies reusable design system components (skipped if not applicable)
9. Design delivery -- packages designs with acceptance criteria

The pipeline skips steps when artifacts already exist or when they do not apply.

**Duration:** 30-60+ minutes.

**What to check after:** Review the artifacts in your `design-artifacts/` directory (path may vary based on your WDS config). Focus on:

- `A-Product-Brief/project-brief.md` -- does it capture your product vision?
- `B-Trigger-Map/trigger-map.md` -- are the personas and priorities accurate?
- `C-UX-Scenarios/scenario-overview.md` -- do the user journeys cover the right flows?
- `C-UX-Scenarios/page-specs/` or `scenario-specs/` -- are the specs detailed enough?
- `E-PRD/Design-Deliveries/` -- are the delivery packages complete?

Iterate using `/bmad-party-mode` if anything needs refinement. The design artifacts set the foundation for everything that follows, so get them right before proceeding.

### Step 3: Run the BMM Plan Pipeline

Start a **new Claude Code session** and run:

```
/auto-bmad-plan <your product description or @path-to-file>
```

Use the same input you provided to WDS, or a refined version of it.

**What happens (11 steps, but UX is skipped):**

The plan pipeline detects that WDS design artifacts already exist (`ux-design-specification.md` or similar) and skips its own UX design step (step 4). All other steps run normally:

1. Product brief
2. PRD
3. PRD validation
4. **UX design -- SKIPPED** (WDS artifacts found)
5. Architecture
6. Test framework setup
7. System-level test design
8. Epics and stories
9. Implementation readiness check
10. Project context
11. Sprint planning

This is the key benefit of the combined flow: the WDS pipeline produces much richer UX artifacts than the plan pipeline's built-in UX step. The plan pipeline respects this by skipping its own UX work.

**What to check after:** Same as the standard BMM plan. Review the PRD, architecture, epics, and sprint plan. Verify that the architecture and epics align with the UX design from WDS.

### Step 4: Start the First Epic

Start a **new Claude Code session** and run:

```
/auto-bmad-epic-start 1
```

**What happens:** Creates epic-level test design (1 step). From this point forward, the workflow is identical to the standard BMM pipeline.

**What to check after:** Review the test design. Verify it covers the right scenarios for this epic.

### Step 5: Develop Stories

Start a **new Claude Code session for each story** and run:

```
/auto-bmad-story 1-1
```

The story ID is `<epic>-<story>`. This is a separator, not a range. `1-3` means epic 1, story 3.

**What happens (11 steps):** Creates, validates, reviews, develops, and tests the story. See the BMM tutorial for full details on what each step does.

**Duration:** 60+ minutes per story.

**What to check after:** Review the pipeline report, check action items, do manual testing of the feature. Verify that the implementation matches the UX specs from WDS.

Repeat for each story in the epic.

### Step 6: Close the Epic

After all stories in the epic are done, start a **new session** and run:

```
/auto-bmad-epic-end 1
```

**What happens (5 steps):** Traceability check, NFR assessment, test review, retrospective, and project context refresh.

**What to check after:** Review retrospective findings, deferred items, and technical debt.

### Step 7: Continue with Remaining Epics

Repeat Steps 4-6 for each epic until the project is complete.

---

## When to Use WDS vs. Plain BMM

Use the **combined WDS + BMM flow** when:

- Your product has significant UI/UX complexity
- You need detailed page specs and user journey mapping
- You want trigger-based design (mapping user motivations to features)
- You are doing client work and need design deliverables

Use **plain BMM** (without WDS) when:

- Your product is backend-only or API-only (no frontend)
- The UI is simple enough that the plan pipeline's built-in UX step is sufficient
- You want to move faster and skip the deep design phase

---

## Common Issues and Tips

**WDS artifacts not detected by plan pipeline.** The plan pipeline looks for `ux-design-specification.md` or `ux-design-specification/` in the planning artifacts folder. If WDS stores artifacts elsewhere and the plan pipeline does not find them, it will run its own UX step. Check that your WDS and BMM configs point to compatible output paths.

**Pipeline fails mid-run.** Roll back with `git reset --hard <commit-hash>` (printed in the report). Each pipeline (WDS, plan, epic-start, story, epic-end) tracks its own start commit for rollback.

**Permission prompts.** Expect several approval prompts during the first few runs, especially since WDS and BMM use different sets of BMAD slash commands.

**Always use fresh sessions.** One pipeline command per Claude Code session. The WDS pipeline, BMM plan pipeline, each story, and each epic start/end should each get their own session.

**Review design artifacts before moving on.** The WDS artifacts feed into everything downstream. If the trigger map or page specs have problems, those problems cascade through the PRD, architecture, epics, and stories.

**Alignment step is for client work.** The first WDS step (alignment and signoff) is skipped automatically if you are building your own product. It creates pitch decks and service agreements for client engagements.

---

## Quick Reference

All commands in order for a full WDS + BMM lifecycle:

```
# 1. WDS design (once per project, provide product input)
/auto-bmad-wds <description or @file>

# 2. BMM plan (once per project, same or refined input)
/auto-bmad-plan <description or @file>

# 3. Start epic (once per epic)
/auto-bmad-epic-start <epic-number>

# 4. Develop stories (once per story, new session each time)
/auto-bmad-story <epic>-<story>

# 5. Close epic (once per epic, after all stories done)
/auto-bmad-epic-end <epic-number>

# Repeat steps 3-5 for each epic
```

Example for a project with 2 epics, 2 stories each:

```
/auto-bmad-wds @product-vision.md

/auto-bmad-plan @product-vision.md

/auto-bmad-epic-start 1
/auto-bmad-story 1-1
/auto-bmad-story 1-2
/auto-bmad-epic-end 1

/auto-bmad-epic-start 2
/auto-bmad-story 2-1
/auto-bmad-story 2-2
/auto-bmad-epic-end 2
```

Each line above should be run in its own Claude Code session.
