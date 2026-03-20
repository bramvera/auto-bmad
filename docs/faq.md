# FAQ

## General

### What is auto-bmad?

A Claude Code plugin that orchestrates BMAD skills sequentially. It doesn't implement anything itself — it calls BMAD skills (like `/bmad-create-story`, `/bmad-dev-story`, `/bmad-code-review`) one after another with the right arguments, git checkpoints, and retry logic. Think of it as a pipeline runner for BMAD.

### Which BMAD version does this fork support?

BMAD-METHOD v6.2.0, TEA v1.7.1, GDS v0.2.2. The upstream [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad) targets an older version with different skill naming.

### Do I need all the BMAD modules?

No. You only need the modules for the pipeline you're using:

| Pipeline | Required Modules |
|----------|-----------------|
| BMM (plan, story, sprint) | BMAD-METHOD + TEA |
| GDS (gds-plan, gds-story, gds-sprint) | BMAD-METHOD + GDS |
| WDS (wds) | BMAD-METHOD + WDS |

### What Claude Code subscription do I need?

The pipelines are long-running and token-heavy. A Claude Code Max x5 or x20 subscription is strongly recommended. On x1 you'll hit rate limits mid-story.

Rough token usage per command:

| Command | Duration | Tokens |
|---------|----------|--------|
| `/auto-bmad-wds` | ~50-60m | ~130-150k |
| `/auto-bmad-plan` | ~40-60m | ~100-150k |
| `/auto-bmad-epic-start` | ~5-10m | ~20-30k |
| `/auto-bmad-story` | ~60-90m | ~150-200k |
| `/auto-bmad-epic-end` | ~15-20m | ~40-60k |
| `/auto-bmad-sprint` (5 stories) | ~5-6h | ~800k-1M |

---

## Installation

### How do I install from this fork?

```
/plugin marketplace add bramvera/claude-code-plugins
/plugin install auto-bmad@bramvera-plugins --scope user
/reload-plugins
```

### How do I switch from the original to this fork?

```
/plugin uninstall auto-bmad@stefanoginella-plugins --scope user
/plugin install auto-bmad@bramvera-plugins --scope user
/reload-plugins
```

If you see "Plugin is not installed", check which scope it's in. The original might be in `project` or `local` scope. Try adding `--scope project` or `--scope local` to the uninstall command.

### How do I update the plugin?

Open `/plugin`, select auto-bmad, and choose "Update now". If that fails with "Plugin is not installed", clear the cache manually:

```bash
rm -rf ~/.claude/plugins/cache/bramvera-plugins/auto-bmad
```

Then `/reload-plugins`. This forces a fresh download from GitHub.

### I see both colon and dash syntax — which one do I use?

Both `/auto-bmad-story` (dash) and `/auto-bmad:story` (colon) work. The colon syntax is Claude Code's internal plugin namespace format. The dash syntax is the command name. Use whichever you prefer — they resolve to the same skill.

---

## Pipeline Commands

### What's the difference between `/auto-bmad-story` and `/auto-bmad-sprint`?

`/auto-bmad-story 1-1` runs a single story (11 steps, ~60 minutes).

`/auto-bmad-sprint 1` runs an entire epic autonomously — epic-start, all pending stories, epic-end. It reads `sprint-status.yaml`, skips completed stories, and continues to the next story if one fails. Use this when you want to walk away and let it run for hours.

### What does the story pipeline actually do?

11 sequential steps, each in a fresh context window:

| # | Step | Purpose |
|---|------|---------|
| 1 | Create | Generate story spec from epics |
| 2 | Validate | Check spec for gaps, auto-fix |
| 3 | Adversarial Review | Stress-test the spec, fix weaknesses |
| 4 | ATDD | Write failing acceptance tests (TDD red phase — no production code) |
| 5 | Develop | Implement production code to pass all tests |
| 6 | Edge-Case Hunt | Diff new code, find unhandled paths, add guards |
| 7 | Code Review #1 | Fix critical/high/medium issues |
| 8 | Code Review #2 | Second pass |
| 9 | Code Review #3 | Final pass (lighter) |
| 10 | Trace | Map requirements to tests to code |
| 11 | Test Automate | Fill test coverage gaps |

### What is ATDD?

Acceptance Test-Driven Development. Step 4 reads the story spec's acceptance criteria and writes failing tests for each one — unit tests for business logic, API/integration tests where possible, E2E only when browser interaction is genuinely needed. No production code is written in this step. Step 5 (Develop) then implements the code to make the tests pass.

### Why 3 code reviews?

Each pass catches different things. Review #1 typically finds the most issues. Review #2 verifies the fixes and catches what #1 missed. Review #3 is a lighter final pass. In practice, reviews #2 and #3 often come back clean, confirming the code is solid. You can modify the story command to reduce this to 1-2 reviews if speed matters more.

### What does `/auto-bmad-wds` do and when should I use it?

WDS (Whiteport Design Studio) is a deep UX design pipeline — project briefs, trigger mapping (personas + driving forces), user scenarios, page-by-page specs, and design delivery packages. Run it before `/auto-bmad-plan` when your product needs thorough UX work. The plan pipeline detects WDS artifacts and skips its own UX step.

Skip WDS for internal tools, APIs, CLIs, or anything without a UI.

### Do I need to specify story IDs?

For `/auto-bmad-story`, yes — provide the story ID (e.g., `1-1` for epic 1, story 1). The pipeline won't auto-pick stories.

For `/auto-bmad-sprint`, just provide the epic number (e.g., `1`). It reads `sprint-status.yaml` and runs all pending stories automatically.

---

## Running Pipelines

### Can I skip the plan pipeline if I already have artifacts?

Yes. `/auto-bmad-plan` scans for existing artifacts and skips steps where output already exists. If you already have a PRD, architecture, epics, and sprint plan, most steps will be skipped. You can also go directly to `/auto-bmad-epic-start` or `/auto-bmad-sprint`.

### Can I stop a pipeline mid-run?

You can stop between stories (Ctrl+C or close the terminal). Previous completed stories are committed and safe.

If you stop mid-story, partial changes will be in your working tree. Clean up with `git reset --hard HEAD`, then resume with `/auto-bmad-sprint <epic>` — it skips completed stories.

### Is the sprint command resumable?

Yes. `/auto-bmad-sprint` reads `sprint-status.yaml` before starting. Stories already marked as done are skipped. If you ran stories 1-1 through 1-3 before stopping, running `/auto-bmad-sprint 1` again picks up from 1-4.

### What happens if a story fails during a sprint?

The sprint command retries once. If it still fails, it logs the failure, skips to the next story, and continues. The sprint report lists all failed stories with recovery commands. You can then run failed stories individually with `/auto-bmad-story <story-id>`.

### Can I run multiple stories in parallel?

No. Stories are sequential by design — each story may depend on code from previous stories. Running them in parallel would cause conflicts.

### What git commits does the pipeline create?

During a story, it creates checkpoint commits after each step (`wip(1-1): step N/11 <name>`). At the end, it squashes all checkpoints into one clean commit like `feat(1-1): user authentication system`. The sprint command does not add its own commits on top of individual story commits.

---

## Troubleshooting

### The pipeline created a GitHub Actions workflow I didn't ask for

auto-bmad doesn't explicitly create GitHub workflows. This comes from the TEA module's `bmad-testarch-framework` skill, which sometimes scaffolds CI config alongside test framework setup. Review and remove if unwanted.

### A step failed and left partial changes

Run `git reset --hard HEAD` to discard the partial changes from the failed step. Then either retry the story (`/auto-bmad-story <id>`) or resume the sprint (`/auto-bmad-sprint <epic>`).

To roll back an entire pipeline run, use the start commit hash from the report: `git reset --hard <start-commit>`.

### The report suggests wrong command syntax

If you see colon syntax (`/auto-bmad:story`) instead of dash syntax (`/auto-bmad-story`) in the report's "Next" section, this is the agent confusing Claude Code's internal namespace with the command name. Both work — it's a cosmetic issue.

### Plugin shows old version after update

Clear the plugin cache:

```bash
rm -rf ~/.claude/plugins/cache/bramvera-plugins/auto-bmad
```

Then `/reload-plugins` to force a fresh download.

### "Plugin is not installed" when trying to update or uninstall

Check which marketplace the plugin is registered under in `~/.claude/settings.json`. Look for `enabledPlugins` — it might say `auto-bmad@stefanoginella-plugins` instead of `auto-bmad@bramvera-plugins`. Update the key to match the correct marketplace.

### Context window runs out mid-story

Each step runs in its own fresh context window via the Task tool, so individual steps shouldn't exhaust context. If the coordinator (the outer pipeline) runs out, this usually means the story is unusually large. Try running the remaining steps individually using the BMAD skills directly.

### Rate limits during long runs

Use a Claude Code Max x5 or x20 subscription. On x1, a single story (~60m, ~150k tokens) can hit rate limits. A full sprint (5+ stories) will almost certainly be throttled on x1.
