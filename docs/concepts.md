# Concepts

Auto-BMAD is a pipeline runner for BMAD. It calls existing BMAD skills in sequence with the right arguments, git checkpoints, retry rules, reports, and resume state.

It is not a replacement for the interactive BMAD analysis process. You still bring product judgment, domain knowledge, and final review.

## This Is Not Vibe Coding

Auto-BMAD runs a structured software development lifecycle. Every story goes through defined phases with quality gates.

| | Vibe coding | BMAD + Auto-BMAD |
|---|---|---|
| Planning | "Build me an app" | PRD, architecture, UX specs, epics, acceptance criteria |
| Testing | Maybe at the end | Code review per story in quick mode; ATDD, E2E, and traceability in full mode |
| Code review | None | Up to 3 reviews per story plus adversarial review in full mode |
| Traceability | None | Requirements to tests to code mapping in full mode |
| Failure handling | Start over or manually fix | Retry, rollback to checkpoint, resume from last good state |
| Quality gates | Hope | 3 checkpoints in quick mode or 10 checkpoints in full mode |

## Where It Fits in BMAD

[BMAD](https://github.com/bmad-code-org/BMAD-METHOD) is an agile methodology with agents for each role. Auto-BMAD automates the execution phase.

```text
INTERACTIVE: you + AI                 AUTOMATED: Auto-BMAD

Brainstorming                         Story creation
Domain research                       Test-driven development
Product discovery          handoff    Adversarial review
PRD review                 ------->   Edge-case hunting
Architecture review                   Traceability mapping
Party-mode debates                    Sprint reports
```

Analysis and planning are meant to be interactive for serious projects. Automating them can be useful, but it may hide product assumptions you would catch through review.

## What You Gain and What You Trade

| What you gain | What you trade |
|---|---|
| Hours of unattended execution | No human review between stories |
| Consistent quality gates | Token cost |
| Crash-proof resumable sprints | Less flexibility than manual BMAD skill calls |
| Automatic rollback on failure | Interactive BMAD skills cannot run mid-sprint |

## BMAD Skill Compatibility

Auto-BMAD only orchestrates skills that can run headlessly.

| Skill | Works in Auto-BMAD? | Reason |
|---|---|---|
| `/bmad-create-story` | Yes | Produces story files from epics without interaction |
| `/bmad-dev-story` | Yes | Implements from spec and halts on blockers |
| `/bmad-code-review` | Yes | Reviews and fixes issues autonomously |
| `/bmad-qa-generate-e2e-tests` | Yes | Generates tests from implemented features |
| `/bmad-testarch-atdd` | Yes | Writes failing tests from acceptance criteria |
| `/bmad-checkpoint-preview` | No | Requires human walkthrough at each review stop |
| `/bmad-create-story:validate` | No | Standalone validation is interactive or uncertified for unattended runs |
| `/bmad-party-mode` | No | Multi-agent debate needs human moderation |
| WDS skills | No | Interactive Figma and design workflows |

New BMAD releases may add skills that are interactive by design. Those belong in manual planning, not unattended Auto-BMAD pipelines.

## Quick Mode vs Full Mode

| | Quick Mode | Full Mode |
|---|---|---|
| Per story | Create, develop, code review | Create, adversarial review, ATDD, develop, edge-case hunt, 3x review, trace, automate |
| Epic end | Retrospective | Trace, NFR, test review, retrospective, context refresh |
| BMAD modules | BMAD-METHOD only | BMAD-METHOD + TEA |
| Testing approach | Review and existing project tests | TDD and traceability with TEA |
| Duration per story | ~25-35 min | ~60-90 min |
| Tokens per story | ~60-80k | ~150-200k |
| Best for | Prototypes, familiar domains, solo devs, tight token budgets | Production systems, complex domains, brownfield risk, regulated environments |

Use quick mode first unless the project clearly needs full traceability and heavier test architecture.

## Workflow Phases

| Phase | Human or Auto? | Why |
|-------|----------------|-----|
| Analysis | Human-driven | Collaborative discovery. The AI asks questions; you provide domain knowledge |
| Planning | Either | Automation can create good drafts, but human review catches assumptions |
| Execution | Automated | Stories are well-defined and execution is mechanical |

Recommended analysis skills for manual discovery:

```text
/bmad-brainstorming
/bmad-party-mode
/bmad-domain-research
/bmad-market-research
/bmad-product-brief
```

Execution commands:

```text
# Quick mode: 3 steps per story, no TEA
/auto-bmad-sprint-quick 1

# Full mode: 10 steps per story, TEA required for BMM
/auto-bmad-sprint 1
```
