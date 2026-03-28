#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Remove legacy module directories from _bmad/ after config migration.

After merge-config.py and merge-help-csv.py have migrated config data and
deleted individual legacy files, this script removes the now-redundant
directory trees. These directories contain skill files that are already
installed at .claude/skills/ (or equivalent) — only the config files at
_bmad/ root need to persist.

When --skills-dir is provided, the script verifies that every skill found
in the legacy directories exists at the installed location before removing
anything. Directories without skills (like _config/) are removed directly.

Exit codes: 0=success (including nothing to remove), 1=validation error, 2=runtime error
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Remove legacy module directories from _bmad/ after config migration."
    )
    parser.add_argument("--bmad-dir", required=True, help="Path to the _bmad/ directory")
    parser.add_argument("--module-code", required=True, help="Module code being cleaned up")
    parser.add_argument("--also-remove", action="append", default=[],
                        help="Additional directory names under _bmad/ to remove (repeatable)")
    parser.add_argument("--skills-dir",
                        help="Path to .claude/skills/ — enables safety verification")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def find_skill_dirs(base_path: str) -> list:
    skills = []
    root = Path(base_path)
    if not root.exists():
        return skills
    for skill_md in root.rglob("SKILL.md"):
        skills.append(skill_md.parent.name)
    return sorted(set(skills))


def verify_skills_installed(bmad_dir: str, dirs_to_check: list, skills_dir: str, verbose: bool = False) -> list:
    all_verified = []
    missing = []

    for dirname in dirs_to_check:
        legacy_path = Path(bmad_dir) / dirname
        if not legacy_path.exists():
            continue

        skill_names = find_skill_dirs(str(legacy_path))
        if not skill_names:
            if verbose:
                print(f"No skills found in {dirname}/ — skipping verification", file=sys.stderr)
            continue

        for skill_name in skill_names:
            installed_path = Path(skills_dir) / skill_name
            if installed_path.is_dir():
                all_verified.append(skill_name)
                if verbose:
                    print(f"Verified: {skill_name} exists at {installed_path}", file=sys.stderr)
            else:
                missing.append(skill_name)

    if missing:
        error_result = {
            "status": "error",
            "error": "Skills not found at installed location",
            "missing_skills": missing,
            "skills_dir": str(Path(skills_dir).resolve()),
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

    return sorted(set(all_verified))


def count_files(path: Path) -> int:
    return sum(1 for item in path.rglob("*") if item.is_file())


def cleanup_directories(bmad_dir: str, dirs_to_remove: list, verbose: bool = False) -> tuple:
    removed = []
    not_found = []
    total_files = 0

    for dirname in dirs_to_remove:
        target = Path(bmad_dir) / dirname
        if not target.exists():
            not_found.append(dirname)
            continue
        if not target.is_dir():
            not_found.append(dirname)
            continue

        file_count = count_files(target)
        if verbose:
            print(f"Removing {target} ({file_count} files)", file=sys.stderr)

        try:
            shutil.rmtree(target)
        except OSError as e:
            error_result = {
                "status": "error",
                "error": f"Failed to remove {target}: {e}",
                "directories_removed": removed,
            }
            print(json.dumps(error_result, indent=2))
            sys.exit(2)

        removed.append(dirname)
        total_files += file_count

    return removed, not_found, total_files


def main():
    args = parse_args()

    dirs_to_remove = [args.module_code, "core"] + args.also_remove
    seen = set()
    unique_dirs = []
    for d in dirs_to_remove:
        if d not in seen:
            seen.add(d)
            unique_dirs.append(d)
    dirs_to_remove = unique_dirs

    verified_skills = None
    if args.skills_dir:
        verified_skills = verify_skills_installed(
            args.bmad_dir, dirs_to_remove, args.skills_dir, args.verbose
        )

    removed, not_found, total_files = cleanup_directories(args.bmad_dir, dirs_to_remove, args.verbose)

    result = {
        "status": "success",
        "bmad_dir": str(Path(args.bmad_dir).resolve()),
        "directories_removed": removed,
        "directories_not_found": not_found,
        "files_removed_count": total_files,
        "safety_checks": {
            "skills_verified": True,
            "skills_dir": str(Path(args.skills_dir).resolve()),
            "verified_skills": verified_skills,
        } if args.skills_dir else None,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
