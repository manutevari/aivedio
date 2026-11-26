# AIVEDIO Python Agent Service

This is the first Python-first migration slice: FastAPI owns the internal agent orchestration API, LangGraph owns stateful workflow control, PostgreSQL stores durable graph checkpoints, and LangSmith provides opt-in tracing. The existing public Fastify API, React UI, database schema, and media services remain in place during the strangler migration.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string. Required for durable readiness and graph execution.
- `AIVEDIO_INTERNAL_API_TOKEN`: high-entropy service-to-service bearer token. Never expose it to browsers or Streamlit.
- `OPENROUTER_API_KEY`: server-side model credential.
- `OPENROUTER_AGENT_MODEL`: optional; defaults to `openrouter/auto`.
- `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`: optional tracing. Tracing is disabled by default.

## Routes

- `GET /health`: process liveness only.
- `GET /ready`: confirms database/checkpointer initialization and required configuration.
- `POST /internal/v1/agent-runs`: starts a graph execution; requires internal bearer auth and a caller-provided unique `thread_id`.
- `POST /internal/v1/agent-runs/{thread_id}/decision`: resumes a paused graph with explicit approve/reject decision; requires internal bearer auth.

The graph runs Improvisor → Implementation → Patcher → Auditor. A failed audit can route back to Patcher for a bounded repair cycle. A passing audit reaches a LangGraph `interrupt()` approval gate. It does not apply a patch to the application database, merge code, or deploy anything. The caller must persist and enforce its own user identity, project authorization, approval audit trail, and permitted side effects.

## Local development

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[test]"
uvicorn app.main:app --reload --port 8000
pytest -q
```

This service is intentionally internal-only. Do not route public browser traffic directly to it. Do not deploy or cut over production until the caller integration, authorization matrix, checkpoint recovery, and regression suite have passed independent review.
