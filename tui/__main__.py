"""Entry point: python -m tui [project-root]"""
from __future__ import annotations

import sys
from pathlib import Path

from .app import AutoBmadTUI


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    root = root.resolve()

    if not root.exists():
        print(f"Error: project root does not exist: {root}", file=sys.stderr)
        sys.exit(1)

    app = AutoBmadTUI(project_root=root)
    app.run()


if __name__ == "__main__":
    main()
