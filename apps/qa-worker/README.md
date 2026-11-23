# AIVEDIO QA Worker

This is a long-running PostgreSQL queue polling worker, not a serverless HTTP function. Deploy as a container/background worker on a host that supports persistent processes.

Build from repository root:
```bash
docker build -f Dockerfile.qa-worker -t aivedio-qa-worker .
docker run --rm --env-file qa-worker.env -v /path/to/media:/app/media aivedio-qa-worker
```

Required: `DATABASE_URL`, `MEDIA_ROOT` (default /app/media). Optional: `QA_WORKER_POLL_SECONDS`, `QA_WORKER_ID`.

Do not run migrations from worker startup. Use a least-privilege DB role. Ensure media storage is shared/consistent with the API. Do not test with production jobs until worker health, lease, retry and persistence are verified. Safety classifier is currently explicitly unavailable and HITL review is required.
