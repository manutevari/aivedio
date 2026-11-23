# QA Worker deployment RCA/CAPA

## Root cause
QA worker runs an infinite PostgreSQL polling loop. Vercel Functions are request/response serverless execution, not suitable for a persistent queue poller. The Vercel project also installs the full PNPM workspace, triggering unrelated npm registry fetch failures before Python worker execution.

## Corrective action
Deploy as a dedicated container/background worker using `Dockerfile.qa-worker` from repository root. Keep it separate from Vercel frontend/API projects.

## Preventive controls
- Store DATABASE_URL only in worker-host secrets.
- No migrations on startup.
- Persist/mount media and align MEDIA_ROOT with API storage.
- Use least-privilege DB role.
- Validate leases/retries and test with a non-production test job before live queue consumption.

## Verification gate
Container build, worker startup, DB connection, safe polling, test job processing, persistence, lease recovery and retry behavior must all pass before CAPA closure.
