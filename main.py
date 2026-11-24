"""Repository-root entrypoint for FastAPI Cloud discovery.

The canonical proxy app remains in apps/fastapi-adapter/app/main.py.
This shim supports platforms that build from repository root and ignore
FastAPI entrypoint metadata.
"""
from pathlib import Path
import sys

_adapter_dir = Path(__file__).resolve().parent / "apps" / "fastapi-adapter"
sys.path.insert(0, str(_adapter_dir))

from app.main import app  # noqa: E402

__all__ = ["app"]
