# AIVEDIO FastAPI Cloud adapter

This is a thin reverse-proxy adapter. The authoritative API remains the existing Fastify/TypeScript service; this adapter does not reimplement auth, authorization, business logic, or persistence.

## FastAPI Cloud configuration

- App/root directory: `apps/fastapi-adapter`
- Entrypoint: `app.main:app` (explicitly configured in `pyproject.toml`)
- Required secret/environment variable: `AIVEDIO_UPSTREAM_API_URL` = base URL of the deployed Fastify API (no trailing slash)
- Optional: `AIVEDIO_PROXY_TIMEOUT_SECONDS` (default 30)

Do not set the upstream to the WordPress website or to this adapter's own URL. Do not deploy with an empty upstream; readiness intentionally returns 503.

## Routes

- `GET /health`: adapter process health only
- `GET /ready`: readiness check against upstream `/ready`
- All other HTTP methods and paths: pass-through proxy; request body, query, and Authorization header are forwarded.

## Local checks

From this directory:

```bash
python -m pip install -r requirements.txt
python -m pip install pytest pytest-asyncio
pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI Cloud logs should show an explicit app entrypoint resolving to `app.main:app`. Configure the upstream secret only after the Fastify API URL is verified healthy. This adapter is not a replacement for the API and must not be deployed to production until tests and end-to-end auth/ownership checks pass.
