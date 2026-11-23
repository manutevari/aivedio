"""Repository-root FastAPI Cloud discovery shim for the AIVEDIO adapter.

Supports deployments configured at repository root as well as
apps/fastapi-adapter. Keep the canonical app implementation in the adapter.
"""
from pathlib import Path
import sys

_adapter_dir = Path(__file__).resolve().parent / "apps" / "fastapi-adapter"
sys.path.insert(0, str(_adapter_dir))

from app.main import app  # noqa: E402

__all__ = ["app"]
