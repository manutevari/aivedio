# AIVEDIO Full-System Audit — 2026-11-24

## Scope and method
Read-only source review of current `main` (commit `8a1c777d5be89e50b40affa9c98ac8b5507dd665), repository structure, API/auth/agent modules, Streamlit and React entry points, migrations, deployment configuration, GitHub Actions workflow history, and phase audit documents. The WordPress site is external to this repository and was not independently verified in this pass. Runtime/E2E tests were not executed by this audit.

## Executive status
- **P0 — API deployment/connectivity: BLOCKED / NOT VERIFIED.** Recent Vercel deployments failed; deployment quota was exhausted. API health/readiness is not verified.
- **P0 — CI: FAILING before tests run.** Current GitHub Actions run `45266181607` failed in `pnpm/action-setup@v4`; all subsequent checks were skipped. Workflow pins PNPM 10.34.9 while root `package.json` declares `pnpm@10.26.1` and Vercel install configuration uses 10.26.1.
- **P0 — readiness UX: false-positive risk.** Streamlit currently calls `/health` for connectivity. `/health` is process-level and does not prove DB connectivity; `/ready` performs `SELECT 1`.
- **P1 — authorization: incomplete route/resource matrix.** Existing preHandler performs project-role checks and direct resource ownership checks for assets, generation jobs, render jobs, scenes, subtitles, timeline tracks/clips and workflow runs. Existing phase docs explicitly leave nested child-ID ownership validation and exhaustive negative tests outstanding. Continue testing plan/package/cut/audio/report/cue child IDs and mismatched parent IDs.
- **P1 — rate limiting is process-local.** Auth limiter is in-memory, bounded, and not shared across serverless instances. It is not sufficient as a production abuse-control boundary; trusted-proxy/IP handling also needs verification.
- **P1 — worker authority.** Worker transitions/checkpoints are admin-restricted; docs mark a dedicated worker credential/role as outstanding. Avoid using admin tokens as worker credentials.
- **P1 — secrets/deployment.** Provider keys belong only on API runtime. Validate Vercel environment-variable inventory, secret strength, origin allow-list, DB role privileges, SSO/protection, and no secret leakage in logs before release.
- **P1 — account recovery.** Password reset implementation uses hashed, single-use 30-minute tokens and revokes sessions; email delivery is best-effort and errors are swallowed after generic response. Confirm frontend consumes the reset URL/query token and verify deliverability/configuration in a safe test.
- **P1 — agent HITL.** Pipeline is LangChain/OpenRouter and LangSmith traceable, creates an awaiting-approval record, uses auditor gates (pass, score >=60, no critical finding), and applies a brief patch via compare-and-swap. It does not execute code. Verify negative approval/apply tests, concurrency, prompt injection, output schema bounds, trace redaction and API-key configuration.
- **P1 — video provider execution.** Inspected provider module validates descriptors/routes and creates generation jobs in `awaiting_approval`; this audit has not established a working production provider adapter/executor, durable queue, or real media-generation E2E. Treat generation as not production-proven.
- **P1 — database security.** App-layer authorization is the current main boundary. No RLS policies were observed in inspected migrations; verify deployment DB role is least-privilege, ensure backups/restore and migrations are reviewed, and add defense-in-depth where appropriate.
- **P2 — CI quality gaps.** API/web lint scripts are placeholders (“Linting not configured yet”). Add real lint/static analysis, dependency audit, secret scanning, coverage thresholds, and matrix checks. Current workflow includes build, typecheck, disposable Postgres migrations, agent validation, auth security, API E2E, Python syntax and worker requirements checks, but none ran in latest failure.
- **P2 — frontend session handling.** React stores bearer session in browser `sessionStorage`; mitigate XSS with CSP, no unsafe HTML, dependency review, and avoid exposing sensitive data. Confirm expiry handling/logout revocation.
- **P2 — CORS/headers.** Exact-origin allow-list validation and basic security headers exist; CSP and hosting-origin headers remain a documented task. Check production proxy/header behavior and preflight.
- **P2 — Streamlit configuration.** API URL should be HTTPS origin/base path, not a frontend WordPress route. Secrets must be server-side only. Improve readiness diagnostics and test auth flows.
- **P2 — WordPress.** No WordPress integration source in this repository. Audit plugin/theme/embedding/security separately; do not place API keys or bearer tokens in WordPress page code.
- **P2 — E2E.** Test suite exists, but latest CI failure occurred before tests. Runtime tests must be green before preview deployment.

## Confirmed quick fixes prepared in this branch
1. Align CI PNPM with the repository/Vercel pin (10.26.1).
2. Change Streamlit connectivity indicators to use API `/ready` rather than `/health`, so database readiness is tested.

## Release gates
1. CI green on the audit branch.
2. API build + container health + database readiness verified.
3. Authentication E2E: bootstrap, register policy, login, logout, forgot/reset, expired/reused token, disabled user, rate limits.
4. Authorization E2E: exhaustive route/resource matrix; cross-project IDs for nested children; viewer/reviewer/editor/owner/admin permissions; global endpoints; workflow worker boundary.
5. Agent pipeline E2E: audit fail/critical/score threshold blocks approval; rejected runs cannot apply; approved patch applies once; stale brief CAS fails; HITL identity is server-bound.
6. Provider/media pipeline: real provider adapter, queue/lease recovery, retry/idempotency, safe outputs, technical QA + safety review + human release.
7. Observability: LangSmith opt-in, redact secrets/PII, correlation IDs, failure alerts; verify tracing not leaking prompts or user data.
8. Preview-only deployment and smoke test. No production deploy, live migration, or secret changes without explicit approval.

## Severity convention
- P0: release blocker / immediate availability or false readiness.
- P1: security, correctness, or production-readiness risk.
- P2: important hardening/quality work.
- P3: polish/documentation.

## Audit limitation
This is a source/configuration audit with evidence from the current branch and CI/deployment metadata. It is not a penetration test, does not prove the live service is secure, and does not replace runtime verification.
