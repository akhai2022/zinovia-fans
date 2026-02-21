from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

# Suppress all logging to avoid polluting stdout when using --stdout
logging.disable(logging.CRITICAL)
os.environ.setdefault("LOG_LEVEL", "CRITICAL")

from fastapi.openapi.utils import get_openapi

from app.main import app


def main() -> None:
    schema = get_openapi(title=app.title, version="0.1.0", routes=app.routes)
    out = json.dumps(schema, indent=2, sort_keys=True)
    if "--stdout" in sys.argv:
        sys.stdout.write(out)
        return
    root = Path(__file__).resolve().parents[4]
    target = root / "packages" / "contracts" / "openapi.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
