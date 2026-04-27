---
name: auto-bmad-check
description: "Read-only Auto-BMAD capability check. Use when the user asks whether Auto-BMAD can run, what modes are available, or whether TEA/GDS is required."
---

# Auto-BMAD Check

Run a read-only capability check. Do not create, modify, delete, migrate, or commit files.

Quick mode is the baseline success path:

- Missing TEA is not an issue for BMM quick mode.
- Missing GDS is not an issue for normal BMM projects.
- Missing optional modules should be reported as optional capability gaps, not failures.

Run from the project root:

```bash
CHECK_SCRIPT=""
for candidate in \
  "./scripts/check-auto-bmad.mjs" \
  "../auto-bmad/scripts/check-auto-bmad.mjs" \
  "$HOME/dev/auto-bmad/auto-bmad/scripts/check-auto-bmad.mjs"
do
  if [ -f "$candidate" ]; then CHECK_SCRIPT="$candidate"; break; fi
done
if [ -z "$CHECK_SCRIPT" ]; then
  for root in "$HOME/.codex" "$HOME/.agents/plugins" "$HOME/.claude/plugins/cache"; do
    if [ -d "$root" ]; then
      CHECK_SCRIPT="$(find "$root" -path '*/auto-bmad*/scripts/check-auto-bmad.mjs' 2>/dev/null | sort | tail -1)"
      if [ -n "$CHECK_SCRIPT" ]; then break; fi
    fi
  done
fi
if [ -z "$CHECK_SCRIPT" ]; then
  echo "Auto-BMAD check script not found. Reinstall or update the auto-bmad plugin."
  exit 2
fi
node "$CHECK_SCRIPT" --project-root .
```

Print the output exactly. If it reports `Issues: none for quick mode`, the project can run BMM quick mode.
