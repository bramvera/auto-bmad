#!/usr/bin/env python3
"""
token-report.py — Per-step token & cost breakdown for auto-bmad sprint sessions.

Usage:
  python3 token-report.py [project-path] [session-id]
  python3 token-report.py --list   [project-path]       # list available sessions
  python3 token-report.py --all    [project-path]       # aggregate all sessions

  project-path  Path to the project directory (default: current directory)
  session-id    Session UUID to analyze (default: most recent session)

Examples:
  python3 token-report.py /home/user/dev/myproject
  python3 token-report.py /home/user/dev/myproject abc123de-...
  python3 token-report.py --list /home/user/dev/myproject
  python3 token-report.py --all  /home/user/dev/myproject
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from datetime import datetime

# ── Pricing (verified 2026-03-23 from platform.claude.com/docs/en/about-claude/pricing)
# Columns: input, output, cache_read, cache_write_5m, cache_write_1h  (all per MTok)
# cache_write_5m = 1.25x base input
# cache_write_1h = 2.0x base input
# cache_read     = 0.1x base input
# Batch API      = 50% off input + output (cache pricing unchanged)
PRICING = {
    # model id fragment → prices
    "claude-opus-4-6":    dict(input=5.00,   output=25.00,  cache_read=0.50, cache_w5m=6.25,  cache_w1h=10.00),
    "claude-opus-4-5":    dict(input=5.00,   output=25.00,  cache_read=0.50, cache_w5m=6.25,  cache_w1h=10.00),
    "claude-opus-4-1":    dict(input=15.00,  output=75.00,  cache_read=1.50, cache_w5m=18.75, cache_w1h=30.00),
    "claude-opus-4-0":    dict(input=15.00,  output=75.00,  cache_read=1.50, cache_w5m=18.75, cache_w1h=30.00),
    "claude-opus-4":      dict(input=15.00,  output=75.00,  cache_read=1.50, cache_w5m=18.75, cache_w1h=30.00),
    "claude-sonnet-4-6":  dict(input=3.00,   output=15.00,  cache_read=0.30, cache_w5m=3.75,  cache_w1h=6.00),
    "claude-sonnet-4-5":  dict(input=3.00,   output=15.00,  cache_read=0.30, cache_w5m=3.75,  cache_w1h=6.00),
    "claude-sonnet-4-0":  dict(input=3.00,   output=15.00,  cache_read=0.30, cache_w5m=3.75,  cache_w1h=6.00),
    "claude-sonnet-4":    dict(input=3.00,   output=15.00,  cache_read=0.30, cache_w5m=3.75,  cache_w1h=6.00),
    "claude-haiku-4-5":   dict(input=1.00,   output=5.00,   cache_read=0.10, cache_w5m=1.25,  cache_w1h=2.00),
    "claude-haiku-3-5":   dict(input=0.80,   output=4.00,   cache_read=0.08, cache_w5m=1.00,  cache_w1h=1.60),
    "claude-haiku-3":     dict(input=0.25,   output=1.25,   cache_read=0.03, cache_w5m=0.30,  cache_w1h=0.50),
}
# Longest-match wins (more specific keys first)
PRICING_KEYS = sorted(PRICING.keys(), key=len, reverse=True)

# Family fallbacks: if exact model not found, use the latest known price for that family.
# This handles future models (e.g. claude-opus-4-7) gracefully with a warned estimate.
FAMILY_FALLBACK = {
    "opus":   PRICING["claude-opus-4-6"],    # latest opus pricing
    "sonnet": PRICING["claude-sonnet-4-6"],  # latest sonnet pricing
    "haiku":  PRICING["claude-haiku-4-5"],   # latest haiku pricing
}
DEFAULT_PRICING = PRICING["claude-sonnet-4-6"]

BATCH_DISCOUNT = 0.50  # 50% off input + output only; cache pricing unchanged

# Tracks unknown models seen this run so we warn once per model
_unknown_models: set[str] = set()

def get_pricing(model: str) -> tuple[dict, bool]:
    """Return (pricing_dict, is_exact_match).
    Falls back to family pricing for unrecognised models and warns once."""
    m = (model or "").lower()
    for key in PRICING_KEYS:
        if key in m:
            return PRICING[key], True
    # Try family fallback
    for family, prices in FAMILY_FALLBACK.items():
        if family in m:
            if model not in _unknown_models:
                _unknown_models.add(model)
                print(f"  ⚠  Unknown model '{model}' — using {family} family pricing as estimate.")
                print(f"     Update PRICING dict in token-report.py with exact rates.")
            return prices, False
    # Total unknown
    if model not in _unknown_models:
        _unknown_models.add(model)
        print(f"  ⚠  Unrecognised model '{model}' — falling back to Sonnet 4.6 pricing.")
        print(f"     Update PRICING dict in token-report.py with exact rates.")
    return DEFAULT_PRICING, False

def calc_cost(u: dict, p: dict, batch: bool = False) -> float:
    M = 1_000_000
    discount = (1 - BATCH_DISCOUNT) if batch else 1.0
    return (
        u["input"]      / M * p["input"]      * discount +
        u["output"]     / M * p["output"]     * discount +
        u["cache_read"] / M * p["cache_read"] +
        u["cache_w5m"]  / M * p["cache_w5m"] +
        u["cache_w1h"]  / M * p["cache_w1h"]
    )

EMPTY_USAGE = dict(input=0, output=0, cache_read=0, cache_w5m=0, cache_w1h=0)

def add_usage(a: dict, b: dict) -> dict:
    return {k: a[k] + b[k] for k in EMPTY_USAGE}

def fmt_k(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}k"
    return str(n)

def fmt_model(model: str) -> str:
    """Shorten model ID for display."""
    m = model or "unknown"
    m = m.replace("claude-", "")
    return m

# ── Epic/mode detection from step description ────────────────────────────────

FULL_MODE_MARKERS = {"atdd", "edge-case hunt", "traceability", "test automate", "nfr", "test review"}
QUICK_MODE_MARKERS = {"quick"}

def detect_mode(descriptions: list[str]) -> str:
    joined = " ".join(d.lower() for d in descriptions)
    if any(m in joined for m in FULL_MODE_MARKERS):
        return "full"
    if any(m in joined for m in QUICK_MODE_MARKERS):
        return "quick"
    if "wds" in joined:
        return "wds"
    if "plan" in joined:
        return "plan"
    return "unknown"

def extract_epic(description: str) -> str | None:
    """Return 'epic-N' label from a description, or None."""
    m = re.search(r'epic[- ]?(\d+)', description, re.IGNORECASE)
    if m:
        return f"epic-{m.group(1)}"
    m = re.search(r'story[- ]?(\d+)-\d+', description, re.IGNORECASE)
    if m:
        return f"epic-{m.group(1)}"
    return None

# ── Claude project dir resolution ────────────────────────────────────────────

def find_claude_project_dir(project_path: Path) -> Path | None:
    slug = str(project_path.resolve()).replace("/", "-").lstrip("-")
    for candidate in [
        Path.home() / ".claude" / "projects" / slug,
        Path.home() / ".claude" / "projects" / f"-{slug}",
    ]:
        if candidate.exists():
            return candidate
    return None

def list_sessions(claude_dir: Path) -> list[dict]:
    sessions = []
    for f in claude_dir.iterdir():
        if f.suffix != ".jsonl" or f.stat().st_size < 10_000:
            continue
        sid = f.stem
        sub = claude_dir / sid / "subagents"
        step_count = sum(1 for x in sub.glob("*.meta.json")) if sub.exists() else 0
        sessions.append({
            "id": sid,
            "mtime": datetime.fromtimestamp(f.stat().st_mtime),
            "size_kb": f.stat().st_size // 1024,
            "steps": step_count,
        })
    return sorted(sessions, key=lambda s: s["mtime"], reverse=True)

# ── Subagent analysis ─────────────────────────────────────────────────────────

def analyze_subagent(jsonl_path: Path) -> dict:
    """Sum all token usage across all API calls in a subagent session."""
    totals = dict(**EMPTY_USAGE)
    model = None
    with open(jsonl_path) as f:
        for line in f:
            try:
                obj = json.loads(line)
                msg = obj.get("message", {})
                if not model and msg.get("model"):
                    model = msg["model"]
                u = msg.get("usage", {})
                if not u:
                    continue
                totals["input"]      += u.get("input_tokens", 0)
                totals["output"]     += u.get("output_tokens", 0)
                totals["cache_read"] += u.get("cache_read_input_tokens", 0)
                # split cache writes by duration
                cc = u.get("cache_creation", {})
                if cc:
                    totals["cache_w5m"] += cc.get("ephemeral_5m_input_tokens", 0)
                    totals["cache_w1h"] += cc.get("ephemeral_1h_input_tokens", 0)
                else:
                    # fallback: treat all cache creation as 1h
                    totals["cache_w1h"] += u.get("cache_creation_input_tokens", 0)
            except Exception:
                pass
    return {"usage": totals, "model": model}

# ── Report rendering ──────────────────────────────────────────────────────────

def collect_steps(session: dict, claude_dir: Path) -> list[dict]:
    subagents_dir = claude_dir / session["id"] / "subagents"
    if not subagents_dir.exists():
        return []
    steps = []
    for meta_file in sorted(subagents_dir.glob("*.meta.json")):
        agent_id = meta_file.stem.replace(".meta", "")
        jsonl_path = subagents_dir / f"{agent_id}.jsonl"
        with open(meta_file) as f:
            meta = json.load(f)
        description = meta.get("description", agent_id)
        result = {"usage": dict(**EMPTY_USAGE), "model": None}
        if jsonl_path.exists():
            result = analyze_subagent(jsonl_path)
        model = result["model"] or "unknown"
        prices, exact = get_pricing(model)
        steps.append({
            "description": description,
            "model": model,
            "model_exact": exact,
            "usage": result["usage"],
            "cost": calc_cost(result["usage"], prices),
            "cost_batch": calc_cost(result["usage"], prices, batch=True),
            "prices": prices,
            "epic": extract_epic(description),
        })
    return steps

def render_steps_table(steps: list[dict], title: str) -> list[str]:
    W = 48
    header = f"{'Step':<{W}} {'Model':<16} {'Input':>6} {'Out':>6} {'CR':>6} {'CW5m':>6} {'CW1h':>6} {'Cost':>8} {'Batch':>8}"
    sep = "─" * len(header)
    lines = [title, sep, header, sep]

    total_u = dict(**EMPTY_USAGE)
    total_cost = 0.0
    total_batch = 0.0

    for s in sorted(steps, key=lambda x: x["cost"], reverse=True):
        u = s["usage"]
        model_label = fmt_model(s["model"]) + ("" if s.get("model_exact", True) else "~")
        lines.append(
            f"{s['description'][:W]:<{W}} "
            f"{model_label:<16} "
            f"{fmt_k(u['input']):>6} "
            f"{fmt_k(u['output']):>6} "
            f"{fmt_k(u['cache_read']):>6} "
            f"{fmt_k(u['cache_w5m']):>6} "
            f"{fmt_k(u['cache_w1h']):>6} "
            f"${s['cost']:>7.2f} "
            f"${s['cost_batch']:>7.2f}"
        )
        total_u = add_usage(total_u, u)
        total_cost += s["cost"]
        total_batch += s["cost_batch"]

    lines += [
        sep,
        f"{'TOTAL':<{W}} {'':<16} "
        f"{fmt_k(total_u['input']):>6} "
        f"{fmt_k(total_u['output']):>6} "
        f"{fmt_k(total_u['cache_read']):>6} "
        f"{fmt_k(total_u['cache_w5m']):>6} "
        f"{fmt_k(total_u['cache_w1h']):>6} "
        f"${total_cost:>7.2f} "
        f"${total_batch:>7.2f}",
    ]
    return lines, total_u, total_cost, total_batch

def epic_summary(steps: list[dict]) -> list[str]:
    """Group steps by detected epic and show per-epic totals."""
    groups = defaultdict(list)
    for s in steps:
        groups[s["epic"] or "other"].append(s)

    if len(groups) <= 1:
        return []

    lines = ["", "── Per-Epic Breakdown ──────────────────────────────────────────────────────────"]
    header = f"{'Epic':<12} {'Steps':>5} {'Mode':<8} {'Models':<24} {'Cost':>8} {'Batch':>8}"
    lines += [header, "─" * len(header)]

    total_cost = 0.0
    total_batch = 0.0
    for epic in sorted(groups.keys()):
        ss = groups[epic]
        ec = sum(s["cost"] for s in ss)
        eb = sum(s["cost_batch"] for s in ss)
        models = ", ".join(sorted(set(fmt_model(s["model"]) for s in ss)))
        mode = detect_mode([s["description"] for s in ss])
        lines.append(
            f"{epic:<12} {len(ss):>5} {mode:<8} {models:<24} ${ec:>7.2f} ${eb:>7.2f}"
        )
        total_cost += ec
        total_batch += eb

    lines += [
        "─" * len(header),
        f"{'TOTAL':<12} {sum(len(v) for v in groups.values()):>5} {'':<8} {'':<24} ${total_cost:>7.2f} ${total_batch:>7.2f}",
    ]
    return lines

def pricing_note() -> list[str]:
    return [
        "",
        "── Pricing (verified 2026-03-23 · platform.claude.com/docs/en/about-claude/pricing) ─",
        "  CR = Cache Read (0.1x input)  CW5m = Cache Write 5-min (1.25x input)  CW1h = Cache Write 1h (2x input)",
        "  Batch = 50% off input+output only; cache pricing unchanged",
        "  Opus 4.6:   $5/$25 input/output  Sonnet 4.6: $3/$15  Haiku 4.5: $1/$5",
        "  Opus 4.1:   $15/$75 input/output (legacy)",
    ]

def build_markdown(session: dict, steps: list[dict], project_path: Path) -> str:
    mode = detect_mode([s["description"] for s in steps])
    total_u = dict(**EMPTY_USAGE)
    total_cost = 0.0
    total_batch = 0.0
    for s in steps:
        total_u = add_usage(total_u, s["usage"])
        total_cost += s["cost"]
        total_batch += s["cost_batch"]

    models = ", ".join(sorted(set(s["model"] for s in steps)))

    md = [
        f"# Token Report: {session['id'][:8]}…",
        "",
        "| Field | Value |",
        "|-------|-------|",
        f"| Project | `{project_path}` |",
        f"| Session | `{session['id']}` |",
        f"| Date | {session['mtime'].strftime('%Y-%m-%d %H:%M')} |",
        f"| Mode | {mode} |",
        f"| Steps | {len(steps)} |",
        f"| Models | {models} |",
        f"| Standard Cost | **${total_cost:.2f}** |",
        f"| Batch API Cost | ${total_batch:.2f} |",
        "",
        "> Pricing verified 2026-03-23 from platform.claude.com/docs/en/about-claude/pricing",
        "",
        "## Cost by Token Type",
        "",
        "| Type | Tokens | Std Cost | Batch Cost |",
        "|------|--------|----------|------------|",
    ]
    # Use the dominant model's pricing for the breakdown
    dominant_model = max(set(s["model"] for s in steps), key=lambda m: sum(s["cost"] for s in steps if s["model"] == m))
    p, _ = get_pricing(dominant_model)
    M = 1_000_000
    type_rows = [
        ("Input (direct)",    total_u["input"],      total_u["input"]/M*p["input"],               total_u["input"]/M*p["input"]*(1-BATCH_DISCOUNT)),
        ("Output",            total_u["output"],     total_u["output"]/M*p["output"],              total_u["output"]/M*p["output"]*(1-BATCH_DISCOUNT)),
        ("Cache Read",        total_u["cache_read"], total_u["cache_read"]/M*p["cache_read"],      total_u["cache_read"]/M*p["cache_read"]),
        ("Cache Write (5m)",  total_u["cache_w5m"],  total_u["cache_w5m"]/M*p["cache_w5m"],       total_u["cache_w5m"]/M*p["cache_w5m"]),
        ("Cache Write (1h)",  total_u["cache_w1h"],  total_u["cache_w1h"]/M*p["cache_w1h"],       total_u["cache_w1h"]/M*p["cache_w1h"]),
    ]
    for label, tokens, std, batch in type_rows:
        md.append(f"| {label} | {fmt_k(tokens)} | ${std:.2f} | ${batch:.2f} |")

    # Per-epic table
    groups = defaultdict(list)
    for s in steps:
        groups[s["epic"] or "other"].append(s)

    if len(groups) > 1:
        md += [
            "",
            "## Per-Epic Breakdown",
            "",
            "| Epic | Steps | Mode | Models | Std Cost | Batch Cost |",
            "|------|-------|------|--------|----------|------------|",
        ]
        for epic in sorted(groups.keys()):
            ss = groups[epic]
            ec = sum(s["cost"] for s in ss)
            eb = sum(s["cost_batch"] for s in ss)
            emodels = ", ".join(sorted(set(fmt_model(s["model"]) for s in ss)))
            emode = detect_mode([s["description"] for s in ss])
            md.append(f"| {epic} | {len(ss)} | {emode} | {emodels} | ${ec:.2f} | ${eb:.2f} |")

    md += [
        "",
        "## Per-Step Breakdown",
        "",
        "| Step | Model | Input | Output | Cache Read | CW 5m | CW 1h | Std Cost | Batch Cost |",
        "|------|-------|-------|--------|------------|-------|-------|----------|------------|",
    ]
    for s in sorted(steps, key=lambda x: x["cost"], reverse=True):
        u = s["usage"]
        md.append(
            f"| {s['description']} | {fmt_model(s['model'])} | {fmt_k(u['input'])} | {fmt_k(u['output'])} | "
            f"{fmt_k(u['cache_read'])} | {fmt_k(u['cache_w5m'])} | {fmt_k(u['cache_w1h'])} | "
            f"${s['cost']:.2f} | ${s['cost_batch']:.2f} |"
        )
    md.append(
        f"| **TOTAL** | | **{fmt_k(total_u['input'])}** | **{fmt_k(total_u['output'])}** | "
        f"**{fmt_k(total_u['cache_read'])}** | **{fmt_k(total_u['cache_w5m'])}** | **{fmt_k(total_u['cache_w1h'])}** | "
        f"**${total_cost:.2f}** | **${total_batch:.2f}** |"
    )
    return "\n".join(md)

# ── Entry points ──────────────────────────────────────────────────────────────

def run_report(project_path: Path, session_id: str | None, save_md: bool = True):
    claude_dir = find_claude_project_dir(project_path)
    if not claude_dir:
        print(f"ERROR: No ~/.claude/projects entry found for {project_path}")
        sys.exit(1)

    sessions = list_sessions(claude_dir)
    if not sessions:
        print("ERROR: No sessions found.")
        sys.exit(1)

    if session_id:
        session = next((s for s in sessions if s["id"].startswith(session_id)), None)
        if not session:
            print(f"ERROR: Session '{session_id}' not found.")
            for s in sessions:
                print(f"  {s['id']}  {s['mtime'].strftime('%Y-%m-%d %H:%M')}  {s['steps']} steps")
            sys.exit(1)
    else:
        session = sessions[0]

    steps = collect_steps(session, claude_dir)
    if not steps:
        print(f"ERROR: No subagent steps found for session {session['id']}")
        sys.exit(1)

    mode = detect_mode([s["description"] for s in steps])
    models = ", ".join(sorted(set(fmt_model(s["model"]) for s in steps)))
    total_cost = sum(s["cost"] for s in steps)
    total_batch = sum(s["cost_batch"] for s in steps)

    header_lines = [
        f"Token Report — {session['id'][:8]}…  [{session['mtime'].strftime('%Y-%m-%d %H:%M')}]",
        f"Project : {project_path}",
        f"Mode    : {mode}   Steps: {len(steps)}   Models: {models}",
        f"Cost    : ${total_cost:.2f} standard  /  ${total_batch:.2f} batch API",
    ]
    for l in header_lines:
        print(l)

    table_lines, _, _, _ = render_steps_table(steps, "")
    for l in table_lines[1:]:  # skip the empty title line
        print(l)

    for l in epic_summary(steps):
        print(l)

    for l in pricing_note():
        print(l)

    if save_md:
        ts = session["mtime"].strftime("%Y-%m-%d-%H%M%S")
        out_path = project_path / "output" / "auto-bmad-artifacts" / f"token-report-{ts}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(build_markdown(session, steps, project_path))
        print(f"\nSaved: {out_path}")

def run_all(project_path: Path, save_md: bool = True):
    claude_dir = find_claude_project_dir(project_path)
    if not claude_dir:
        print(f"ERROR: No ~/.claude/projects entry found for {project_path}")
        sys.exit(1)

    sessions = list_sessions(claude_dir)
    all_rows = []
    grand_u = dict(**EMPTY_USAGE)
    grand_cost = 0.0
    grand_batch = 0.0

    for session in reversed(sessions):  # chronological
        steps = collect_steps(session, claude_dir)
        if not steps:
            continue
        sc = sum(s["cost"] for s in steps)
        sb = sum(s["cost_batch"] for s in steps)
        su = dict(**EMPTY_USAGE)
        for s in steps:
            su = add_usage(su, s["usage"])
        mode = detect_mode([s["description"] for s in steps])
        models = "/".join(sorted(set(fmt_model(s["model"]) for s in steps)))
        grand_u = add_usage(grand_u, su)
        grand_cost += sc
        grand_batch += sb
        all_rows.append((session["mtime"].strftime("%Y-%m-%d %H:%M"), session["id"][:8], len(steps), mode, models, sc, sb))

    W = 18
    header = f"{'Date':<{W}} {'Session':>10} {'Steps':>6} {'Mode':<8} {'Models':<22} {'Cost':>9} {'Batch':>9}"
    sep = "─" * len(header)
    print(f"\nAll Sessions — {project_path}")
    print(sep)
    print(header)
    print(sep)
    for dt, sid, steps, mode, models, cost, batch in all_rows:
        print(f"{dt:<{W}} {sid:>10} {steps:>6} {mode:<8} {models:<22} ${cost:>8.2f} ${batch:>8.2f}")
    print(sep)
    print(f"{'GRAND TOTAL':<{W+10}} {sum(r[2] for r in all_rows):>6} {'':<8} {'':<22} ${grand_cost:>8.2f} ${grand_batch:>8.2f}")
    print()
    print(f"  Input:       {fmt_k(grand_u['input'])}  |  Output:     {fmt_k(grand_u['output'])}")
    print(f"  Cache Read:  {fmt_k(grand_u['cache_read'])}  |  CW 5m:      {fmt_k(grand_u['cache_w5m'])}  |  CW 1h: {fmt_k(grand_u['cache_w1h'])}")
    print()
    print(f"  Max plan ($200/mo):  {grand_cost/200:.1f}x value  /  {grand_batch/200:.1f}x value (batch equivalent)")

    for l in pricing_note():
        print(l)

    if save_md:
        ts = datetime.now().strftime("%Y-%m-%d-%H%M%S")
        out_path = project_path / "output" / "auto-bmad-artifacts" / f"token-report-all-{ts}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        md = [
            "# Token Report — All Sessions",
            "",
            f"| Field | Value |",
            f"|-------|-------|",
            f"| Project | `{project_path}` |",
            f"| Generated | {datetime.now().strftime('%Y-%m-%d %H:%M')} |",
            f"| Sessions | {len(all_rows)} |",
            f"| Total Steps | {sum(r[2] for r in all_rows)} |",
            f"| Standard Cost | **${grand_cost:.2f}** |",
            f"| Batch API Cost | ${grand_batch:.2f} |",
            f"| Max plan ROI | {grand_cost/200:.1f}x ({grand_batch/200:.1f}x batch equivalent) |",
            "",
            "> Pricing verified 2026-03-23 from platform.claude.com/docs/en/about-claude/pricing",
            "",
            "## Session Breakdown",
            "",
            "| Date | Session | Steps | Mode | Models | Std Cost | Batch Cost |",
            "|------|---------|-------|------|--------|----------|------------|",
        ]
        for dt, sid, steps, mode, models, cost, batch in all_rows:
            md.append(f"| {dt} | {sid}… | {steps} | {mode} | {models} | ${cost:.2f} | ${batch:.2f} |")
        md += [
            f"| **TOTAL** | | **{sum(r[2] for r in all_rows)}** | | | **${grand_cost:.2f}** | **${grand_batch:.2f}** |",
        ]
        out_path.write_text("\n".join(md))
        print(f"\nSaved: {out_path}")

def main():
    args = sys.argv[1:]

    list_mode = "--list" in args
    all_mode  = "--all"  in args
    args = [a for a in args if a not in ("--list", "--all")]

    project_path = Path(args[0]).resolve() if args else Path.cwd()
    session_id   = args[1] if len(args) > 1 else None

    claude_dir = find_claude_project_dir(project_path)
    if not claude_dir:
        print(f"ERROR: No ~/.claude/projects entry found for {project_path}")
        sys.exit(1)

    if list_mode:
        sessions = list_sessions(claude_dir)
        print(f"Sessions for {project_path}:")
        print(f"{'Session ID':<40} {'Date':<18} {'Size':>8} {'Steps':>6}")
        print("─" * 76)
        for s in sessions:
            print(f"{s['id']:<40} {s['mtime'].strftime('%Y-%m-%d %H:%M'):<18} {s['size_kb']:>6}KB {s['steps']:>6}")
        return

    if all_mode:
        run_all(project_path)
        return

    run_report(project_path, session_id)

if __name__ == "__main__":
    main()
