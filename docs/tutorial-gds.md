# Tutorial: GDS Pipeline (Game Dev Suite)

The GDS pipeline takes a game idea through the BMAD lifecycle tailored for game development -- from game design document and narrative through story-by-story implementation with game-specific testing, performance assessment, and code reviews.

## Prerequisites

### BMAD Modules

Install these modules in your project before running any GDS commands:

- **BMAD-METHOD v6.2.0** -- the core method ([repo](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.2.0))
- **GDS v0.2.2** -- Game Dev Suite, provides game design, architecture, narrative, and testing ([repo](https://github.com/bmad-code-org/bmad-module-game-dev-studio/releases/tag/v0.2.2))

### Config Files

Your project must have this BMAD config file (created by the BMAD CLI during project init):

- `_bmad/gds/config.yaml` -- GDS configuration (output folders, artifact paths)

### CLI Tools

- `jq` -- required for JSON processing in pipeline steps

### Claude Code Plugins (Optional)

- **context7** -- live documentation lookups during architecture and story development
- **security-guidance** -- security recommendations during development
- Any relevant **lsp** plugin for your codebase

### Claude Code Subscription

The pipelines are long-running and token-heavy. A Claude Code Max x5 or x20 subscription is recommended to avoid hitting limits mid-run.

---

## Step-by-Step Walkthrough

### Step 1: Prepare Your Input

Before running the plan pipeline, you need a detailed game concept. The pipeline validates that your input has enough substance to work with -- a vague sentence will be rejected.

Recommended approach: run a few `/bmad-brainstorming` and `/bmad-party-mode` sessions first to develop your game concept, core mechanics, target audience, and platform targets. Save the output to a file.

### Step 2: Run the GDS Plan Pipeline

Start a new Claude Code session and run:

```
/auto-gds-plan <your game description or @path-to-file>
```

Examples:

```
/auto-gds-plan A roguelike deckbuilder where players explore procedurally generated dungeons using card-based combat with over 200 unique cards and 5 character classes.
```

```
/auto-gds-plan @game-concept.md
```

**What happens (8 steps):**

1. Creates a game brief from your input
2. Generates a GDD (Game Design Document)
3. Creates narrative design (skipped if the game has no narrative, e.g., abstract puzzle games)
4. Creates game architecture documentation
5. Sets up the test framework
6. Creates system-level game test design (gameplay loops, state management, performance)
7. Generates project context
8. Creates sprint plan

The pipeline skips steps when artifacts already exist.

**Duration:** 30-60+ minutes depending on game complexity.

**What to check after:** Review the artifacts in `_bmad-output/planning-artifacts/`. Focus on:

- The GDD -- does it capture your core mechanics and vision?
- The narrative design -- does the story/lore match your intent?
- The game architecture -- is the engine/stack choice right?
- The sprint plan -- is the first sprint scoped correctly?

Use `/bmad-party-mode` to refine any artifacts before continuing.

### Step 3: Start the First Epic

Start a **new Claude Code session** and run:

```
/auto-gds-epic-start 1
```

**What happens (1 step):**

1. Creates epic-level game test design -- plans tests specific to this epic's game systems, interactions, and scenarios

**What to check after:** Review the test design. Verify it covers the right game-specific scenarios for this epic (core loops, state transitions, system interactions).

### Step 4: Develop Stories

Start a **new Claude Code session for each story** and run:

```
/auto-gds-story 1-1
```

The story ID format works the same as BMM: `<epic>-<story>`. `1-1` is epic 1, story 1. `2-3` is epic 2, story 3. This is a separator, not a range -- `1-7` means epic 1, story 7.

**What happens (11 steps):**

1. Creates the story file
2. Validates the story specification
3. Runs an adversarial review and fixes issues
4. Develops the story implementation
5. Hunts for edge cases and adds guards
6. Code review #1 -- fixes critical, high, and medium issues
7. Code review #2 -- second pass
8. Code review #3 -- final pass
9. Runs performance assessment
10. Automates game-specific tests (gameplay loops, state transitions)
11. Reviews test quality and coverage

Note that GDS stories do not have a separate ATDD step or traceability step like BMM stories do. Instead, GDS includes a performance assessment step and a test review step.

**Duration:** 60+ minutes per story.

**What to check after:** Review the pipeline report. Look at:

- Performance assessment results -- any concerns flagged?
- Action items requiring human attention
- Game-specific items marked for playtesting or manual verification
- Test coverage of gameplay scenarios

Then repeat for the next story:

```
/auto-gds-story 1-2
```

### Step 5: Close the Epic

After all stories in an epic are done, start a **new Claude Code session** and run:

```
/auto-gds-epic-end 1
```

**What happens (2 steps):**

1. Conducts a retrospective and fixes implementable action items
2. Refreshes the project context

Note that GDS epic-end is lighter than BMM epic-end -- it does not include separate traceability, NFR, or test review steps.

**What to check after:** Review the retrospective. Look for:

- Gameplay balance concerns
- Deferred items that need prioritizing
- Technical debt in game systems
- Recurring bug patterns

### Step 6: Repeat for Next Epic

Go back to Step 3 with the next epic number:

```
/auto-gds-epic-start 2
```

Then stories, then epic-end. Continue until all epics are complete. After the final epic, consider a full end-to-end playtest.

---

## Differences Between GDS and BMM

If you are familiar with the BMM pipeline, here are the key differences:

| Aspect | BMM | GDS |
|--------|-----|-----|
| Plan steps | 11 (includes PRD, UX, impl readiness) | 8 (includes GDD, narrative design) |
| Story steps | 13 (includes ATDD, NFR, trace) | 11 (includes performance, test review) |
| Epic-end steps | 5 (trace, NFR, test review, retro, context) | 2 (retro, context) |
| Config files | `_bmad/bmm/config.yaml` + `_bmad/tea/config.yaml` | `_bmad/gds/config.yaml` |
| Required modules | TEA | GDS |
| Slash commands | `/bmad-*` and `/bmad-testarch-*` | `/gds-*` |

---

## Common Issues and Tips

**Pipeline fails mid-run.** The report tells you which step failed. Roll back with `git reset --hard <commit-hash>` (printed in the report), or roll back just the failed step with `git reset --hard HEAD` and retry.

**"Plan pipeline requires game context."** You ran `/auto-gds-plan` without input. Add a game description or file reference.

**Narrative design skipped.** If your game has no narrative component (e.g., a pure puzzle game or abstract strategy), the pipeline skips narrative design automatically. This is expected.

**Artifacts already exist.** Steps are skipped when artifacts are found. To regenerate, delete the existing artifact first.

**Permission prompts.** Expect several approval prompts during the first few runs. They decrease over time as the allow list builds up.

**Always use fresh sessions.** Start a new Claude Code session for each pipeline command. One story per session.

**Playtesting still matters.** The pipeline cannot verify game feel, animation quality, audio sync, or input responsiveness. Items marked `[Verify]` in the report need manual playtesting.

---

## Quick Reference

All commands in order for a full GDS lifecycle:

```
# 1. Plan (once per project, provide game input)
/auto-gds-plan <description or @file>

# 2. Start epic (once per epic)
/auto-gds-epic-start <epic-number>

# 3. Develop stories (once per story, new session each time)
/auto-gds-story <epic>-<story>

# 4. Close epic (once per epic, after all stories done)
/auto-gds-epic-end <epic-number>

# Repeat steps 2-4 for each epic
```

Example for a project with 2 epics, 2 stories each:

```
/auto-gds-plan @game-concept.md

/auto-gds-epic-start 1
/auto-gds-story 1-1
/auto-gds-story 1-2
/auto-gds-epic-end 1

/auto-gds-epic-start 2
/auto-gds-story 2-1
/auto-gds-story 2-2
/auto-gds-epic-end 2
```

Each line above should be run in its own Claude Code session.
