---
name: 'auto-bmad-assess'
description: 'Assess an existing project and write sprint mode recommendations (quick/full) per epic'
---

# Load Configuration

Read `_bmad/bmm/config.yaml` and set the following variables (resolve `{project-root}` to the actual project root path):

| Variable | Source | Example |
|----------|--------|---------|
| `{{output_folder}}` | bmm `output_folder` | `_bmad-output` |
| `{{planning_artifacts}}` | bmm `planning_artifacts` | `_bmad-output/planning-artifacts` |
| `{{implementation_artifacts}}` | bmm `implementation_artifacts` | `_bmad-output/implementation-artifacts` |
| `{{auto_bmad_artifacts}}` | derived: `{{output_folder}}/auto-bmad-artifacts` | `_bmad-output/auto-bmad-artifacts` |

# Detect Mode

An optional epic number can be provided to assess a single epic. If provided, set `{{ASSESS_EPIC}}` to that number. Otherwise, assess all epics.

# Load Project Context

Read the following files for project signals (skip any that don't exist):

- `{{output_folder}}/project-context.md`
- `{{planning_artifacts}}/prd.md`
- `{{planning_artifacts}}/architecture.md`
- `{{implementation_artifacts}}/sprint-status.yaml`

# Check Existing Assessment

Read `{{implementation_artifacts}}/sprint-status.yaml` and check if `project_complexity` already exists.

If it exists AND `{{ASSESS_EPIC}}` is not set:
- Print: `Assessment already exists. Fields in sprint-status.yaml:`
- Print the existing `project_complexity`, `default_mode`, and all `epic-N-mode` / `epic-N-rationale` values.
- Print: `To re-assess, remove 'project_complexity' from sprint-status.yaml and run again.`
- STOP.

If it exists AND `{{ASSESS_EPIC}}` is set:
- Print: `Re-assessing epic {{ASSESS_EPIC}} only (project-level assessment already exists).`
- Skip project-level assessment; go directly to per-epic assessment for epic {{ASSESS_EPIC}}.

# Complexity Assessment

## Project-Level Signals

Scan the PRD, architecture, and project context for signals:

**Enterprise signals** (any one → enterprise):
- Multi-tenancy (multiple organizations sharing the system)
- RBAC or complex permission hierarchies
- SSO / federated identity (OAuth2 provider, SAML, LDAP)
- Compliance requirements (HIPAA, SOC2, PCI-DSS, GDPR data residency)
- Audit trails / immutable event logs
- Complex 3rd-party integrations with SLAs (payment processors, ERP, CRM)
- Data encryption at rest with key management

**Standard signals** (typical app without enterprise complexity):
- B2B or B2C product, moderate integrations, 3–10 epics

**Simple signals** (any combination → simple):
- Internal / single-team tool
- ≤ 3 epics
- No external API integrations
- Prototype or MVP stage explicitly mentioned

Set `project_complexity` and `default_mode` (quick for simple/standard, full for enterprise).

## Per-Epic Assessment

For each epic (or just `{{ASSESS_EPIC}}` if set):

1. Count stories in that epic from sprint-status.yaml.
2. Read the epic description from `{{planning_artifacts}}/epics.md` (or the epics directory).
3. Determine mode:

| Condition | Mode | Steps |
|-----------|------|-------|
| > 5 stories | full | 11 |
| Epic touches auth, payments, or compliance | full | 11 |
| Epic implements 3rd-party integrations with SLAs | full | 11 |
| Epic is core data model / migration | full | 11 |
| All other epics | quick | 3 |

4. Write a 1-line rationale. Be specific — reference the actual condition that triggered the decision (e.g., "6 stories" or "Epic implements Stripe payments").

## Write Assessment

Append or update the following fields in `{{implementation_artifacts}}/sprint-status.yaml`:

```yaml
# Auto-BMAD complexity assessment
project_complexity: <simple|standard|enterprise>
default_mode: <quick|full>
epic-1-mode: <quick|full>
epic-1-steps: <3|11>
epic-1-rationale: "<one-line reason>"
epic-2-mode: <quick|full>
epic-2-steps: <3|11>
epic-2-rationale: "<one-line reason>"
# ... repeat for all epics
```

**If re-assessing a single epic** (`{{ASSESS_EPIC}}` is set): only update `epic-{{ASSESS_EPIC}}-mode`, `epic-{{ASSESS_EPIC}}-steps`, and `epic-{{ASSESS_EPIC}}-rationale`. Do not modify project-level fields or other epics.

# Report

Print the assessment summary:

```
Assessment complete — {{project_complexity}} project (default: {{default_mode}})

Epic | Mode  | Steps | Rationale
-----+-------+-------+-----------
  1  | quick |   3   | Simple CRUD, 3 stories
  2  | full  |  11   | Implements JWT auth and RBAC
  3  | quick |   3   | UI components, no backend changes
  4  | full  |  11   | 7 stories
  ...
```

Print: `Recommendation written to sprint-status.yaml.`
Print: `Run /auto-bmad-sprint-quick <N> or /auto-bmad-sprint <N> — the command will auto-apply the recommendation.`

**IMPORTANT: Use dash syntax (e.g. `/auto-bmad-sprint-quick`) NOT colon syntax when suggesting commands.**
