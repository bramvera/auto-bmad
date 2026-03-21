# Commands Reference

Every auto-bmad command orchestrates existing BMAD skills — it never bypasses BMAD guardrails or invents its own flows. This document maps each command to the exact BMAD skills it calls, so you know what's running under the hood.

---

## Greenfield Commands

### `/auto-bmad-plan`

Planning pipeline for new projects. Each step runs as a fresh agent.

| Step | BMAD Skill | Purpose | Skippable |
|------|-----------|---------|-----------|
| 1 | `/bmad-create-product-brief` | Create product brief from user input | Yes — if brief or PRD exists |
| 2 | `/bmad-create-prd` | Create Product Requirements Document | Yes — if PRD exists |
| 3 | `/bmad-validate-prd` | Validate PRD and auto-fix issues | Yes — if PRD predates this run |
| 4 | `/bmad-create-ux-design` | Plan UX patterns and design specs | Yes — if UX spec exists or no frontend |
| 5 | `/bmad-create-architecture` | Create architecture and solution design | Yes — if architecture exists |
| 6 | `/bmad-testarch-framework` | Initialize test framework (TEA module) | Yes — if test framework configured |
| 7 | `/bmad-testarch-test-design` | System-level test plan (TEA module) | Yes — if test design exists |
| 8 | `/bmad-create-epics-and-stories` | Break requirements into epics and stories | Yes — if epics exist |
| 9 | `/bmad-check-implementation-readiness` | Validate all specs are complete | No — always runs |
| 10 | `/bmad-generate-project-context` | Generate project-context.md for AI agents | No — always runs |
| 11 | `/bmad-sprint-planning` | Create sprint plan from epics | Yes — if sprint-status.yaml exists |

---

### `/auto-bmad-sprint <epic>`

Runs an entire epic hands-off. Flattened architecture — the sprint coordinator calls each step directly (no nested story coordinator).

**Phase 1: Epic Start**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-test-design` | Epic-level test plan (TEA module) |

**Phase 2: Stories (repeated for each pending story)**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec from epics |
| 2 | `/bmad-create-story validate` | Validate story spec, auto-fix gaps |
| 3 | `/bmad-review-adversarial-general` | Stress-test the spec, fix weaknesses |
| 4 | `/bmad-testarch-atdd` | Write failing acceptance tests — TDD red phase (TEA module) |
| 5 | `/bmad-dev-story` | Implement code to pass all tests |
| 6 | `/bmad-review-edge-case-hunter` | Find unhandled paths in new code, add guards |
| 7 | `/bmad-code-review` | Code review #1 — fix critical/high/medium issues |
| 8 | `/bmad-code-review` | Code review #2 — only if #1 found issues |
| 9 | `/bmad-code-review` | Code review #3 — only if #2 found issues |
| 10 | `/bmad-testarch-trace` | Map requirements to tests to code (TEA module) |
| 11 | `/bmad-testarch-automate` | Fill test coverage gaps (TEA module) |

**Phase 3: Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-trace` | Epic-level traceability (TEA module) |
| 2 | `/bmad-testarch-nfr` | Non-functional requirements assessment (TEA module) |
| 3 | `/bmad-testarch-test-review` | Test quality review with pyramid compliance (TEA module) |
| 4 | `/bmad-retrospective` | Post-epic review, resolve action items |
| 5 | `/bmad-generate-project-context` | Refresh project context with epic outcomes |

---

### `/auto-bmad-story <id>`

Runs a single story. Same 11 steps as the sprint's Phase 2, but as a standalone command with its own report.

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-create-story` | Generate story spec |
| 2 | `/bmad-create-story validate` | Validate and fix spec |
| 3 | `/bmad-review-adversarial-general` | Adversarial review of spec |
| 4 | `/bmad-testarch-atdd` | Failing acceptance tests (TEA) |
| 5 | `/bmad-dev-story` | Implement |
| 6 | `/bmad-review-edge-case-hunter` | Edge-case hunt on diff |
| 7 | `/bmad-code-review` | Code review #1 |
| 8 | `/bmad-code-review` | Code review #2 (skipped if #1 clean) |
| 9 | `/bmad-code-review` | Code review #3 (skipped if #2 clean) |
| 10 | `/bmad-testarch-trace` | Traceability (TEA) |
| 11 | `/bmad-testarch-automate` | Expand test coverage (TEA) |

---

### `/auto-bmad-epic-start <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-test-design` | Epic-level test plan (TEA module) |

---

### `/auto-bmad-epic-end <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-trace` | Epic-level traceability (TEA) |
| 2 | `/bmad-testarch-nfr` | NFR assessment (TEA) |
| 3 | `/bmad-testarch-test-review` | Test quality and pyramid compliance (TEA) |
| 4 | `/bmad-retrospective` | Retrospective with action item resolution |
| 5 | `/bmad-generate-project-context` | Refresh project context |

---

## WDS Command

### `/auto-bmad-wds`

UX design pipeline using the Whiteport Design Studio module.

| Step | BMAD Skill (WDS module) | Purpose | Skippable |
|------|------------------------|---------|-----------|
| 1 | `/bmad-wds-alignment` | Stakeholder alignment and signoff | Yes — if not client work |
| 2 | `/bmad-wds-project-brief` | Strategic project brief | Yes — if brief exists |
| 3 | `/bmad-wds-trigger-mapping` | Map business goals to user psychology | Yes — if trigger map exists |
| 4 | `/bmad-wds-platform-requirements` | Define technical boundaries for design | Yes — if simple project |
| 5 | `/bmad-wds-outline-scenarios` | Define user journeys | Yes — if scenarios exist |
| 6 | `/bmad-wds-conceptual-sketching` | Visual exploration of flows | Yes — if simple scenarios |
| 7 | `/bmad-wds-conceptual-specs` | Page-by-page specifications | Yes — if specs exist |
| 8 | `/bmad-wds-functional-components` | Identify reusable patterns | Yes — if design system mode is "none" |
| 9 | `/bmad-wds-design-delivery` | Validate and package specs for dev | Yes — if delivery exists |

---

## Brownfield Commands

### `/auto-bmad-change-spec`

Interactive change spec for brownfield modifications. Routes to the appropriate BMAD skill based on scope.

| Scope | BMAD Skill | What it does |
|-------|-----------|-------------|
| Significant (affects PRD, architecture, epics) | `/bmad-correct-course` | Full impact analysis across all BMAD artifacts. 6-step interactive checklist. Produces Sprint Change Proposal. |
| Minor (contained code change) | `/bmad-quick-spec` | Conversational spec creation with code investigation. 4 steps: understand, investigate, generate, review. |

Both skills read project context, architecture, PRD, and epics. The human decides scope and approves the spec.

---

### `/auto-bmad-change-dev <spec>`

Automated brownfield implementation with regression safety. Takes a spec file from `/auto-bmad-change-spec`.

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/bmad-testarch-automate` | Regression mode: lock down existing behavior BEFORE changing anything (TEA) |
| 2 | `/bmad-testarch-atdd` | Write failing tests for new behavior (TEA) |
| 3 | `/bmad-quick-dev` | Implement the change |
| 4 | Bash (test runner) | Run full test suite — regression + new + existing |
| 5 | `/bmad-review-edge-case-hunter` | Edge-case hunt on the diff |
| 6 | `/bmad-code-review` | Code review — focused on regressions (smart skip for #2) |
| 7 | `/bmad-testarch-trace` | Map change spec criteria to tests to code (TEA) |

**Key difference from `/bmad-quick-dev`:** Steps 1 (regression tests) and 4 (full test suite) are the safety net that quick-dev doesn't provide.

---

## GDS Commands

### `/auto-gds-plan`

| Step | BMAD Skill (GDS module) | Purpose | Skippable |
|------|------------------------|---------|-----------|
| 1 | `/gds-create-game-brief` | Game vision and concept | Yes — if brief or GDD exists |
| 2 | `/gds-create-gdd` | Game Design Document | Yes — if GDD exists |
| 3 | `/gds-create-narrative` | Narrative design and world-building | Yes — if exists or no narrative |
| 4 | `/gds-game-architecture` | Game architecture and engine design | Yes — if exists |
| 5 | `/gds-test-framework` | Game test framework setup | Yes — if configured |
| 6 | `/gds-test-design` | System-level game test scenarios | Yes — if exists |
| 7 | `/gds-generate-project-context` | Generate project context | No — always runs |
| 8 | `/gds-sprint-planning` | Sprint plan from epics | Yes — if exists |

### `/auto-gds-sprint <epic>`

Same structure as BMM sprint but with GDS skills:

**Phase 1: Epic Start**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-test-design` | Epic-level game test design |

**Phase 2: Stories**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-create-story` | Generate story spec |
| 2 | `/gds-create-story validate` | Validate and fix spec |
| 3 | `/bmad-review-adversarial-general` | Adversarial review (core skill) |
| 4 | `/gds-dev-story` | Implement |
| 5 | `/bmad-review-edge-case-hunter` | Edge-case hunt (core skill) |
| 6 | `/gds-code-review` | Code review #1 |
| 7 | `/gds-code-review` | Code review #2 (skipped if #1 clean) |
| 8 | `/gds-code-review` | Code review #3 (skipped if #2 clean) |
| 9 | `/gds-performance-test` | Game performance assessment |
| 10 | `/gds-test-automate` | Expand game test coverage |
| 11 | `/gds-test-review` | Test quality review |

**Phase 3: Epic End**

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-retrospective` | Retrospective with action items |
| 2 | `/gds-generate-project-context` | Refresh project context |

### `/auto-gds-story <id>`

Same 11 steps as GDS sprint Phase 2, standalone with its own report.

### `/auto-gds-epic-start <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-test-design` | Epic-level game test design |

### `/auto-gds-epic-end <epic>`

| Step | BMAD Skill | Purpose |
|------|-----------|---------|
| 1 | `/gds-retrospective` | Retrospective with action items |
| 2 | `/gds-generate-project-context` | Refresh project context |

---

## BMAD Module Dependencies

| auto-bmad Command | Requires |
|-------------------|----------|
| `/auto-bmad-plan` | BMAD-METHOD + TEA |
| `/auto-bmad-sprint` | BMAD-METHOD + TEA |
| `/auto-bmad-story` | BMAD-METHOD + TEA |
| `/auto-bmad-epic-start` | BMAD-METHOD + TEA |
| `/auto-bmad-epic-end` | BMAD-METHOD + TEA |
| `/auto-bmad-wds` | BMAD-METHOD + WDS |
| `/auto-bmad-change-spec` | BMAD-METHOD |
| `/auto-bmad-change-dev` | BMAD-METHOD + TEA |
| `/auto-gds-plan` | BMAD-METHOD + GDS |
| `/auto-gds-sprint` | BMAD-METHOD + GDS |
| `/auto-gds-story` | BMAD-METHOD + GDS |
| `/auto-gds-epic-start` | BMAD-METHOD + GDS |
| `/auto-gds-epic-end` | BMAD-METHOD + GDS |
