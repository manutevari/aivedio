# Phase 6 — Media workers and execution

## Execution contract
- A durable PostgreSQL queue is used with row locking and `FOR UPDATE SKIP LOCKED`.
- Only jobs with explicit `safety_status='approved'` are claimable.
- A worker can execute only provider IDs for which reviewed adapter code is registered.
- No arbitrary endpoint is called from provider metadata; this prevents untrusted MCP discovery from becoming an SSRF/credential-exfiltration path.
- Provider credentials belong in server-side environment/secret storage, never browser payloads or provider descriptors.
- Results are persisted as quarantined assets; the quality result does not itself mark assets as publishable.
- Human review remains required before approved assets are made available downstream.

## Worker process
`pnpm --filter @aivedio/worker dev`

Requires `DATABASE_URL`. Configure reviewed provider adapters in worker code before expecting jobs to be processed. No real provider adapters or media APIs are bundled yet.

## Important limitations
- Run migrations 001–005 before using the worker.
- A production media worker needs object-storage integration, provider-specific adapters, content moderation, technical QA, observability, and authentication.
- Current worker code is an execution framework, not proof that media can be generated without configured credentials.
