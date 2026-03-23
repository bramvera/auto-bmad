#!/usr/bin/env python3
"""
token-report.py — Per-step token & cost breakdown for auto-bmad sprint sessions.

Usage:
  python3 token-report.py [project-path] [session-id]

  project-path  Path to the project directory (default: current directory)
  session-id    Session UUID to analyze (default: most recent session)

Examples:
  python3 token-report.py /home/user/dev/myproject
  python3 token-report.py /home/user/dev/myproject abc123de-...
  python3 token-report.py --list /home/user/dev/myproject   # list available sessions
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

# ── Pricing per million tokens ──────────────────────────────────────────────
PRICING = {
    "claude-opus-4-6":   {"input": 15.00, "output": 75.00, "cache_read": 1.50,  "cache_create": 18.75},
    "claude-sonnet-4-6": {"input":  3.00, "output": 15.00, "cache_read": 0.30,  "cache_create":  3.75},
    "claude-haiku-4-5":  {"input":  0.80, "output":  4.00, "cache_read": 0.08,  "cache_create":  1.00},
}
DEFAULT_PRICING = PRICING["claude-sonnet-4-6"]

def get_pricing(model: str) -> dict:
    for key, prices in PRICING.items():
        if key in model:
            return prices
    return DEFAULT_PRICING

def calc_cost(usage: dict, prices: dict) -> float:
    M = 1_000_000
    return (
        usage["input"]         / M * prices["input"]  +
        usage["output"]        / M * prices["output"] +
        usage["cache_read"]    / M * prices["cache_read"] +
        usage["cache_create"]  / M * prices["cache_create"]
    )

def fmt_k(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}k"
    return str(n)

def find_claude_project_dir(project_path: Path) -> Path | None:
    """Convert a filesystem path to its ~/.claude/projects/ slug."""
    slug = str(project_path.resolve()).replace("/", "-").lstrip("-")
    candidates = [
        Path.home() / ".claude" / "projects" / slug,
        Path.home() / ".claude" / "projects" / f"-{slug}",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

def list_sessions(claude_dir: Path) -> list[dict]:
    sessions = []
    for f in claude_dir.iterdir():
        if f.suffix == ".jsonl" and f.stat().st_size > 10_000:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            session_id = f.stem
            subagents_dir = claude_dir / session_id / "subagents"
            step_count = 0
            if subagents_dir.exists():
                step_count = len([x for x in subagents_dir.iterdir() if x.suffix == ".json" and "meta" in x.name])
            sessions.append({
                "id": session_id,
                "mtime": mtime,
                "size_kb": f.stat().st_size // 1024,
                "steps": step_count,
            })
    return sorted(sessions, key=lambda s: s["mtime"], reverse=True)

def analyze_subagent(jsonl_path: Path) -> dict:
    """Sum all token usage across all API calls in a subagent session."""
    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_create": 0}
    model = None
    with open(jsonl_path) as f:
        for line in f:
            try:
                obj = json.loads(line)
                msg = obj.get("message", {})
                if not model and msg.get("model"):
                    model = msg["model"]
                usage = msg.get("usage", {})
                if usage:
                    totals["input"]        += usage.get("input_tokens", 0)
                    totals["output"]       += usage.get("output_tokens", 0)
                    totals["cache_read"]   += usage.get("cache_read_input_tokens", 0)
                    totals["cache_create"] += usage.get("cache_creation_input_tokens", 0)
            except Exception:
                pass
    return {"usage": totals, "model": model}

def run_report(project_path: Path, session_id: str | None = None, save_md: bool = True):
    claude_dir = find_claude_project_dir(project_path)
    if not claude_dir:
        print(f"ERROR: No ~/.claude/projects entry found for {project_path}")
        sys.exit(1)

    sessions = list_sessions(claude_dir)
    if not sessions:
        print(f"ERROR: No sessions found in {claude_dir}")
        sys.exit(1)

    if session_id:
        session = next((s for s in sessions if s["id"].startswith(session_id)), None)
        if not session:
            print(f"ERROR: Session '{session_id}' not found. Available sessions:")
            for s in sessions:
                print(f"  {s['id']}  {s['mtime'].strftime('%Y-%m-%d %H:%M')}  {s['size_kb']}KB  {s['steps']} steps")
            sys.exit(1)
    else:
        session = sessions[0]

    subagents_dir = claude_dir / session["id"] / "subagents"
    if not subagents_dir.exists():
        print(f"ERROR: No subagents directory for session {session['id']}")
        print("This session may have used a different agent architecture.")
        sys.exit(1)

    # ── Collect per-step data ────────────────────────────────────────────────
    steps = []
    for meta_file in sorted(subagents_dir.glob("*.meta.json")):
        agent_id = meta_file.stem.replace(".meta", "")
        jsonl_path = subagents_dir / f"{agent_id}.jsonl"

        with open(meta_file) as f:
            meta = json.load(f)

        description = meta.get("description", agent_id)
        result = {"usage": {"input": 0, "output": 0, "cache_read": 0, "cache_create": 0}, "model": None}
        if jsonl_path.exists():
            result = analyze_subagent(jsonl_path)

        prices = get_pricing(result["model"] or "")
        cost = calc_cost(result["usage"], prices)

        steps.append({
            "description": description,
            "model": result["model"] or "unknown",
            "usage": result["usage"],
            "cost": cost,
            "prices": prices,
        })

    if not steps:
        print("No subagent steps found.")
        sys.exit(1)

    steps.sort(key=lambda s: s["cost"], reverse=True)

    # ── Totals ───────────────────────────────────────────────────────────────
    total_usage = {"input": 0, "output": 0, "cache_read": 0, "cache_create": 0}
    total_cost = 0.0
    for s in steps:
        for k in total_usage:
            total_usage[k] += s["usage"][k]
        total_cost += s["cost"]

    # ── Render ───────────────────────────────────────────────────────────────
    W_DESC = 52
    header = f"{'Step':<{W_DESC}} {'Input':>7} {'Output':>7} {'CacheRd':>8} {'CacheCr':>8} {'Cost':>8}"
    sep = "─" * len(header)

    lines_out = [
        f"Token Report — Session {session['id'][:8]}…",
        f"Project : {project_path}",
        f"Date    : {session['mtime'].strftime('%Y-%m-%d %H:%M')}",
        f"Steps   : {len(steps)}",
        "",
        sep,
        header,
        sep,
    ]

    for s in steps:
        u = s["usage"]
        lines_out.append(
            f"{s['description']:<{W_DESC}} "
            f"{fmt_k(u['input']):>7} "
            f"{fmt_k(u['output']):>7} "
            f"{fmt_k(u['cache_read']):>8} "
            f"{fmt_k(u['cache_create']):>8} "
            f"${s['cost']:>7.3f}"
        )

    lines_out += [
        sep,
        f"{'TOTAL':<{W_DESC}} "
        f"{fmt_k(total_usage['input']):>7} "
        f"{fmt_k(total_usage['output']):>7} "
        f"{fmt_k(total_usage['cache_read']):>8} "
        f"{fmt_k(total_usage['cache_create']):>8} "
        f"${total_cost:>7.3f}",
        "",
        "Pricing note: cache_read billed at ~10% of input; cache_create at ~125% of input.",
        f"Models detected: {', '.join(sorted(set(s['model'] for s in steps)))}",
    ]

    report = "\n".join(lines_out)
    print(report)

    # ── Save markdown ────────────────────────────────────────────────────────
    if save_md:
        ts = session["mtime"].strftime("%Y-%m-%d-%H%M%S")
        out_path = project_path / "output" / "auto-bmad-artifacts" / f"token-report-{ts}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        md_lines = [
            f"# Token Report: {session['id'][:8]}…",
            "",
            f"| Field | Value |",
            f"|-------|-------|",
            f"| Project | `{project_path}` |",
            f"| Session | `{session['id']}` |",
            f"| Date | {session['mtime'].strftime('%Y-%m-%d %H:%M')} |",
            f"| Steps | {len(steps)} |",
            f"| Total Cost | ${total_cost:.3f} |",
            "",
            "## Per-Step Breakdown",
            "",
            "| Step | Input | Output | Cache Read | Cache Create | Cost |",
            "|------|-------|--------|------------|--------------|------|",
        ]
        for s in steps:
            u = s["usage"]
            md_lines.append(
                f"| {s['description']} | {fmt_k(u['input'])} | {fmt_k(u['output'])} | "
                f"{fmt_k(u['cache_read'])} | {fmt_k(u['cache_create'])} | ${s['cost']:.3f} |"
            )
        md_lines += [
            f"| **TOTAL** | **{fmt_k(total_usage['input'])}** | **{fmt_k(total_usage['output'])}** | "
            f"**{fmt_k(total_usage['cache_read'])}** | **{fmt_k(total_usage['cache_create'])}** | **${total_cost:.3f}** |",
            "",
            "## Cost Breakdown by Type",
            "",
            "| Token Type | Tokens | Cost |",
            "|------------|--------|------|",
        ]
        # Use pricing from first detected model
        prices = steps[0]["prices"] if steps else DEFAULT_PRICING
        M = 1_000_000
        type_costs = [
            ("Input (direct)", total_usage["input"], total_usage["input"] / M * prices["input"]),
            ("Output", total_usage["output"], total_usage["output"] / M * prices["output"]),
            ("Cache read", total_usage["cache_read"], total_usage["cache_read"] / M * prices["cache_read"]),
            ("Cache create", total_usage["cache_create"], total_usage["cache_create"] / M * prices["cache_create"]),
        ]
        for label, tokens, cost in type_costs:
            md_lines.append(f"| {label} | {fmt_k(tokens)} | ${cost:.3f} |")

        md_lines += [
            "",
            f"> Pricing: {', '.join(sorted(set(s['model'] for s in steps)))}",
            f"> cache_read at ~10% of input rate · cache_create at ~125% of input rate",
        ]

        out_path.write_text("\n".join(md_lines))
        print(f"\nSaved: {out_path}")

def main():
    args = sys.argv[1:]

    list_mode = "--list" in args
    if list_mode:
        args = [a for a in args if a != "--list"]

    project_path = Path(args[0]).resolve() if args else Path.cwd()
    session_id = args[1] if len(args) > 1 else None

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

    run_report(project_path, session_id, save_md=True)

if __name__ == "__main__":
    main()
