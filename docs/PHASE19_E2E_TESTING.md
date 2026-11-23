# Phase 19 — Deterministic End-to-End Integration Testing

## Scope
This phase adds an isolated database-backed API smoke test. It exercises the API and persisted production workflow without paid model/provider calls or production infrastructure.

## Test flow
1. Start the API against a disposable PostgreSQL database.
2. Verify health/readiness and bearer-token protection.
3. Create a project and creative plan; approve the plan through the API.
4. Seed a deterministic screenplay fixture with plan-matched scene and shot IDs; approve through the API.
5. Seed CI-only media assets with fixture provenance, approved generation safety state, and passing technical QA.
6. Compile a production cut with explicit shot-to-asset assignments; verify readiness.
7. Apply the cut through the API; verify clips and timeline manifest.
8. Create an audio production plan and verify incomplete/unreviewed audio cannot pass human approval.
9. Snapshot the timeline into a render job; verify queued renders cannot be delivered.
10. Verify failed QA blocks review; set fixture QA to pass and verify human approval completes the delivery lifecycle.

## Migration runner
`apps/api/scripts/migrate.ts` applies ordered SQL migrations transactionally and records SHA-256 checksums in `aivedio_schema_migrations`. It rejects changes to already-applied migrations. The runner is intended for controlled environments and CI; production migration execution remains an operator-approved action.

## CI
GitHub Actions provisions a PostgreSQL 16 service, applies migrations to the disposable database, runs the API smoke test, then runs the existing typecheck/build/Python checks.

## Honest limitations
- Media and provider results are synthetic CI fixtures.
- No OpenRouter/Tavily or paid provider calls are made.
- FFmpeg rendering is not executed by this API smoke test.
- The render review lifecycle is tested with fixture worker-result fields, not a real worker.
- This does not validate browser UI, Streamlit UI, real storage, authentication roles, ownership authorization, or production deployment.
- No production database was touched and no deployment was made.

## CI verification
The corrected smoke test passed on commit `3602cf5c04df6113716b5859314f97fec70320bb`. The GitHub Actions job completed all steps: typecheck, build, migrations, API E2E smoke, Python syntax and Streamlit dependency checks.
