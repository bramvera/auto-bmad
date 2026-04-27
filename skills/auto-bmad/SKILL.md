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

After selection, run the same safety path as if the user had typed the listed command: dirty-worktree preflight, capability check, dry-run, then proceed only within the Codex execution boundary.

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
- For quick-mode execution requests, run the capability check and dry-run first, then explain that Codex execution uses installed BMAD skills directly rather than Claude Code foreground Task calls.
- For full/TEA execution requests, stop after the dry-run unless the user explicitly confirms they want to spend the tokens.

## Natural Language Shortcuts

Map common Codex phrasing to Claude command names before dry-run checks:

- `quick story 1-1` -> `/auto-bmad-story-quick 1-1`
- `quick sprint 1` -> `/auto-bmad-sprint-quick 1`
- `full story 1-1` -> `/auto-bmad-story 1-1`
- `full sprint 1` -> `/auto-bmad-sprint 1`
- `plan <context>` -> `/auto-bmad-plan <context>`
- `change spec <description>` -> `/auto-bmad-change-spec <description>`
- `gds quick story 1-1` -> `/auto-gds-story-quick 1-1`
- `gds quick sprint 1` -> `/auto-gds-sprint-quick 1`

When running `smoke-auto-bmad-flow.mjs`, pass only the command name portion, not the story id, epic id, or free-form context.

## Safety

- Do not run full TEA pipelines unless the user explicitly confirms after seeing the dry-run.
- Do not recommend installing TEA or GDS for normal quick-mode use.
- Treat missing TEA/GDS as optional capability gaps unless the requested command requires them.
- Never skip dirty uncommitted changes. Dirty worktree preflight is blocking for execution.
