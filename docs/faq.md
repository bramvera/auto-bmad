# FAQ

## Quick Mode vs Full Mode

### What is quick mode?

Quick mode runs 3 steps per story (create, dev, code review) instead of the 10-step full flow. It skips adversarial review, ATDD, edge-case hunt, extra code reviews, trace, and test automate. Tests are generated at the epic level by `bmad-qa-generate-e2e-tests` instead of per-story. Quick mode requires only BMAD-METHOD core -- no TEA module.

### When should I use quick mode vs full mode?

| Situation | Mode |
|-----------|------|
| Prototype or proof of concept | Quick |
| Familiar domain, low ambiguity | Quick |
| Solo developer, moving fast | Quick |
| Max x5 subscription, want to conserve tokens | Quick |
| Fewer than 5 epics, straightforward | Quick |
| Production system serving real users | Full |
| Complex or unfamiliar domain | Full |
| Brownfield with breaking change risk | Full |
| Need per-story traceability | Full |
| Regulated environment requiring audit trails | Full |

### Can I mix quick and full mode in the same project?

Yes, but pick one mode per epic. Quick mode stories don't produce ATDD tests or traceability artifacts, so switching to full mode mid-epic will flag gaps. Switching between epics (quick for epic 1, full for epic 2) is fine.

### Do I need TEA for quick mode?

No. Quick mode only requires BMAD-METHOD core (and GDS for game projects). TEA is not loaded or referenced.

### How do I check what is available?

Run `/auto-bmad-check`. It is read-only and treats BMM quick mode as the baseline. Missing TEA or GDS is reported as optional capability unavailable, not as a failure.

### How much faster is quick mode?

| | Quick | Full |
|---|---|---|
| Per story | ~25-35m, ~60-80k tokens | ~60-90m, ~150-200k tokens |
| Per sprint (5 stories) | ~2.5-3.5h, ~350-450k tokens | ~5-6h, ~800k-1M tokens |

### Does quick mode still generate tests?

Yes, but at the epic level. After all stories complete, `bmad-qa-generate-e2e-tests` generates E2E tests for the entire epic. The dev step within each story may also write tests as part of its normal flow. There is no per-story ATDD (test-driven development) and no per-story test automation.

### Can I run a single quick mode story without the sprint command?

Yes. `/auto-bmad-story-quick 1-1` runs a single story in quick mode (3 steps). If running stories individually, you'll need to run E2E test generation and retrospective manually after all stories complete -- the sprint-quick command handles this automatically.

---

## General

### What is auto-bmad?

An Auto-BMAD host package for Claude Code, Codex, and shared Agent Skills-compatible CLIs. It doesn't implement anything itself — it calls BMAD skills (like `/bmad-create-story`, `/bmad-dev-story`, `/bmad-code-review`) one after another with the right arguments, git checkpoints, and retry logic. Think of it as a pipeline runner for BMAD.

### Can I use auto-bmad in Codex?

Yes. Install it with the same shared Agent Skills command:

```bash
npx @bramvera/auto-bmad init
```

Codex exposes the generated skill names with a `$` prefix, for example `$auto-bmad-check`, `$auto-bmad-story-quick 1-1`, and `$auto-bmad-sprint-quick 1`.

If you provide a story, sprint, or epic workflow but miss the required id, the generated wrapper performs a fast YAML progress lookup first. It reads `_bmad/bmm/config.yaml`, resolves `_bmad-output/implementation-artifacts/sprint-status.yaml`, and suggests the next pending story or epic without running a full capability check.

Plain `$auto-bmad` prints numbered choices. Reply `1` for the next story or `2` for the next epic/sprint. `continue` selects option 1.

Before execution, Codex runs a dirty-worktree preflight. If uncommitted changes exist, it must stop and ask:

1. Commit/stash/clean manually, then rerun Auto-BMAD
2. Create a safety commit of all current changes, then continue
3. Abort

Auto-BMAD should never skip a story or continue into retry/rollback logic over dirty user work.

There is no separate `auto-bmad` YAML config in BMAD v6.5+ support. If `sprint-status.yaml` does not exist yet, `$auto-bmad` treats the repo as a new/pre-sprint project and suggests planning or sprint-planning next steps.

Claude Code exposes Auto-BMAD as slash commands. Codex exposes Auto-BMAD as generated skills. The workflow names are the same; the host prefix changes.

See [Auto-BMAD with Codex](tutorial-codex.md) for the step-by-step Codex workflow.

### Which BMAD version does this fork support?

This branch targets BMAD-METHOD v6.5.0, TEA v1.15.1, and GDS v0.2.2/current skill surfaces by static compatibility checks. BMAD v6.5 supports shared cross-agent skill installs through `.agents/skills`; Auto-BMAD provides Claude Code slash commands and generated shared skills over that layout. The upstream [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad) targets an older version with different skill naming.

Run `/auto-bmad-check` in Claude Code or `$auto-bmad-check` in Codex to validate the installed modules. Missing TEA or GDS is reported as optional unless you choose a pipeline that needs it.
For Pi or another shared Agent Skills host, run `/skill:auto-bmad-check`.

### Do I need all the BMAD modules?

No. You only need the modules for the pipeline you're using:

| Pipeline | Required Modules |
|----------|-----------------|
| BMM quick story/sprint | BMAD-METHOD |
| BMM full story/sprint, plan, change-dev | BMAD-METHOD + TEA |
| BMM change-spec | BMAD-METHOD |
| GDS pipelines | BMAD-METHOD + GDS |

### What Claude Code subscription do I need?

The pipelines are long-running and token-heavy. A Claude Code Max x5 or x20 subscription is strongly recommended. On x1 you'll hit rate limits mid-story.

Rough token usage per command:

| Command | Duration | Tokens |
|---------|----------|--------|
| `/auto-bmad-story-quick` | ~25-35m | ~60-80k |
| `/auto-bmad-sprint-quick` (5 stories) | ~2.5-3.5h | ~350-450k |
| `/auto-bmad-story` (full) | ~60-90m | ~150-200k |
| `/auto-bmad-sprint` (full, 5 stories) | ~5-6h | ~800k-1M |
| `/auto-bmad-plan` | ~40-60m | ~100-150k |
| `/auto-bmad-epic-start` | ~5-10m | ~20-30k |
| `/auto-bmad-epic-end` | ~15-20m | ~40-60k |

---

## Installation

### How do I install from this fork?

See [Installation](installation.md) for the full host-specific setup.

For Claude Code, the fastest install is:

```bash
npx @bramvera/auto-bmad
```

Or install manually inside Claude Code:

```
/plugin marketplace add bramvera/claude-code-plugins
/plugin install auto-bmad@bramvera-plugins --scope user
/reload-plugins
```

For Codex, Pi, or another shared Agent Skills-compatible host, run this from the target project:

```bash
npx @bramvera/auto-bmad init
```

This writes generated Auto-BMAD wrappers into the target project's `.agents/skills` directory. The target project must already be a BMAD project; follow the [BMAD-METHOD documentation](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0) for BMAD setup. Start with `$auto-bmad-check` in Codex or `/skill:auto-bmad-check` in slash-skill hosts.

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

For shared Agent Skills installs, rerun this from the target project:

```bash
npx @bramvera/auto-bmad init
```

### I see both colon and dash syntax — which one do I use?

Both `/auto-bmad-story` (dash) and `/auto-bmad:story` (colon) work. The colon syntax is Claude Code's internal plugin namespace format. The dash syntax is the command name. Use whichever you prefer — they resolve to the same skill.

---

## Pipeline Commands

### What's the difference between `/auto-bmad-story` and `/auto-bmad-sprint`?

`/auto-bmad-story 1-1` runs a single story (10 steps, ~60 minutes).

`/auto-bmad-sprint 1` runs an entire epic autonomously — epic-start, all pending stories, epic-end. It reads `sprint-status.yaml`, skips completed stories, and continues to the next story if one fails. Use this when you want to walk away and let it run for hours.

### What does the story pipeline actually do?

10 sequential steps, each in a fresh context window:

| # | Step | Purpose |
|---|------|---------|
| 1 | Create | Generate story spec from epics |
| 2 | Adversarial Review | Stress-test the spec, fix weaknesses |
| 3 | ATDD | Write failing acceptance tests (TDD red phase — no production code) |
| 4 | Develop | Implement production code to pass all tests |
| 5 | Edge-Case Hunt | Diff new code, find unhandled paths, add guards |
| 6 | Code Review #1 | Fix critical/high/medium issues |
| 7 | Code Review #2 | Second pass |
| 8 | Code Review #3 | Final pass (lighter) |
| 9 | Trace | Map requirements to tests to code |
| 10 | Test Automate | Fill test coverage gaps |

### What is ATDD?

Acceptance Test-Driven Development. Step 3 reads the story spec's acceptance criteria and writes failing tests for each one — unit tests for business logic, API/integration tests where possible, E2E only when browser interaction is genuinely needed. No production code is written in this step. Step 4 (Develop) then implements the code to make the tests pass.

### Why 3 code reviews?

Each pass catches different things. Review #1 typically finds the most issues. Review #2 verifies the fixes and catches what #1 missed. Review #3 is a lighter final pass. In practice, reviews #2 and #3 often come back clean, confirming the code is solid. You can modify the story command to reduce this to 1-2 reviews if speed matters more.

### Why was WDS removed from auto-bmad?

[WDS v0.3+](https://github.com/bmad-code-org/bmad-method-wds-expansion) introduced interactive visual design workflows (Figma round-trips, storyboarding, HTML prototyping, asset generation) that require human-in-the-loop participation. These cannot be run unattended by auto-bmad's automated pipeline. Use WDS directly via `/bmad-wds-*` skills inside Claude Code for the full interactive design experience.

### Why doesn't auto-bmad run create-story validation as a separate step?

`bmad-create-story` already validates newly created stories against its checklist before finalizing them. auto-bmad does not call a separate `bmad-create-story validate` step because the standalone validation path is treated as interactive/uncertified for unattended sprint runs. For manual review, run BMAD validation directly in Claude Code during an interactive planning or review phase.

### Do I need to specify story IDs?

For `/auto-bmad-story`, yes — provide the story ID (e.g., `1-1` for epic 1, story 1). The pipeline won't auto-pick stories.

For `/auto-bmad-sprint`, just provide the epic number (e.g., `1`). It reads `sprint-status.yaml` and runs all pending stories automatically.

---

## Running Pipelines

### Can I skip the plan pipeline if I already have artifacts?

Yes. `/auto-bmad-plan` scans for existing artifacts and skips steps where output already exists. If you already have a PRD, architecture, epics, and sprint plan, most steps will be skipped. You can also go directly to `/auto-bmad-epic-start` or `/auto-bmad-sprint`.

### Can I stop a pipeline mid-run?

**Between stories:** Yes. Previous completed stories are committed and safe. Run `/auto-bmad-sprint <epic>` again — it skips completed stories and picks up where you left off.

**Mid-story:** You can Ctrl+C or close the terminal, but you cannot pause and resume a story. Each story runs as a single Task — there's no checkpoint within it that allows resumption. What's left behind:

| When you stop mid-story | State | Recovery |
|---|---|---|
| During steps 1-2 (spec creation/review) | Partial story spec, no code | `git reset --hard HEAD` to discard, then rerun the story |
| During step 3 (ATDD) | Failing tests written, no prod code | `git reset --hard HEAD` to discard, then rerun |
| During step 4 (Develop) | Partial implementation, some tests passing | `git reset --hard HEAD` to discard, then rerun |
| During steps 5-8 (reviews) | Code exists, partially reviewed | `git reset --hard HEAD` to discard, then rerun |
| During steps 9-10 (trace/automate) | Code is reviewed but traceability incomplete | `git reset --hard HEAD` to discard, then rerun |

In all cases, `git reset --hard HEAD` cleans up the partial work and `/auto-bmad-sprint <epic>` (or `/auto-bmad-story <id>`) will rerun that story from scratch. There is no way to resume a story from step 5 if you stopped at step 4 — the entire story reruns.

### Is the sprint command resumable?

Yes. `/auto-bmad-sprint` reads `sprint-status.yaml` before starting. Stories already marked as done are skipped. If you ran stories 1-1 through 1-3 before stopping, running `/auto-bmad-sprint 1` again picks up from 1-4.

### What happens if a story fails during a sprint?

The sprint command retries once. If it still fails, it logs the failure, skips to the next story, and continues. The sprint report lists all failed stories with recovery commands. You can then run failed stories individually with `/auto-bmad-story <story-id>`.

### Can I run multiple stories in parallel?

No. Stories are sequential by design — each story may depend on code from previous stories. Running them in parallel would cause conflicts.

### What git commits does the pipeline create?

During a story, it creates checkpoint commits after each step (`wip(1-1): step N/10 <name>`). At the end, it squashes all checkpoints into one clean commit like `feat(1-1): user authentication system`. The sprint command does not add its own commits on top of individual story commits.

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
