# Phase 18 — Integration & Release Readiness Audit

## Scope
This phase is a source-level hardening and CI setup. It does not deploy, apply migrations, or provision secrets.

## Fixes committed
- Repair literal escaped newlines that made API imports/routes and several modules invalid TypeScript.
- Normalize API imports at the top of the module.
- Remove the public render-job transition route; render state changes remain worker/review-controlled.
- Add optional API bearer-token protection using constant-time comparison. Production startup fails closed if `AIVEDIO_API_TOKEN` is missing.
- Add configurable CORS allowlist (`AIVEDIO_ALLOWED_ORIGINS`) and OPTIONS support.
- Include audio clips in the render manifest duration calculation.
- Harden render worker media resolution against symlinks escaping `MEDIA_ROOT`.
- Recover expired render leases when their lease timestamp is missing or stale.
- Add GitHub Actions CI for pnpm typecheck/build and Python syntax/requirements checks.

## Required configuration
- `DATABASE_URL`: PostgreSQL connection string.
- `MEDIA_ROOT`: root for input media.
- `RENDER_OUTPUT_ROOT`: render output root.
- `AIVEDIO_API_TOKEN`: shared bearer token for internal API clients. In production, required by the API process.
- `AIVEDIO_ALLOWED_ORIGINS`: comma-separated exact origins; defaults to local React and Streamlit origins.

**Important:** the shared API token is not suitable for embedding in a public browser bundle. A public web deployment must use a server-side proxy or proper user authentication/session authorization. The current React client is not yet wired to a secure auth/session service. Keep the API behind a trusted gateway until that work is completed. Streamlit can send the token from server-side environment configuration.

## Verification
- Source was inspected and modified through GitHub branch operations.
- The CI workflow is added but its run result is pending.
- No local pnpm install/build/typecheck was run in this chat environment.
- No database migration was applied.
- No production deployment was made.

## Remaining release blockers
1. CI run must pass and errors be fixed.
2. Auth/session model and role-based reviewer permissions; reviewer name supplied by UI is not proof of identity.
3. API project/asset ownership authorization and endpoint validation review.
4. Migration runner and migration execution rehearsal on a disposable database.
5. Worker integration test with real FFmpeg/ffprobe and media fixtures.
6. End-to-end workflow test: plan → script → cut → timeline → audio → QA/safety → render → review → delivery.
7. Render limitations: transitions, sidechain ducking, multiple-track compositing semantics, output sidecar persistence, cancellation and retry behavior need full testing.
8. React/Streamlit clients need API error handling, authenticated transport and user-visible state refresh.
9. Storage-provider abstraction and signed/controlled output download.
10. Release deployment, environment validation, monitoring and rollback plan.

## Release decision
**NOT RELEASE READY.** The branch is now better protected and CI has been introduced, but the actual CI run and integration/security test suite are still required before deployment.
