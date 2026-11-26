# Python-first + LangGraph migration plan

## Scope of this branch

This branch introduces an isolated Python agent-orchestration service. It does not yet replace the Fastify API, authentication system, public routes, TypeScript domain services, media workers, or React frontend. It is an incremental strangler migration, not a completed full-stack rewrite.

## Target architecture

- React/Vite remains the user-facing studio.
- FastAPI becomes the target primary backend/API over staged migration.
- LangGraph orchestrates stateful agent workflows.
- LangGraph PostgreSQL checkpointer stores resumable graph state.
- LangSmith provides opt-in tracing and evaluation.
- PostgreSQL remains the system-of-record database.
- Python media workers are consolidated over time; existing Node workers remain until feature parity and regression tests are demonstrated.
- Existing Fastify endpoints remain authoritative until each route has a tested Python replacement and explicit cutover approval.

## Current implementation slice

`apps/python-api` contains:
- FastAPI liveness/readiness and internal authenticated orchestration endpoints.
- LangGraph nodes: Improvisor, Implementation Agent, Patcher, Auditor.
- Conditional bounded repair routing.
- LangGraph interrupt/resume approval gate.
- PostgreSQL checkpointer setup.
- OpenRouter-compatible LangChain model client.
- Optional LangSmith tracing through supported environment configuration.
- Tests for readiness, internal authentication, audit routing, retry bounds, and critical findings.

## Security and correctness boundaries

- This is an internal service. Never expose its internal token to browser/Streamlit clients.
- The current caller must enforce project membership/ownership and bind user identity to the authenticated session; request-supplied user/project IDs are not authorization proof.
- Human approval identity must be authenticated by the trusted caller, not accepted from an untrusted browser payload.
- The graph proposes a creative brief patch only. It does not write application tables, perform media generation, merge code, or deploy.
- LangGraph checkpoint persistence is separate from application business records and approval audit logs.
- LangSmith tracing is opt-in. Review prompt/output redaction, retention and workspace access before enabling it for personal or confidential content.

## Required next migration phases

1. CI, dependency and graph tests; verify actual PostgreSQL checkpoint/resume behavior.
2. Add trusted service-to-service authentication and caller-side project authorization integration.
3. Port existing auth/session/RBAC and project API contracts without weakening semantics.
4. Port domain services and migration strategy while preserving existing data.
5. Move workers selectively after parity tests.
6. Shadow-compare Python and TypeScript outputs.
7. Preview deployment and end-to-end security/regression review.
8. Production cutover only after explicit owner approval; preserve rollback to current Fastify API.

## Non-goals

- No production deployment, migration, secret changes, merge, or destructive schema changes from this branch.
- No claim that introducing LangGraph fixes unrelated Vercel quota, build, networking, or configuration failures.
