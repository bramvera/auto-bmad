# Installation

Auto-BMAD has two parts:

- **Target project**: the app or repo where BMAD and Auto-BMAD should run.
- **Host install**: the Claude Code plugin or shared Agent Skills copied into the target project.

## Requirements

Auto-BMAD assumes the target project is already a working BMAD project. Install and configure BMAD modules from their own documentation:

- [BMAD-METHOD v6.5.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0) - required for every Auto-BMAD workflow
- [TEA v1.15.1](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise) - required only for full BMM mode
- [GDS v0.2.2](https://github.com/bmad-code-org/bmad-module-game-dev-studio/releases/tag/v0.2.2) - required only for GDS workflows

Quick mode only needs BMAD-METHOD. Full BMM mode also needs TEA. GDS mode needs GDS.

## Pick Your Host

| Host | Install path | Smoke test |
|------|--------------|------------|
| Claude Code | npm installer or plugin marketplace | `/auto-bmad-check` |
| Codex | `npx @bramvera/auto-bmad init` in the target project | `$auto-bmad-check` |
| Pi / shared Agent Skills hosts | `npx @bramvera/auto-bmad init` in the target project | `/skill:auto-bmad-check` |

## Claude Code

Fast path:

```bash
npx @bramvera/auto-bmad
```

The installer adds the `bramvera/claude-code-plugins` marketplace and installs `auto-bmad@bramvera-plugins`. It asks for a scope:

| Scope | Use when |
|-------|----------|
| `project` | You want the plugin shared through project settings |
| `user` | You want Auto-BMAD available in all projects |
| `local` | You want it only for this checkout |

Manual install inside Claude Code:

```text
/plugin marketplace add bramvera/claude-code-plugins
/plugin install auto-bmad@bramvera-plugins --scope user
/reload-plugins
```

Local plugin checkout:

```bash
git clone https://github.com/bramvera/auto-bmad.git /path/to/auto-bmad
claude --plugin-dir /path/to/auto-bmad
```

Smoke test:

```text
/auto-bmad-check
```

For long unattended runs, start Claude Code in a trusted repo with:

```bash
claude --dangerously-skip-permissions
```

Without that flag, Claude prompts for approval on most actions, which makes unattended sprints impractical.

Uninstall:

```bash
npx @bramvera/auto-bmad --uninstall
```

## Codex and Shared Agent Skills Hosts

Use this path for Codex, Pi, and other hosts that read `.agents/skills` from the target project:

```bash
cd /path/to/your/project
npx @bramvera/auto-bmad init
```

This copies generated Auto-BMAD workflow skills into the target project's existing `.agents/skills` directory. It writes only under `.agents/skills`; it does not edit `.claude`, `.claude-plugin`, or source `commands/*.md` files.

Preview first:

```bash
npx @bramvera/auto-bmad init --dry-run
```

If `.agents/skills` does not exist, complete the BMAD project setup from the BMAD documentation first.

Codex exposes generated skill names with a `$` prefix:

```text
$auto-bmad-check
$auto-bmad-plan <context>
$auto-bmad-sprint-quick 1
$auto-bmad-story-quick 1-1
$auto-bmad-sprint 1
```

Slash-skill hosts expose the same generated skills with `/skill:`:

```text
/skill:auto-bmad-check
/skill:auto-bmad-plan
/skill:auto-bmad-sprint-quick
/skill:auto-bmad-story-quick
/skill:auto-bmad-sprint
```

If you omit a story id or epic number from a story, sprint, or epic skill, the generated wrapper runs the fast status helper and suggests the next item from BMAD sprint status.

See [Auto-BMAD with Codex](tutorial-codex.md) for the Codex command list.

## Local Development From Source

Clone Auto-BMAD once outside your target project:

```bash
git clone https://github.com/bramvera/auto-bmad.git /path/to/auto-bmad-source
```

Then run `init` from each target project:

```bash
cd /path/to/your/project
node /path/to/auto-bmad-source/package/cli.js init
```

`/path/to/auto-bmad-source` is the checkout that contains `package/cli.js`, `commands/`, and `scripts/`.

Do not run `init` from the Auto-BMAD repository unless the Auto-BMAD repo itself is the target project you want to install into.

## Install Check

Run the read-only check before starting a pipeline:

| Host | Command |
|------|---------|
| Claude Code | `/auto-bmad-check` |
| Codex | `$auto-bmad-check` |
| Shared Agent Skills | `/skill:auto-bmad-check` |

Quick mode is the baseline. Missing TEA or GDS should appear as optional capability warnings, not quick-mode failures.

## Common Install Problems

| Problem | Fix |
|---------|-----|
| `.agents/skills` is missing | Complete the BMAD project setup from BMAD's documentation first |
| Codex command is not found | Confirm the project has generated skills under `.agents/skills`, then use the direct skill name such as `$auto-bmad-check` or `$auto-bmad-sprint-quick 1` |
| Claude prompts constantly during a sprint | Restart Claude Code with `claude --dangerously-skip-permissions` in a trusted repo |
| Plugin still shows an old version | Update or reinstall, then reload the host plugin surface |
