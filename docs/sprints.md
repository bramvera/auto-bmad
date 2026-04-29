# Sprints

Auto-BMAD sprints run each step as a fresh-context task, write progress after every story, and continue through failures where possible.

## What Runs Per Story

Quick mode:

```text
Create story -> Develop -> Code review
```

Full BMM mode:

```text
Create story
-> Adversarial review
-> ATDD
-> Develop
-> Edge-case hunt
-> Code review 1
-> Code review 2
-> Code review 3
-> Trace
-> Test automate
```

## Quick Mode Sprint

```text
/auto-bmad-sprint-quick 1
```

Lifecycle:

```text
story 1-1 -> story 1-2 -> ... -> retrospective
```

There is no epic-start phase. Each story runs create, develop, and review. At epic end, a retrospective captures lessons learned and action items.

## Full Mode Sprint

```text
/auto-bmad-sprint 1
```

Lifecycle:

```text
epic-start
-> story 1-1
-> story 1-2
-> ...
-> epic-end
```

Epic start creates test design. Epic end runs traceability, NFR assessment, test review, retrospective, and project-context refresh.

## Failure Handling

If a story crashes, Auto-BMAD retries once. If it still fails, it rolls back to the last checkpoint, logs the failure, and moves to the next story.

Test failures inside a story are not treated as coordinator crashes. The responsible BMAD step should fix them or halt with a blocker.

If story `1-1` fails, dependent stories such as `1-2` and `1-3` may also fail. Independent stories can still complete. Fix the root cause, then rerun the same sprint command.

## Resume

Sprints are resumable. Run the same command again, or ask Claude Code to resume. Auto-BMAD reads `sprint-status.yaml`, skips completed stories, and starts from the next pending item.

![Sprint resume after terminal crash](images/sprint-resume.png)

Terminal crashed mid-sprint. Resume picked up at story 1-4; stories 1-1 through 1-3 were already committed and skipped.

## Progress and Reports

Auto-BMAD writes progress after every story, including:

- status
- duration
- commit hashes
- failure details
- report paths

At the end of a sprint, review the sprint report before starting the next epic.

![Sprint report](images/sprint-report.png)

## Context Management

The coordinator keeps only pass/fail state and short summaries. Each step gets a fresh context window, so long sprints do not degrade because earlier task output filled the active context.

## Duration and Token Comparison

| Command | Duration | Tokens |
|---------|----------|--------|
| `/auto-bmad-story-quick` | ~25-35m | ~60-80k |
| `/auto-bmad-sprint-quick` with 5 stories | ~2.5-3.5h | ~350-450k |
| `/auto-bmad-story` full | ~60-90m | ~150-200k |
| `/auto-bmad-sprint` full with 5 stories | ~5-6h | ~800k-1M |
| `/auto-bmad-plan` | ~40-60m | ~100-150k |

## RTK for Token Savings

[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) is a CLI proxy that filters verbose tool output before it reaches Claude's context window. It can reduce token usage on common dev operations such as git, build, test, lint, and package install commands.

Install:

```bash
cargo install rtk-cli
rtk init --global
```

After setup, commands such as `git status`, `cargo build`, and `pnpm install` are automatically rewritten through RTK filters. Auto-BMAD does not need separate configuration for this.
