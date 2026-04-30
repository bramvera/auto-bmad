---
name: auto-bmad
description: "Codex entrypoint for Auto-BMAD. Use when the user invokes Auto-BMAD from Codex, asks for /auto-bmad-check, /auto-bmad-* or /auto-gds-* behavior, wants quick-mode readiness, or wants a dry-run before executing BMAD automation."
---

# Auto-BMAD

Use this as the Codex-native Auto-BMAD entrypoint. Auto-BMAD's Claude package contains slash-command files; Codex plugins expose reusable workflows as skills, so treat slash-like text as a command request and route it safely.

Users should only need to remember `$auto-bmad`. The default behavior for plain `$auto-bmad` is fast YAML status, not a menu. Only print the command menu when the user explicitly asks for "menu", "help", "list commands", "commands", or "what can Auto-BMAD do".

## Fast YAML Status Path

Before running any capability check, menu, or dry-run, inspect the user's message. Use the fast YAML status lookup for:

- Plain `$auto-bmad` with no extra request.
- Story, sprint, or epic workflows with a missing required id.
- Progress/status/order questions such as "what's my order?", "current status", "where is the wizard?", or "what is running next?".

It reads only `_bmad/<module>/config.yaml` and the resolved `sprint-status.yaml`; it must not run the full capability check.

```bash
STATUS_SCRIPT=""
for candidate in \
  "./scripts/status-auto-bmad.mjs" \
  "../auto-bmad/scripts/status-auto-bmad.mjs" \
  "$HOME/dev/auto-bmad/auto-bmad/scripts/status-auto-bmad.mjs"
do
  if [ -f "$candidate" ]; then STATUS_SCRIPT="$candidate"; break; fi
done
if [ -z "$STATUS_SCRIPT" ]; then
  for root in "$HOME/.codex" "$HOME/.agents/plugins" "$HOME/.claude/plugins/cache"; do
    if [ -d "$root" ]; then
      STATUS_SCRIPT="$(find "$root" -path '*/auto-bmad*/scripts/status-auto-bmad.mjs' 2>/dev/null | sort | tail -1)"
      if [ -n "$STATUS_SCRIPT" ]; then break; fi
    fi
  done
fi
```

- Plain `$auto-bmad` -> run `node "$STATUS_SCRIPT" --project-root .` and print the status output. Do not print the command menu.
- Status/order/progress questions -> run `node "$STATUS_SCRIPT" --project-root . --wizard` and print the status output. This is read-only and must not interrupt a running wizard worker.
- `$auto-bmad quick story`, `/auto-bmad-story-quick`, `$auto-bmad full story`, `/auto-bmad-story`, `$auto-bmad gds quick story`, or `$auto-bmad gds full story` without a story id -> run `node "$STATUS_SCRIPT" --project-root . --kind story` (`--module gds` for GDS), then ask which story id to use with the suggested next story.
- `$auto-bmad quick sprint`, `/auto-bmad-sprint-quick`, `$auto-bmad full sprint`, `/auto-bmad-sprint`, `$auto-bmad gds quick sprint`, or `$auto-bmad gds full sprint` without an epic id -> run `node "$STATUS_SCRIPT" --project-root . --kind sprint` (`--module gds` for GDS), then ask which epic number to use with the suggested next epic.
- `$auto-bmad epic start`, `$auto-bmad epic end`, `/auto-bmad-epic-start`, `/auto-bmad-epic-end`, `$auto-bmad gds epic start`, or `$auto-bmad gds epic end` without an epic id -> run `node "$STATUS_SCRIPT" --project-root . --kind epic` (`--module gds` for GDS), then ask which epic number to use with the suggested next epic.
- `$auto-bmad plan` or `/auto-bmad-plan` without product context -> ask: `What product context should I plan from? You can paste a summary or reference a file.`
- `$auto-bmad gds plan` or `/auto-gds-plan` without game context -> ask: `What game context should I plan from? You can paste a summary or reference a file.`
- `$auto-bmad change spec` or `/auto-bmad-change-spec` without a change description -> ask: `What change should I create a spec for?`
- `$auto-bmad change dev` or `/auto-bmad-change-dev` without a spec path -> ask: `Which change spec path should I implement?`

If `STATUS_SCRIPT` is not found, fall back to the shortest direct question (`Which story id? Example: 1-1` or `Which epic number? Example: 1`). For plain `$auto-bmad`, say `Auto-BMAD status script not found. Try $auto-bmad-check.` Do not run `$auto-bmad-check`, `menu-auto-bmad.mjs`, or `smoke-auto-bmad-flow.mjs` unless the user explicitly asks for them.

## Status Choice Handling

After printing plain `$auto-bmad` status, the script lists numbered actions. Interpret replies as:

- `1`, `ok`, `continue`, `ok please continue`, `please continue`, `yes`, or `go` -> select option 1, the next story.
- `2` -> select option 2, the next epic/sprint.

After selection, run the same safety path as if the user had typed the listed command: dirty-worktree preflight, capability check, dry-run, then proceed only within the Codex execution boundary. A clean preflight is not a user-confirmation point.

## Dirty Worktree Preflight

Before any real Auto-BMAD execution that may create commits, mutate files, or use retry rollback, run this read-only preflight from the project root:

```bash
PREFLIGHT_SCRIPT=""
for candidate in \
  "./scripts/preflight-auto-bmad.mjs" \
  "../auto-bmad/scripts/preflight-auto-bmad.mjs" \
  "$HOME/dev/auto-bmad/auto-bmad/scripts/preflight-auto-bmad.mjs"
do
  if [ -f "$candidate" ]; then PREFLIGHT_SCRIPT="$candidate"; break; fi
done
if [ -z "$PREFLIGHT_SCRIPT" ]; then
  for root in "$HOME/.codex" "$HOME/.agents/plugins" "$HOME/.claude/plugins/cache"; do
    if [ -d "$root" ]; then
      PREFLIGHT_SCRIPT="$(find "$root" -path '*/auto-bmad*/scripts/preflight-auto-bmad.mjs' 2>/dev/null | sort | tail -1)"
      if [ -n "$PREFLIGHT_SCRIPT" ]; then break; fi
    fi
  done
fi
node "$PREFLIGHT_SCRIPT" --project-root .
```

If the preflight exits 0 or reports `Result: PASS - git worktree is clean.`, continue immediately. Do not ask the user to confirm a clean worktree.

If the preflight reports `BLOCKED`, print its output and stop. Do not skip the story, do not run BMAD skills, do not run git reset, and do not continue. Ask the user to choose:

1. Manually commit/stash/clean changes, then rerun Auto-BMAD.
2. Create a safety commit of all current changes, then continue.
3. Abort.

If the user chooses option 2, run `git add -A && git commit -m "chore(auto-bmad): safety snapshot before pipeline"` and then rerun the preflight. Continue only if the worktree is clean afterward.

## Command Menu

Run this read-only menu from the project root only when the user explicitly asks for the menu/help/command list:

```bash
MENU_SCRIPT=""
for candidate in \
  "./scripts/menu-auto-bmad.mjs" \
  "../auto-bmad/scripts/menu-auto-bmad.mjs" \
  "$HOME/dev/auto-bmad/auto-bmad/scripts/menu-auto-bmad.mjs"
do
  if [ -f "$candidate" ]; then MENU_SCRIPT="$candidate"; break; fi
done
if [ -z "$MENU_SCRIPT" ]; then
  for root in "$HOME/.codex" "$HOME/.agents/plugins" "$HOME/.claude/plugins/cache"; do
    if [ -d "$root" ]; then
      MENU_SCRIPT="$(find "$root" -path '*/auto-bmad*/scripts/menu-auto-bmad.mjs' 2>/dev/null | sort | tail -1)"
      if [ -n "$MENU_SCRIPT" ]; then break; fi
    fi
  done
fi
if [ -z "$MENU_SCRIPT" ]; then
  echo 'Auto-BMAD menu script not found. Use $auto-bmad-check first, then ask for quick story or quick sprint.'
  exit 2
fi
node "$MENU_SCRIPT" --project-root .
```

Print the output exactly. It lists ready commands first and marks optional missing modules as unavailable instead of asking the user to install everything.

## Routing

- Apply the fast YAML status path first. Plain `$auto-bmad` means fast YAML status.
- For `/auto-bmad-check`, availability questions, or "can Auto-BMAD run here", run the read-only capability check from `$auto-bmad-check`.
- For `/auto-bmad-*`, `/auto-gds-*`, or natural-language workflow requests in Codex, use `$auto-bmad-codex` to run the dry-run flow checker first.
- For quick-mode execution requests, run the capability check and dry-run first, then execute the matching Auto-BMAD workflow contract below.
- For full/TEA execution requests, treat a direct command with required arguments, such as `$auto-bmad-sprint 1`, as explicit user intent. Run the capability check and dry-run first, then continue without asking for a second confirmation when preflight is clean. Ask only when the request is ambiguous, missing required arguments, or selected from an informational menu/status output.

## Codex Execution Contract

When Codex executes an Auto-BMAD workflow, it must preserve the same git safety contract as the Claude slash command file.

1. Resolve the slash-like workflow to its command file:
   - `quick story <id>` -> `commands/story-quick.md`
   - `quick sprint <epic>` -> `commands/sprint-quick.md`
   - `assess [epic]` -> `commands/assess.md`
   - `sprint wizard` -> `commands/sprint-wizard.md`
   - `full story <id>` -> `commands/story.md`
   - `full sprint <epic>` -> `commands/sprint.md`
   - `epic start <epic>` -> `commands/epic-start.md`
   - `epic end <epic>` -> `commands/epic-end.md`
   - `plan <context>` -> `commands/plan.md`
   - `change spec <description>` -> `commands/change-spec.md`
   - `change dev <spec>` -> `commands/change-dev.md`
   - `gds ...` -> the matching `commands/gds-*.md` file.
2. Read that command file before execution and treat it as the source of truth for:
   - BMAD skill order.
   - retry and rollback rules.
   - live progress files.
   - per-step WIP commits.
   - final story, epic, or pipeline squash commit.
3. Codex does not have Claude Code foreground Task dispatch. Replace each command file "Task prompt" with the equivalent installed BMAD skill invocation, but keep the coordinator responsibilities in the Auto-BMAD command file exactly.
4. After every successful step, run the command file's checkpoint command. If the command file says to commit after each step, do it. If the worktree is clean because the BMAD skill already committed, treat that as success.
5. At story or epic completion, run the command file's final squash/final commit sequence before reporting the workflow complete.
6. Before printing "done", "complete", "next story", or "next epic", run `git status --short`.
   - If the workflow intentionally changed files and `git status --short` is not empty, create the required final Auto-BMAD commit from the command file.
   - If a commit cannot be created, stop and tell the user the workflow is complete but uncommitted. Do not suggest the next Auto-BMAD action as if the pipeline is clean.

For Codex, the difference is only the host interface. The workflow still owns commits. A successful Auto-BMAD story or sprint must not leave implemented story changes uncommitted unless the user explicitly asked to stop before committing.

Do not pause, stop, or return early because the turn is long, the run is large, or a partial batch feels more manageable. Auto-BMAD sprint commands are selected as full-sprint execution. Continue until the selected workflow completes, hits a real blocker, or the user explicitly asks you to stop.

For `/auto-bmad-sprint-wizard` and `$auto-bmad sprint wizard`, the selected workflow is the entire saved wizard plan, not the current story or current epic. If `sprint-plan.yaml` still has later selected epics or stories with runnable pending work, continue into them automatically. A clean checkpoint at an epic boundary is not a completion condition.

## Natural Language Shortcuts

Map common Codex phrasing to Claude command names before dry-run checks:

- `quick story 1-1` -> `/auto-bmad-story-quick 1-1`
- `quick sprint 1` -> `/auto-bmad-sprint-quick 1`
- `assess` or `assess 1` -> `/auto-bmad-assess [1]`
- `sprint wizard` -> `/auto-bmad-sprint-wizard`
- `sprint wizard reset`, `reset wizard sprint`, or `wizard reset` -> `/auto-bmad-sprint-wizard reset`
- `sprint wizard reset autonomous`, `reset wizard sprint autonomous`, or `wizard reset autonomous` -> `/auto-bmad-sprint-wizard reset autonomous`
- `full story 1-1` -> `/auto-bmad-story 1-1`
- `full sprint 1` -> `/auto-bmad-sprint 1`
- `plan <context>` -> `/auto-bmad-plan <context>`
- `change spec <description>` -> `/auto-bmad-change-spec <description>`
- `gds quick story 1-1` -> `/auto-gds-story-quick 1-1`
- `gds quick sprint 1` -> `/auto-gds-sprint-quick 1`
- `gds epic start 1` -> `/auto-gds-epic-start 1`
- `gds epic end 1` -> `/auto-gds-epic-end 1`

When running `smoke-auto-bmad-flow.mjs`, pass only the command name portion, not the story id, epic id, or free-form context.

For sprint wizard reset commands, reset is not optional prose. Before executing the wizard workflow, run the reset helper from the target project if available:

```bash
node .agents/skills/_auto-bmad-runtime/scripts/reset-sprint-wizard.mjs --project-root .
```

If that path is unavailable, find `reset-sprint-wizard.mjs` in the Auto-BMAD package/plugin checkout and run it with `--project-root .`. Then execute `/auto-bmad-sprint-wizard` normally; if the original command included `autonomous`, keep autonomous mode enabled.

## Safety

- Do not run full TEA pipelines from ambiguous requests. A direct full command with required arguments is explicit confirmation.
- Do not recommend installing TEA or GDS for normal quick-mode use.
- Treat missing TEA/GDS as optional capability gaps unless the requested command requires them.
- Never skip dirty uncommitted changes. Dirty worktree preflight is blocking for execution.
- Never self-pause an Auto-BMAD story or sprint because of turn length, context length, elapsed time, or "manageability"; those are not workflow blockers.
- Never report an Auto-BMAD workflow as complete while its implemented changes are still uncommitted. Commit according to the resolved command file, or stop and ask the user.
