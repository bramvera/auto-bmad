---
name: auto-bmad-codex
description: "Codex bridge for Auto-BMAD. Use when the user asks to use Auto-BMAD from Codex, run slash-like /auto-bmad or /auto-gds commands in Codex, or smoke-test Auto-BMAD command routing without executing BMAD agents."
---

# Auto-BMAD Codex Bridge

Bridge Auto-BMAD into Codex safely. Prefer diagnostics and dry-runs before any real pipeline execution.

## Guardrails

- Do not run full TEA pipelines from ambiguous requests. A direct full command with required arguments is explicit confirmation.
- For smoke tests, do not invoke BMAD skills. Only run the dry-run flow checker.
- Quick mode is the baseline: missing TEA or GDS is not a quick-mode failure.
- Treat `/auto-bmad-*` and `/auto-gds-*` text as slash-like command names. Codex may not have Claude slash command dispatch.
- Before running capability checks or dry-runs, use the fast YAML status lookup for a missing story id or epic id. It reads only `_bmad/<module>/config.yaml` and the resolved `sprint-status.yaml`; it does not inspect TOML, skills, or optional modules.
- For progress/status/order questions such as "what's my order?", "current status", "where is the wizard?", or "what is running next?", run the fast status helper with `--wizard`. This is read-only and must not interrupt a running wizard worker.
- Before any real workflow execution, run the dirty-worktree preflight. If dirty changes exist, stop and ask the user. Never skip the story or continue over dirty uncommitted changes.

## Fast YAML Status Path

If the user names an id-taking story, sprint, or epic workflow but omits the required id, locate `status-auto-bmad.mjs` with `find_auto_bmad_script` and run:

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

If the preflight exits 0 or reports `Result: PASS - git worktree is clean.`, continue immediately. Do not ask the user to confirm a clean worktree.

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
4. If preflight is clean and the command has the required story id, epic id, spec path, or context, continue without an extra confirmation prompt. Ask only when the request is ambiguous or missing required inputs.
5. Resolve the exact command file and execute that workflow contract.

## Codex Execution Contract

Codex must preserve Auto-BMAD's git checkpoint behavior. The command file remains the source of truth even though Codex invokes BMAD skills through the skill surface instead of Claude Code foreground Task calls.

Resolve command files as follows:

- `/auto-bmad-story-quick` -> `commands/story-quick.md`
- `/auto-bmad-sprint-quick` -> `commands/sprint-quick.md`
- `/auto-bmad-assess` -> `commands/assess.md`
- `/auto-bmad-sprint-wizard` -> `commands/sprint-wizard.md`
- `/auto-bmad-sprint-wizard reset` -> `commands/sprint-wizard.md`, using the command file's reset/archive path before rebuilding the plan
- `/auto-bmad-sprint-wizard reset autonomous` -> `commands/sprint-wizard.md`, using reset/archive plus autonomous defaults
- `/auto-bmad-story` -> `commands/story.md`
- `/auto-bmad-sprint` -> `commands/sprint.md`
- `/auto-bmad-epic-start` -> `commands/epic-start.md`
- `/auto-bmad-epic-end` -> `commands/epic-end.md`
- `/auto-bmad-plan` -> `commands/plan.md`
- `/auto-bmad-change-spec` -> `commands/change-spec.md`
- `/auto-bmad-change-dev` -> `commands/change-dev.md`
- `/auto-gds-epic-start` -> `commands/gds-epic-start.md`
- `/auto-gds-epic-end` -> `commands/gds-epic-end.md`
- `/auto-gds-*` -> the matching `commands/gds-*.md` file.

For real execution:

1. Read the resolved command file before running BMAD skills.
2. Follow its BMAD skill order, retry policy, progress-file writes, and rollback policy.
3. Replace each "Task prompt" with the equivalent installed BMAD skill invocation available in Codex.
4. Keep all coordinator duties from the command file:
   - record start commit hashes.
   - run per-step WIP commits.
   - update story and sprint status files.
   - squash story commits into the final story commit.
   - commit epic-end or pipeline completion changes.
5. Before reporting the workflow complete or suggesting the next story/epic, run `git status --short`.
6. If implemented workflow changes remain uncommitted, create the final commit required by the command file. If that cannot be done, stop and tell the user the workflow is complete but uncommitted.

Do not say "sprint complete", "story done", or "next options" while leaving Auto-BMAD workflow changes dirty unless the user explicitly told you not to commit.

Do not pause, stop, or return early because the turn is long, the run is large, or a partial batch feels more manageable. Auto-BMAD sprint commands are selected as full-sprint execution. Continue until the selected workflow completes, hits a real blocker, or the user explicitly asks you to stop.

For `/auto-bmad-sprint-wizard` and `$auto-bmad sprint wizard`, the selected workflow is the entire saved wizard plan, not the current story or current epic. If `sprint-plan.yaml` still has later selected epics or stories with runnable pending work, continue into them automatically. A clean checkpoint at an epic boundary is not a completion condition.
