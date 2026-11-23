# Phase 23 — Agent pipeline, HITL and account recovery

## Agent pipeline
- Improvisor generates improvement ideas and assumptions.
- Implementation Agent turns selected direction into staged implementation plan, requirements, risks and rollback.
- Patcher creates a constrained **creative brief** patch (not code).
- Independent Auditor evaluates the patch and plan.
- Results persist as `agent_pipeline_runs`; status starts `awaiting_approval`.
- Human decision is a separate endpoint; patch application is a separate endpoint.
- Auditor fail, score < 60, or critical finding blocks approval/application.
- Apply uses compare-and-swap on the current creative brief to prevent overwriting newer project changes.
- Apply and audit-history writes occur in a transaction.

## Endpoints
- `POST /v1/projects/:id/agent-pipeline/runs`
- `GET /v1/projects/:id/agent-pipeline/runs`
- `GET /v1/projects/:id/agent-pipeline/runs/:runId`
- `POST /v1/projects/:id/agent-pipeline/runs/:runId/decision` with `approve|reject`
- `POST /v1/projects/:id/agent-pipeline/runs/:runId/apply`

All endpoints require an authenticated session and project membership/role authorization.

## Authentication
- Registration: `POST /v1/auth/register` (controlled by `AIVEDIO_ALLOW_SELF_REGISTRATION`)
- Forgot password: `POST /v1/auth/forgot-password` (generic response)
- Reset password: `POST /v1/auth/reset-password`
- Reset tokens are hashed, expire after 30 minutes, are single-use, and reset revokes active sessions.
- Reset and registration endpoints are rate-limited.
- Email delivery uses Resend.

## Required environment configuration
API deployment:
- `OPENROUTER_API_KEY`
- `OPENROUTER_AGENT_MODEL` (optional)
- `RESEND_API_KEY`
- `AIVEDIO_EMAIL_FROM`
- `AIVEDIO_SESSION_SECRET` (>= 32 chars)
- `AIVEDIO_BOOTSTRAP_ADMIN_KEY` (>= 32 chars)
- `AIVEDIO_ALLOW_SELF_REGISTRATION`
- `AIVEDIO_ALLOWED_ORIGINS`
- `AIVEDIO_WEB_URL` / `AIVEDIO_SITE_URL`

Streamlit secrets only need the API URL:
```toml
AIVEDIO_API_URL = "https://your-api-host.example"
```
Provider keys belong only on the API server.

## HITL guarantees and limitations
- This agent pipeline does not execute code or change files; it only proposes a creative-brief patch.
- Human approval is explicit, followed by explicit Apply.
- This is not a substitute for a security review, tests, or deployment approval.
- CI must be green before preview deployment. Production deployment and live migrations require separate approval.
