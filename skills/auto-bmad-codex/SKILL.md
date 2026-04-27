---
name: auto-bmad-codex
description: "Codex bridge for Auto-BMAD. Use when the user asks to use Auto-BMAD from Codex, run slash-like /auto-bmad or /auto-gds commands in Codex, or smoke-test Auto-BMAD command routing without executing BMAD agents."
---

# Auto-BMAD Codex Bridge

Bridge Auto-BMAD into Codex safely. Prefer diagnostics and dry-runs before any real pipeline execution.

## Guardrails

- Do not run full TEA pipelines unless the user explicitly asks for full execution after seeing the dry-run.
- For smoke tests, do not invoke BMAD skills. Only run the dry-run flow checker.
- Quick mode is the baseline: missing TEA or GDS is not a quick-mode failure.
- Treat `/auto-bmad-*` and `/auto-gds-*` text as slash-like command names. Codex may not have Claude slash command dispatch.
- Before running capability checks or dry-runs, use the fast YAML status lookup for a missing story id or epic id. It reads only `_bmad/<module>/config.yaml` and the resolved `sprint-status.yaml`; it does not inspect TOML, skills, or optional modules.
- Before any real workflow execution, run the dirty-worktree preflight. If dirty changes exist, stop and ask the user. Never skip the story or continue over dirty uncommitted changes.

## Fast YAML Status Path

If the user names a story, sprint, or epic workflow but omits the required id, locate `status-auto-bmad.mjs` with `find_auto_bmad_script` and run:

```bash
STATUS_SCRIPT="$(find_auto_bmad_script status-auto-bmad.mjs)"
node "$STATUS_SCRIPT" --project-root . --kind story
node "$STATUS_SCRIPT" --project-root . --kind sprint
node "$STATUS_SCRIPT" --project-root . --kind epic
```

Use `--module gds` for GDS workflows. Then ask the user to confirm the suggested id:

- Story workflow without story id: `Use story <suggested-id>?`
- Sprint or epic workflow without epic id: `Use epic <suggested-id>?`

If the status script is missing or no `sprint-status.yaml` exists, ask the matching direct question and stop:

- Story workflow without story id: `Which story id? Example: 1-1`
- Sprint or epic workflow without epic id: `Which epic number? Example: 1`
- Plan workflow without context: `What product context should I plan from? You can paste a summary or reference a file.`
- GDS plan workflow without context: `What game context should I plan from? You can paste a summary or reference a file.`
- Change spec workflow without description: `What change should I create a spec for?`
- Change dev workflow without spec path: `Which change spec path should I implement?`

## Status Choice Handling

When the immediately previous `$auto-bmad` status output listed numbered choices:

- Treat `1`, `ok`, `continue`, `ok please continue`, `please continue`, `yes`, or `go` as option 1, the next story.
- Treat `2` as option 2, the next epic/sprint.
- If the user replies with any other ambiguous text, ask them to choose `1` or `2`.

After resolving the choice, run the same safety path as the listed command.

## Dirty Worktree Preflight

Before executing any selected Auto-BMAD workflow, locate and run:

```bash
PREFLIGHT_SCRIPT="$(find_auto_bmad_script preflight-auto-bmad.mjs)"
node "$PREFLIGHT_SCRIPT" --project-root .
```

If the preflight reports `BLOCKED`, print its output and stop. Do not run BMAD skills, do not run `git reset`, and do not mark or skip stories. The user must choose:

1. Manually commit/stash/clean changes, then rerun Auto-BMAD.
2. Create a safety commit of all current changes, then continue.
3. Abort.

If the user chooses option 2, run `git add -A && git commit -m "chore(auto-bmad): safety snapshot before pipeline"` and rerun preflight. Continue only when it passes.

## Locate Scripts

Use this Bash locator when a script path is needed:

```bash
find_auto_bmad_script() {
  script_name="$1"
  for candidate in \
    "./scripts/$script_name" \
    "../auto-bmad/scripts/$script_name" \
    "$HOME/dev/auto-bmad/auto-bmad/scripts/$script_name"
  do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  for root in "$HOME/.codex" "$HOME/.agents/plugins" "$HOME/.claude/plugins/cache"; do
    if [ -d "$root" ]; then
      found="$(find "$root" -path "*/auto-bmad*/scripts/$script_name" 2>/dev/null | sort | tail -1)"
      if [ -n "$found" ]; then
        printf '%s\n' "$found"
        return 0
      fi
    fi
  done
  return 1
}
```

## Capability Check

For plain `$auto-bmad` with no concrete workflow, use the fast YAML status path from `$auto-bmad`.

For explicit "help", "menu", "list commands", "commands", or "what can Auto-BMAD do", use the menu script from `$auto-bmad`.

For `/auto-bmad-check` or any availability question:

```bash
CHECK_SCRIPT="$(find_auto_bmad_script check-auto-bmad.mjs)"
if [ -z "$CHECK_SCRIPT" ]; then
  echo "Auto-BMAD check script not found. Install or clone auto-bmad, then retry."
  exit 2
fi
node "$CHECK_SCRIPT" --project-root .
```

Print the output as-is. If it reports `Issues: none for quick mode`, BMM quick mode is available.

## Dry-Run Flow Check

For "test the flow", "smoke test", "check command routing", or any slash-like command that should not execute yet:

```bash
SMOKE_SCRIPT="$(find_auto_bmad_script smoke-auto-bmad-flow.mjs)"
if [ -z "$SMOKE_SCRIPT" ]; then
  echo "Auto-BMAD smoke script not found. Install or clone auto-bmad, then retry."
  exit 2
fi
node "$SMOKE_SCRIPT" --project-root . --command <auto-bmad-command>
```

Replace `<auto-bmad-command>` with the command name the user wants to test, for example:

- `auto-bmad-story-quick`
- `/auto-bmad-story-quick`
- `auto-bmad-plan`
- `auto-gds-story-quick`

The smoke checker prints the BMAD/GDS skill calls it would make and stops before execution.

## Real Execution Boundary

If the user asks to actually run an Auto-BMAD pipeline in Codex:

1. Run dirty-worktree preflight.
2. Run the capability check.
3. Run the dry-run flow check for the exact command.
4. For full/TEA commands, stop and ask for explicit confirmation before continuing.
5. For quick-mode commands, explain that Codex execution uses the installed BMAD skills directly rather than Claude Code foreground Task calls.
