---
description: "Install or update auto-bmad module config and help entries"
---

# auto-bmad Setup

Install or update the auto-bmad module for this project. Collects project preferences, writes `_bmad/config.yaml`, and registers all `/auto-bmad-*` commands in `_bmad/module-help.csv`.

## Activation

When the user runs `/auto-bmad-setup` or asks to set up or configure auto-bmad:

1. Load the module definition from `./assets/module.yaml`
2. Detect installation state
3. Collect answers
4. Write config files via Python scripts
5. Show the module greeting

---

## Step 1 — Load Module Definition

Read `./assets/module.yaml` to get the module code (`abm`), version, prompts, and defaults.

---

## Step 2 — Detect Installation State

Check `{project-root}/_bmad/config.yaml`:

- **Not found** → fresh install. Greet the user: *"Setting up auto-bmad for the first time."*
- **Found, no `abm` section** → first-time module add to existing BMAD project. Mention existing config will be preserved.
- **Found, `abm` section exists** → update/reconfigure. Show current values as defaults. Say: *"auto-bmad is already configured. You can keep existing values or change them."*

Also check for legacy config at `{project-root}/_bmad/bmm/config.yaml`. If found, values will be migrated as fallback defaults.

---

## Step 3 — Collect Answers

Read all variables with a `prompt` field from `./assets/module.yaml`. For each variable:

- Show the prompt
- Show the default value (from existing config if update, else from module.yaml default)
- For `single-select` variables: show the options and let the user pick
- Accept the user's answer or confirm they want to keep the default

**Resolution order for defaults:**
1. Existing value in `_bmad/config.yaml` under `abm` section
2. Legacy value from `_bmad/bmm/config.yaml` (if present)
3. Default from `module.yaml`

**Variables to collect:**

| Variable | What to ask |
|---|---|
| `auto_bmad_artifacts` | Where auto-bmad stores token reports and pipeline artifacts |
| `tea_enabled` | Is TEA installed? (true/false) |
| `gds_enabled` | Is GDS/BMGD installed? (true/false) |
| `default_mode` | Default pipeline mode: quick or full |

For `tea_enabled`: if the user says yes, note that `/auto-bmad-sprint` (full 11-step) is now available. If no, only `/auto-bmad-sprint-quick` (3-step) is available.

After collecting all answers, confirm with the user before writing.

---

## Step 4 — Write Config Files

Build a JSON answers file and run the Python scripts in order.

### 4a. Build answers JSON

```json
{
  "module": {
    "auto_bmad_artifacts": "<user answer>",
    "tea_enabled": "<true|false>",
    "gds_enabled": "<true|false>",
    "default_mode": "<quick|full>"
  }
}
```

Write this to a temp file, e.g. `{project-root}/_bmad/.abm-answers.json`.

### 4b. Run merge-config.py

```bash
python3 ./scripts/merge-config.py \
  --config-path "{project-root}/_bmad/config.yaml" \
  --user-config-path "{project-root}/_bmad/config.user.yaml" \
  --module-yaml "./assets/module.yaml" \
  --answers "{project-root}/_bmad/.abm-answers.json" \
  --legacy-dir "{project-root}/_bmad"
```

Check exit code. If non-zero, report the error and stop.

### 4c. Run merge-help-csv.py

```bash
python3 ./scripts/merge-help-csv.py \
  --target "{project-root}/_bmad/module-help.csv" \
  --source "./assets/module-help.csv" \
  --legacy-dir "{project-root}/_bmad" \
  --module-code "abm"
```

Check exit code. If non-zero, report the error and stop.

### 4d. Create artifact directory

Create the `auto_bmad_artifacts` directory on disk if it doesn't exist.

### 4e. Clean up temp file

Delete `{project-root}/_bmad/.abm-answers.json`.

---

## Step 5 — Show Greeting

On success, display the `module_greeting` from `./assets/module.yaml`, substituting the user's configured values where relevant.

Then show a summary:

```
✓ auto-bmad v1.0.0 configured
  Pipeline artifacts:  {auto_bmad_artifacts}
  TEA:                 {tea_enabled}
  GDS:                 {gds_enabled}
  Default mode:        {default_mode}
  Commands registered: 15 entries in _bmad/module-help.csv
```

If `tea_enabled` is false, add a note:
> Quick mode active — run `/auto-bmad-sprint-quick N` to start.
> When TEA is installed, re-run `/auto-bmad-setup` to enable the full 11-step pipeline.

---

## Error Handling

- If `_bmad/` directory does not exist: create it, then proceed.
- If Python 3 is not available: tell the user to install Python 3.9+ and re-run.
- If `pyyaml` is missing: run `pip install pyyaml` and retry once.
- If any script exits non-zero: show the error output and stop. Do not write partial state.

---

## Headless Mode (`--yes` flag)

If the user passes `--yes` or `-y`, skip all prompts and use defaults from:
1. Existing config (if update)
2. module.yaml defaults (if fresh install)

Write config without confirmation.
