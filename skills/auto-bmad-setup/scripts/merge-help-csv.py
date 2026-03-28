#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Merge module help entries into shared _bmad/module-help.csv.

Reads a source CSV with module help entries and merges them into a target CSV.
Uses an anti-zombie pattern: all existing rows matching the source module code
are removed before appending fresh rows.

Legacy cleanup: when --legacy-dir and --module-code are provided, deletes old
per-module module-help.csv files from {legacy-dir}/{module-code}/ and
{legacy-dir}/core/. Only the current module and core are touched.

Exit codes: 0=success, 1=validation error, 2=runtime error
"""

import argparse
import csv
import json
import sys
from io import StringIO
from pathlib import Path

HEADER = [
    "module",
    "agent-name",
    "skill-name",
    "display-name",
    "menu-code",
    "capability",
    "args",
    "description",
    "phase",
    "after",
    "before",
    "required",
    "output-location",
    "outputs",
    "",  # trailing empty column
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Merge module help entries into shared _bmad/module-help.csv with anti-zombie pattern."
    )
    parser.add_argument("--target", required=True, help="Path to target _bmad/module-help.csv")
    parser.add_argument("--source", required=True, help="Path to source module-help.csv")
    parser.add_argument("--legacy-dir", help="Path to _bmad/ for legacy CSV cleanup")
    parser.add_argument("--module-code", help="Module code (required with --legacy-dir)")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def read_csv_rows(path: str) -> tuple[list[str], list[list[str]]]:
    file_path = Path(path)
    if not file_path.exists():
        return [], []
    with open(file_path, "r", encoding="utf-8", newline="") as f:
        content = f.read()
    reader = csv.reader(StringIO(content))
    rows = list(reader)
    if not rows:
        return [], []
    return rows[0], rows[1:]


def extract_module_codes(rows: list[list[str]]) -> set[str]:
    codes = set()
    for row in rows:
        if row and row[0].strip():
            codes.add(row[0].strip())
    return codes


def filter_rows(rows: list[list[str]], module_code: str) -> list[list[str]]:
    return [row for row in rows if not row or row[0].strip() != module_code]


def write_csv(path: str, header: list[str], rows: list[list[str]], verbose: bool = False) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if verbose:
        print(f"Writing {len(rows)} data rows to {path}", file=sys.stderr)
    with open(file_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)


def cleanup_legacy_csvs(legacy_dir: str, module_code: str, verbose: bool = False) -> list:
    deleted = []
    for subdir in (module_code, "core"):
        legacy_path = Path(legacy_dir) / subdir / "module-help.csv"
        if legacy_path.exists():
            if verbose:
                print(f"Deleting legacy CSV: {legacy_path}", file=sys.stderr)
            legacy_path.unlink()
            deleted.append(str(legacy_path))
    return deleted


def main():
    args = parse_args()

    source_header, source_rows = read_csv_rows(args.source)
    if not source_rows:
        print(f"Error: No data rows found in source {args.source}", file=sys.stderr)
        sys.exit(1)

    source_codes = extract_module_codes(source_rows)
    if not source_codes:
        print("Error: Could not determine module code from source rows", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"Source module codes: {source_codes}", file=sys.stderr)

    target_header, target_rows = read_csv_rows(args.target)
    target_existed = Path(args.target).exists()

    header = target_header if target_header else (source_header if source_header else HEADER)

    filtered_rows = target_rows
    removed_count = 0
    for code in source_codes:
        before_count = len(filtered_rows)
        filtered_rows = filter_rows(filtered_rows, code)
        removed_count += before_count - len(filtered_rows)

    if args.verbose and removed_count > 0:
        print(f"Removed {removed_count} existing rows (anti-zombie)", file=sys.stderr)

    merged_rows = filtered_rows + source_rows
    write_csv(args.target, header, merged_rows, args.verbose)

    legacy_deleted = []
    if args.legacy_dir:
        if not args.module_code:
            print("Error: --module-code is required when --legacy-dir is provided", file=sys.stderr)
            sys.exit(1)
        legacy_deleted = cleanup_legacy_csvs(args.legacy_dir, args.module_code, args.verbose)

    result = {
        "status": "success",
        "target_path": str(Path(args.target).resolve()),
        "target_existed": target_existed,
        "module_codes": sorted(source_codes),
        "rows_removed": removed_count,
        "rows_added": len(source_rows),
        "total_rows": len(merged_rows),
        "legacy_csvs_deleted": legacy_deleted,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
