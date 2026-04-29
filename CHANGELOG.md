# Changelog

All notable changes to this project will be documented in this file.

This fork diverges from [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad) starting at v0.3.0.

## [0.10.1] - 2026-04-29

### Changed
- Simplified README onboarding and moved detailed install, getting started, concept, and sprint guidance into `docs/`.
- Clarified that Codex and shared Agent Skills installs use `npx @bramvera/auto-bmad init`, while BMAD remains a prerequisite linked to upstream documentation.

### Fixed
- Codex generated sprint workflows now continue automatically when the git worktree is clean, while still blocking and asking before mutating a dirty worktree.

## [0.10.0] - 2026-04-28

### Added
- `/auto-bmad-check` read-only diagnostics for installed BMAD skills, configs, optional modules, and output paths.
- Static compatibility checker for Auto-BMAD command references, including optional GDS skill directories.
- Codex plugin manifest plus `$auto-bmad`, `$auto-bmad-check`, and `$auto-bmad-codex` skills for diagnostics and dry-run command routing checks.
- Codex command menu script for explicit `$auto-bmad menu` / help requests, while plain `$auto-bmad` stays on fast YAML status.
- Fast Codex YAML status lookup for missing story/sprint/epic ids, reading `sprint-status.yaml` before falling back to a direct question.
- Numbered Codex status choices so users can reply `1`, `2`, or `continue` after `$auto-bmad`.
- Dirty-worktree execution preflight for Codex bridge workflows; execution blocks and asks instead of skipping or continuing over uncommitted changes.
- Dry-run flow smoke checker for Auto-BMAD command files.
- `auto-bmad init` shared Agent Skills installer that generates `/skill:auto-bmad-*` wrappers from the existing command files and copies them into `.agents/skills` without changing Claude files.

### Changed
- Updated compatibility target to BMAD-METHOD v6.5.0 shared cross-agent skill layouts, TEA v1.15.1, and GDS v0.2.2/current skill surfaces.
- Removed standalone story validation from full BMM and GDS story flows; create-story skills already self-validate, so full mode is now 10 checkpoints per story.
- Replaced removed `bmad-quick-spec` dependency with direct minor-change spec generation in `/auto-bmad-change-spec`.
- Routed product brief creation through `/bmad-product-brief`.

### Removed
- Legacy `/auto-bmad-setup` skill and setup scripts. This fork targets BMAD v6.5+ installs and does not support older root YAML setup flows.

## [0.9.2] - 2026-04-12

### Changed
- Updated all references from Quinn QA persona to `bmad-qa-generate-e2e-tests` skill name (Quinn agent removed in BMAD v6.3.0)
- Updated version badges and prerequisites: BMAD v6.2.2 -> v6.3.0, TEA v1.7.3 -> v1.7.2
- Updated commit messages in sprint-quick pipelines: `quinn-qa` -> `e2e-tests`

### Added
- **auto-bmad-plan pre-run summary**: shows users exactly what 11 steps will run, estimated time/cost, and recommends manual planning for production projects
- **Quick mode simplified**: removed E2E test generation from quick mode — epic-end is now just retrospective (1 step instead of 2). Quick mode = fast iteration, full mode = comprehensive testing.
- **README: "This Is Not Vibe Coding"** — comparison table showing how BMAD + auto-bmad differs from prompt-and-pray code generation
- **README: visual pipeline flows** — mermaid diagrams showing what runs per story in quick and full mode
- **README: "Where auto-bmad Fits in BMAD"** — diagram showing interactive (human) vs automated (auto-bmad) phases
- **README: "What You Gain and What You Trade"** — honest tradeoffs table
- **README: "BMAD Skills Compatibility"** — table of which BMAD skills work in auto-bmad and which don't (with reasons)
- Marketplace distribution manifest (`.claude-plugin/marketplace.json`)
- FAQ entry explaining why new v6.3.0 interactive skills (`bmad-checkpoint-preview`, `bmad-create-story:validate`) are excluded from automated pipelines

### Fixed
- **Agent editing command files**: added explicit "DO NOT EDIT" warning to all 17 command files — prevents agents from modifying pipeline instructions instead of executing them

### Internal
- No functional pipeline changes — all underlying BMAD skills remain compatible
- v6.3.0 improvements (epic context compilation, previous story continuity, sharded document support) work automatically through existing skill calls

## [0.9.1] - 2026-03-30

### Fixed
- **Sprint-quick retry policy**: stop and ask user for guidance on double failure instead of silently skipping to next story — two consecutive failures need human attention
- **Cosmetic**: added rule to never print `{{variable}}` syntax literally in terminal output — always resolve to actual values

## [0.9.0] - 2026-03-29

### Removed
- **WDS pipeline**: removed `/auto-bmad-wds` command, tutorial, and related config — WDS v0.3+ requires human-in-the-loop participation incompatible with auto-bmad's automated pipeline

### Changed
- Bump BMAD badge to v6.2.2, TEA badge to v1.7.3

## [0.8.2] - 2026-03-24

### Added
- **Token cost reports**: all 16 pipeline reports now run `token-report.py` at the end of each pipeline, saving accurate billing breakdown (`token-report-*.md`) to `auto-bmad-artifacts/` automatically

## [0.8.1] - 2026-03-23

### Fixed
- **WDS**: `design_artifacts` now derived from `output_folder` instead of reading config field directly — fixes artifacts being created at project root instead of inside the configured output folder

## [0.8.0] - 2026-03-23

### Added
- **Quick Mode** -- lightweight pipeline requiring only BMAD-METHOD core (no TEA module)
- `/auto-bmad-story-quick` -- 3-step story: create, dev, code review (~25-35 min, ~60-80k tokens)
- `/auto-bmad-sprint-quick` -- quick sprint: all stories (3 steps each) + Quinn QA + retro at epic-end
- `/auto-gds-story-quick` -- GDS variant of quick story
- `/auto-gds-sprint-quick` -- GDS variant of quick sprint
- Quick mode skips: story validation, adversarial review, ATDD, edge-case hunt, reviews #2/#3, trace, test automate
- Quick mode epic-end uses Quinn QA (built-in BMAD) for epic-level E2E test generation instead of TEA
- Mode comparison table in README with token/duration estimates for Max x5 users
- Quick vs Full mode FAQ section
- Quick mode commands in commands reference with dependency table

### Changed
- README restructured: modes at the top, commands grouped by mode, clear subscription guidance
- Quick Start section shows both modes

## [0.7.0] - 2026-03-21

### Added
- `/auto-bmad-change-spec` — brownfield change spec: routes to `bmad-correct-course` (significant changes) or `bmad-quick-spec` (minor changes) based on scope assessment
- `/auto-bmad-change-dev` — brownfield implementation with regression safety: locks existing behavior with regression tests before making changes, then ATDD, implement, full test suite verification, code review, and trace
- All brownfield steps use BMAD skills with full project context (PRD, architecture, project-context.md) — no custom flows bypassing BMAD guardrails

## [0.6.0] - 2026-03-21

### Fixed
- Mark all task checkboxes as done (`[x]`) on story completion — no more completed stories with unchecked tasks

### Changed
- Reworked README with professional layout and clear structure
- Added phase philosophy section: analysis (manual), planning (tradeoffs), execution (auto)
- Added token usage and permissions warnings at the top
- Added credits section for original author

## [0.5.1] - 2026-03-21

### Fixed
- Flattened sprint agent nesting to prevent context exhaustion — sprint now runs story steps directly (2 levels) instead of delegating to `/auto-bmad-story` (3 levels)
- Updated authorship: bramvera as author, stefanoginella as contributor

## [0.5.0] - 2026-03-21

### Added
- `/auto-bmad-sprint` command: run an entire epic hands-off (epic-start, all stories, epic-end)
- `/auto-gds-sprint` command: same for GDS pipeline
- Live progress file written to disk after every story (`sprint-epic-<N>-progress.md`)
- Continue-on-failure: sprint skips failed stories and continues to the next
- Resumable sprints: re-run the command and it skips completed stories
- Context management rules to prevent degradation on long runs
- FAQ documentation with troubleshooting guide

### Changed
- Smart code review skipping: reviews #2/#3 skip if the previous review was clean (~5-6 min saved per clean story)

## [0.4.0] - 2026-03-20

### Added
- `/auto-bmad-wds` command: 9-step WDS (Whiteport Design Studio) UX design pipeline
- Step-by-step tutorials: BMM, GDS, and WDS+BMM combined workflow
- Real-world screenshots: WDS pipeline run, sprint progress report

### Changed
- Version bump to reflect WDS integration

## [0.3.0] - 2026-03-20

### Breaking Changes
- All skill names updated for BMAD-METHOD v6.2.0, TEA v1.7.1, GDS v0.2.2 compatibility
  - BMM: `bmad-bmm-*` --> `bmad-*` (removed `-bmm-` infix)
  - TEA: `bmad-tea-testarch-*` --> `bmad-testarch-*` (removed `-tea-` infix)
  - GDS: `bmad-gds-*` --> `gds-*` (dropped `bmad-` prefix, renamed `gametest` to `test`)

### Changed
- Updated plugin homepage and repo URLs to bramvera/auto-bmad
- Marketplace installation via `bramvera/claude-code-plugins`

---

## Pre-fork versions (stefanoginella/auto-bmad)

Versions 0.1.x through 0.2.9 are from the original [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad). See that repo for earlier history.
