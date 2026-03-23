# Changelog

All notable changes to this project will be documented in this file.

This fork diverges from [stefanoginella/auto-bmad](https://github.com/stefanoginella/auto-bmad) starting at v0.3.0.

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
