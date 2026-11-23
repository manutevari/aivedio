"""Default FastAPI Cloud entrypoint shim.

FastAPI Cloud deployments that ignore pyproject entrypoint metadata can discover
this file automatically. The canonical app stays in app.main.
"""
from app.main import app

__all__ = ["app"]
