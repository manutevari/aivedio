# AIVEDIO Remediation & Reliability SOP

**Repository:** `manutevari/aivedio`  
**Research date:** 2026-11-26  
**Baseline commit:** `a5d05cba787be22174a042c344436011873669f6`  
**Branch:** `docs/aivedio-remediation-sop`  
**Status:** Controlled remediation plan. This SOP does not authorize production deployment, merge, production migration or live-secret mutation.

## 1. Purpose and principles

This SOP defines the fastest low-risk route to stabilize AIVEDIO builds/deployments, then close reliability and production-readiness gaps identified in the November 2026 audit. It reconciles the uploaded audit documents against the live repository, GitHub Actions results, Vercel project metadata/build logs and current primary documentation.

1. Restore deterministic builds before changing architecture.
2. Make one logical change per branch/commit; avoid bundled infrastructure rewrites.
3. Use real dependencies and runtime tests, not no-op providers or fake success.
4. Keep Fastify authoritative; FastAPI remains an adapter, not a duplicate backend.
5. Fail safely: missing configuration, authorization failures and uncertain moderation must not become silent success.
6. Run durable workers on container/worker infrastructure, not request-scoped Vercel functions.
7. No production release before preview/staging acceptance and explicit approval.

## 2. Executive decision

### Immediate P0 diagnosis

The strongest verified Vercel blocker is the root `vercel.json` install override:

```json
"installCommand": "pnpm install --no-frozen-lockfile"
```

The root `package.json` already declares `"packageManager": "pnpm@10.26.1"`. Vercel documents that a manual install override such as `pnpm install` can select the oldest pnpm version bundled in its build environment instead of respecting the repository's intended Corepack version. The latest Vercel logs show repeated npm registry `ERR_INVALID_THIS` failures across unrelated dependencies, consistent with the wrong package-manager invocation.

**Fastest safe remediation sequence:**

1. In a non-production branch, invoke pnpm through Corepack explicitly: `corepack pnpm install --no-frozen-lockfile`. This should resolve the root packageManager pin.
2. Generate a genuine `pnpm-lock.yaml` with pnpm 10.26.1 from the repository root in a network-enabled workspace environment.
3. Review the generated lockfile and workspace resolution; commit it.
4. Switch Vercel, Docker and GitHub Actions installs to `corepack pnpm install --frozen-lockfile` (or equivalent pinned pnpm invocation).
5. Confirm a clean Vercel preview and complete CI suite before considering production.

Do not hand-author or fabricate a lockfile. Do not enable frozen install until a valid lockfile is committed. Do not downgrade to Node 18. Keep Node 22 for incident stabilization because root engines, CI and current web/API Vercel projects align on 22. Test Node 26 separately after compatibility is demonstrated.

### Deployment-quota decision

The linked Vercel team is on Hobby. Its documented general limit is 100 deployments per day. Five projects are linked to the same repository: `aivedio`, `aivedio-api`, `audio-worker`, `asset-worker`, and `qa-worker`. Recent deployments for all five projects from the same main commit were in ERROR state.

Reduce deployment fan-out immediately:
- Enable Vercel **Skip unaffected projects** for each Git-linked monorepo project.
- Validate Root Directory and workspace dependency relationships.
- Ensure workspace packages have unique names and internal dependencies are explicit in each manifest.
- Avoid using Vercel deployment attempts as the primary CI runner.
- Use GitHub Actions, local/container tests and one controlled preview after correcting the install command.

Do not solve quota exhaustion by repeated retries or production deploys as a workaround. A paid plan is a commercial option, not the technical fix.

## 3. Live repository baseline and audit corrections

Snapshot checked against `main` at `a5d05cba787be22174a042c344436011873669f6`.

| Area | Live evidence | Consequence |
|---|---|---|
| Root package manager | `pnpm@10.26.1` pinned | Retain pnpm; fix Vercel invocation |
| Node | Root engines `>=22 <23`; web/API Vercel projects 22.x | Keep Node 22 for stabilization |
| Lockfile | Root `pnpm-lock.yaml` not found on inspected main | Generate real lockfile before frozen install |
| Vercel install | `vercel.json` forces unlocked direct `pnpm install` | P0 correction |
| Docker build | Corepack prepares pnpm 10.26.1 but install is unlocked | Freeze once lockfile is committed |
| CI | Run #518 on main succeeded; typecheck/build/API container/migrations/security/E2E/adapter checks passed | Extend existing CI |
| FastAPI adapter | Has `/health`, upstream-aware `/ready`, header filtering and tests | Do not reimplement based on stale audit alone |
| API | Fastify authoritative; bearer-session auth and project-role checks exist | Harden current model |
| Streamlit | Uses Streamlit secrets/env for API URL; login errors surfaced; generic `safe()` still suppresses some panel errors | Improve diagnostics |
| Workers | `apps/worker` contains render/media/Sarvam code; Python asset/audio/QA workers exist | Do not invent `apps/render-worker`; deploy actual services |
| Product capability | README says provider registration, object storage/download and safety classifier incomplete | Treat as product/release blockers |
| Vercel plan | Hobby; five linked projects; newest deployments failed | Reduce fan-out; move durable workers off Vercel |

### CI status interpretation

The latest inspected GitHub Actions run #518 for current main completed successfully. It ran dependency installation, typecheck, core regression tests, build, API Docker build/health smoke, disposable PostgreSQL migration test, agent validation, auth security tests, API workflow E2E, FastAPI adapter tests and Python syntax/dependency checks.

CI green does **not** prove production deployment is healthy. Current Vercel project records and build logs show deployment errors. Report CI, preview, production, API readiness and media-job completion as separate statuses.

## 4. Mitigation options and decision matrix

### 4.1 Package manager and Vercel installation

| Option | Speed | Reliability | Risk | Decision |
|---|---:|---:|---|---|
| Keep raw custom `pnpm install` override | High initially | Low | May select old bundled pnpm; ignores repository intent | Reject |
| Explicit `corepack pnpm` using packageManager pin | Very high | High | Unlocked until lockfile exists | Use immediately |
| Commit lockfile then frozen install | High after generation | Very high | Must be generated from real workspace | Required final state |
| Migrate workspace to npm | Medium | Medium | Lockfile/workspace churn without solving root cause | Avoid during incident |
| Migrate to Yarn | Medium | Medium | New toolchain and churn | Reject for now |
| Downgrade to Node 18 | Medium | Low | Node 18 is EOL | Reject |

Target state: one package manager, one committed lockfile, one documented Node line, no contradictory Vercel/CI/Docker install settings.

### 4.2 Runtime hosting

| Workload | Vercel | Container jobs/service | Persistent VM |
|---|---|---|---|
| React/Vite static UI | Excellent | Possible | Overhead |
| Short stateless API | Suitable | Suitable | Suitable |
| Always-on queue polling | Poor fit | Good | Good |
| FFmpeg render | Poor fit for long jobs | Good for bounded jobs | Good for daemon/long jobs |
| GPU inference | Not assumed by current design | Dedicated GPU job/service | Possible, ops-intensive |
| Streamlit | Only if verified | Good | Good |

Recommendation: Vercel for web UI and stateless Fastify endpoints; container-capable execution for workers. Evaluate Cloud Run Jobs for bounded render/analysis tasks that can be retried idempotently. Use a long-running container service or VM for continuous queue consumers and jobs needing persistent processes. Do not adopt Kubernetes until measured scale justifies it.

### 4.3 API framework

Keep Fastify authoritative. Rewriting to FastAPI does not address a pnpm installation defect and adds migration risk. Retain the FastAPI adapter only if the deployment topology needs it. It must not duplicate auth, project ownership, job or persistence logic.

### 4.4 Queue and rate limiting

**Queue:** PostgreSQL persistence and worker queue code already exist. Harden the existing system first:
- Atomic job claiming (e.g. row locks with `SKIP LOCKED`).
- Lease expiry and heartbeat/visibility extension.
- Bounded retries with exponential backoff and jitter.
- Idempotency keys for provider calls and output commits.
- Dead-letter/failed state and replay tooling.
- Stale-job reclamation and graceful worker shutdown.
- Correlation ID and state-transition audit log.

PostgreSQL row locking is a valid moderate-scale starting point. Add SQS or another broker only after measuring database contention, throughput, fan-out, retention and operations. SQS requires correct visibility extension, retries and DLQ; at-least-once delivery is not exactly-once processing.

**Rate limiting:** process-local counters are insufficient for multiple API instances. First inspect current implementation and scaling topology. PostgreSQL atomic counters may suffice for modest single-instance deployment. Use shared Redis/managed rate limiting when horizontal scaling or low-latency central counters justify it. Independently rate-limit login, registration, password reset, upload, provider invocation and expensive generation endpoints. Return 429 and Retry-After.

### 4.5 Storage

Use private S3-compatible object storage. MinIO is useful locally but adds self-hosting operations in production.

Required design:
- Private bucket; public ACLs disabled.
- Random object keys, not user-controlled filesystem paths.
- Authenticated project-ownership checks before issuing presigned URLs.
- Short URL expiry.
- Content type/size allowlists and checksum verification.
- PostgreSQL stores metadata; object store stores binaries.
- Lifecycle/retention and deletion workflows.
- Workers use isolated temporary directories and immutable outputs.
- Parser/FFmpeg resource caps; never interpolate user input into shell commands.

Never expose cloud credentials/provider keys in browser or Streamlit client code.

### 4.6 Safety and moderation

The repository README states safety classification is not connected and currently returns uncertainty. Do not change this to fail open.

Target:
- No configured classifier -> blocked from automatic publication or pending review.
- Unsafe -> blocked.
- Uncertain/model unavailable/timeout -> pending human review; no automatic publication.
- Safe -> passes only after configured policy and technical QA.
- Retain model/policy version, confidence, decision, reviewer and timestamp.
- Test safe, unsafe, borderline, corrupted and provider-timeout inputs.

Human review makes uncertainty operable without weakening safety.

### 4.7 Authentication and API security

The API uses bearer-session authentication and project role checks. Do not replace this with cookies in an isolated change.

First:
- Test token/session entropy, rotation, expiry, logout/revocation and reset workflows.
- Use cryptographically secure secret generation; at least 32 random bytes for new session secrets where applicable.
- Ensure auth failures and service errors fail closed.
- Test cross-project IDOR for nested resources and worker/admin endpoints.
- Use least-privilege worker credentials.
- Audit privileged actions and worker transitions.
- Rate-limit sensitive endpoints.

If browser auth migrates to cookies, use Secure, HttpOnly and SameSite attributes and implement CSRF protection for state-changing requests (synchronizer tokens and/or carefully tested Fetch Metadata + Origin validation). Bearer tokens explicitly supplied in Authorization headers have a different CSRF threat profile; migrate client and API together.

Introduce CSP in report-only mode first, inspect legitimate violations/integrations, then enforce a nonce/hash-based policy. Do not deploy a generic restrictive CSP that breaks the app.

### 4.8 Database controls

- API and worker DB credentials must not be superuser.
- Give API and each worker only required schema/table privileges.
- Prove backups with actual restore drills, not only snapshot creation.
- Test migrations against disposable and staging data before production.
- Consider RLS only after tenant ownership and connection-pool context are modeled. Test all roles and cross-tenant cases. RLS does not protect against superusers or BYPASSRLS roles unless privileges are restricted.
- Keep application authorization tests after RLS is enabled.

## 5. Prioritized implementation plan

### P0 — Build and deployment stabilization

| ID | Change | Files/settings | Acceptance |
|---|---|---|---|
| P0-01 | Invoke pinned pnpm through Corepack | `vercel.json` | Build logs show pnpm 10.26.1; no ERR_INVALID_THIS |
| P0-02 | Generate and commit real lockfile | root `pnpm-lock.yaml` | Clean install succeeds; second install does not change lock |
| P0-03 | Enforce frozen installs | `vercel.json`, Docker, CI | Frozen install succeeds on clean runner |
| P0-04 | Validate Vercel roots and Node | Vercel project settings | Correct roots; Node 22 aligned during stabilization |
| P0-05 | Enable unaffected-project skipping | Vercel monorepo settings | Unchanged projects skipped |
| P0-06 | Stop deploying durable workers as Vercel websites/functions | Worker deployment design | No persistent consumer depends on serverless lifetime |
| P0-07 | One controlled preview | Vercel | UI/API preview READY at intended commit |

Lockfile procedure: run exact pinned pnpm from repository root; inspect workspace resolution; commit generated file. Do not mix lockfiles from incompatible pnpm versions or create partial per-app lockfiles.

### P1 — Core reliability and release safety

| ID | Change | Acceptance |
|---|---|---|
| P1-01 | Queue leases, heartbeats, retries, idempotency, stale-job recovery | Worker restart does not lose or duplicate final output |
| P1-02 | Container deployment for actual worker apps | Test job picked up, completed and logged |
| P1-03 | Provider interface and first real provider | One supported request completes end-to-end with cost/timeout limits |
| P1-04 | Private object storage and ownership-aware presigned URLs | Owner upload/download succeeds; other project denied |
| P1-05 | Safety classifier and human review | Unsafe blocked; uncertain cannot auto-publish |
| P1-06 | Streamlit safe/error handling | API outage visible with generic message and trace ID |
| P1-07 | API/worker least privilege and access-control tests | Cross-project access denied |
| P1-08 | Central rate limits when multi-instance | Limits hold across instances/restarts |
| P1-09 | Backup restore and migration rehearsal | Restore proven; rollback/forward fix documented |
| P1-10 | Logs, metrics and alerts | API readiness, queue age, failed jobs and provider errors visible |

### P2 — Production maturity

- CSP report-only then enforce.
- RLS after tenant model and role tests.
- CodeQL/code scanning, Dependabot for npm, Actions and container dependencies.
- Secret scanning and push protection; rotate exposed credentials.
- Load test API, queue and media paths.
- SLOs and incident response drills.
- Node 26 compatibility branch.
- Evaluate SQS/Redis only against measured needs.

## 6. Detailed change and verification procedure

### Change A — Vercel install command

The immediate branch change should use:

```json
"installCommand": "corepack pnpm install --no-frozen-lockfile"
```

This is an interim unblock, not the final state. After a valid root lockfile is committed, use:

```json
"installCommand": "corepack pnpm install --frozen-lockfile"
```

Alternative: remove the custom override and let Vercel infer package manager from the committed root lockfile/Corepack metadata. Choose based on preview logs. Inspect and remove any conflicting Vercel dashboard install override.

### Change B — Docker and CI lock enforcement

After lockfile exists:
- Docker: `corepack pnpm install --frozen-lockfile`.
- GitHub Actions: use existing package setup and `pnpm install --frozen-lockfile`.
- CI and Vercel must use same Node 22 line and pnpm version.
- Add a check that fails when package manifests and lockfile diverge.

### Change C — Monorepo/Vercel deployment controls

For every linked project, record Root Directory, framework preset, Node version, build command/output directory, install override, include-files-outside-root setting, skip-unaffected setting and production branch.

Verify unique workspace package names and explicit internal workspace dependencies. Vercel skip-unaffected relies on workspace metadata and dependency relationships.

### Change D — FastAPI adapter

Existing `apps/fastapi-adapter/app/main.py` already separates process health from upstream readiness. Test rather than rewrite:
- upstream `/ready` valid JSON with `ready: true`
- upstream 401/403/404/5xx and redirects
- timeout mapping
- compressed response headers match returned body
- binary payload/content type preserved
- Authorization forwarded; hop-by-hop headers removed
- multiple Set-Cookie and cache headers handled
- query strings and request bodies preserved
- request size and timeout limits enforced

If adapter is no longer needed, decommission in a separate PR after confirming no clients depend on it.

### Change E — Workers and generation

Inventory actual worker manifests:
- Node: `apps/worker` (`start`, `render`, `media`).
- Python: `apps/asset-worker`, `apps/audio-worker`, `apps/qa-worker`.

Separate generation provider calls, Sarvam speech/audio tasks, asset analysis/QA and FFmpeg rendering. For every service define queue subscription, concurrency, timeout, memory/CPU, graceful shutdown, health checks, DB roles, storage access, secret inventory and retry policy.

For finite jobs evaluate Cloud Run Jobs. For continuously polling queues deploy a long-running container service/VM with restart policy and graceful termination. Do not schedule general video/image tasks on Sarvam speech worker unless its contract explicitly supports them.

### Change F — Provider and storage contracts

Start with one real generation provider, not a broad registry. Define capabilities/input schema, authentication, idempotency key, submit/poll/cancel/result operations, provider/correlation IDs, timeout/retry classification, cost metadata, safe error mapping, output validation and storage handoff.

For storage, verify project ownership before issuing signed URLs. Keep bucket private, use short expiry and treat user media as untrusted.

### Change G — Safety and QA

Safety must run before public output. Unconfigured or uncertain classifier must remain pending review. Human review must be a state transition with actor, timestamp, reason and audit entry. Technical QA (codec, duration, dimensions, tracks, integrity, captions) is distinct from content moderation.

## 7. Standard Operating Procedure

### 7.1 Before opening a remediation branch

1. Record main SHA, open PRs and latest CI.
2. Record deployment IDs/states/targets/logs for affected Vercel projects.
3. Identify first failed command and exact package-manager/runtime versions.
4. Confirm no production migration/deployment is in progress.
5. Branch from verified main SHA.
6. PR must state scope, hypothesis, evidence, confidence, acceptance tests, rollback and affected projects.

### 7.2 During implementation

1. One logical change per commit.
2. No production secrets or SQL.
3. Run targeted tests, then complete CI.
4. Package changes must prove pinned version and lockfile reproducibility.
5. API/security changes must pass auth, role, cross-project and worker tests.
6. Worker/storage changes use disposable DB and test bucket.
7. Redact secrets and personal data from logs before sharing.
8. Update this SOP when evidence changes the design.

### 7.3 Preview acceptance gate

Accept only when install uses pinned package manager; frozen install leaves lockfile unchanged; typecheck/build/tests pass; intended Vercel project is READY for exact commit; `/health` checks process liveness; `/ready` verifies upstream; auth and cross-project tests pass; no secret is exposed; one representative user journey passes; in-scope worker jobs complete to durable storage; irrelevant projects were not deployed.

### 7.4 Production release gate

Requires explicit owner approval, passing CI and staging, migration dry-run and restore/rollback strategy, least-privilege secret review, change window and rollback owner, smoke tests, and monitoring for errors, latency, queue age, worker failures and storage delivery.

A successful build alone is not a successful release.

### 7.5 Rollback

| Failure | Immediate action |
|---|---|
| Vercel install failure | Revert only install-command change; retain logs; do not blindly change Node |
| Lockfile mismatch | Restore known-good manifest/lockfile pair; regenerate with pinned pnpm |
| Typecheck/build regression | Revert offending commit; never bypass typecheck |
| API readiness regression | Roll back API deployment to last known good; retain health/readiness distinction |
| Migration failure | Stop rollout; use tested forward fix or restore; never delete production data to pass |
| Worker duplicate/lost jobs | Pause consumer; preserve queue rows; recover through lease/idempotency |
| Unsafe output | Disable provider/publication flag; quarantine output; retain moderation logs |
| Storage leak | Revoke/rotate credentials; stop URL issuance; audit access |
| Deployment quota reached | Stop retry loops; use CI/local containers until reset; do not force production deploy |

Rollback should generally revert app deployment, not blindly reverse a database migration after writes. Prefer forward-compatible migrations and proven restore procedures.

## 8. Required test matrix

| Layer | Minimum coverage |
|---|---|
| Package install | Clean, frozen, lock consistency, pinned version |
| Build | Workspace order, Vite, Fastify, Docker |
| API | Health/readiness, timeout, CORS, 4xx/5xx |
| Auth | Login/logout/expiry/reset/brute force/missing secret |
| Authorization | Anonymous/user/editor/reviewer/owner/admin/worker |
| IDOR | User A cannot access or mutate User B resources |
| Queue | Concurrent claim, lease expiry, heartbeat, retry, dead-letter, idempotent replay |
| Provider | Valid/invalid input, timeout, 429, 5xx, duplicate, cancel |
| Storage | Private object, signed URL expiry, ownership, oversize, MIME, checksum |
| Safety | Safe, unsafe, uncertain, timeout, malformed response, review |
| Render | Missing FFmpeg, corrupt input, resource cap, interruption, retry, output validation |
| Observability | Correlation IDs, redaction, readiness/queue/provider alerts |
| Release | Staging smoke, rollback rehearsal, restore validation |

## 9. Initial SLO proposals

These are proposed starting targets, not measured performance. Baseline for 7–14 days before treating as commitments:
- API availability: 99.5% monthly after readiness.
- Ordinary non-generation API p95: below 750 ms.
- Interactive queue age alert: oldest eligible job >5 minutes.
- Worker heartbeat alert: 2 missed intervals.
- Failed jobs alert: sustained >5% over 15 minutes.
- Track provider success, timeout, 429, 5xx and cost per completed generation.
- Track upload/download success, denied access, egress and orphan objects.
- Track uncertain/manual-review rate and classifier outages; never auto-bypass.

## 10. Work-order dependency map

```text
P0 Corepack install -> real lockfile -> frozen installs
                    |
                    v
P0 Vercel roots + skip unaffected projects
                    |
                    v
P0 one controlled preview + API readiness
                    |
                    v
P1 queue reliability + container worker deployment
               /                     \\
              v                       v
P1 real provider              P1 private object storage
              \\                       /
               v                     v
P1 safety classifier + technical QA + human review
                    |
                    v
P1 end-to-end user journey and release gates
                    |
                    v
P2 rate limits, DB hardening, CSP, scanning, load tests, SLOs
```

## 11. Explicitly rejected shortcuts

- Node 18 downgrade (EOL).
- Fastify-to-FastAPI rewrite for pnpm error.
- npm/Yarn migration without evidence.
- Fabricated lockfile.
- Frozen install before correct lockfile exists.
- Repeatedly deploying all five Vercel projects to test one package change.
- Long-running FFmpeg/queue consumers as request-scoped serverless handlers.
- Global SSO disable or unauthenticated API exposure.
- Auto-passing uncertain safety results.
- Adding Redis, SQS, Kubernetes or multiple paid providers before measurements justify them.
- Declaring production-ready from green CI alone.

## 12. Open verification items

| Item | Current conclusion | Follow-up |
|---|---|---|
| Vercel pnpm override | Strongly supported root cause | Preview log must show pnpm 10.26.1 |
| Lockfile | Missing on inspected main | Generate in real workspace environment |
| Hobby deployment cap | Team and docs confirm limit | Measure after skip-unaffected |
| Worker hosting | Vercel unsuitable for durable queue loops/FFmpeg | Select host from runtime/cost needs |
| SSO | Projects protected; automation bypass exists | Use per-project machine/test token; do not disable broad protection |
| RLS | Not proven enabled | Inspect schema, roles and connection context |
| Distributed rate limit | Topology needs confirmation | Inspect auth limiter and replica count |
| Provider choice | No production generation provider registered | Select by modality, quality, price, latency and terms |
| Safety classifier | README declares incomplete | Choose model and test corpus |
| Backup posture | Not verified | Confirm PITR/retention and run restore drill |

## 13. Primary research references

- Vercel package managers/Corepack: https://vercel.com/docs/package-managers
- Vercel monorepos/skip unaffected: https://vercel.com/docs/monorepos
- Vercel limits: https://vercel.com/docs/limits
- Node.js release schedule: https://github.com/nodejs/Release
- Vercel protection bypass for automation: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- AWS SQS visibility timeout/DLQ: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- Redis atomic rate limiting: https://redis.io/docs/latest/commands/increx/
- Cloud Run Jobs retries/checkpoints: https://docs.cloud.google.com/run/docs/jobs-retries
- GitHub CodeQL setup: https://docs.github.com/en/code-security/concepts/code-scanning/setup-types

## 14. Completion definition

AIVEDIO is not production-ready until Vercel install is deterministic and preview succeeds with pinned package manager; main CI is green with committed lockfile and frozen install; API readiness/auth/project authorization pass staging; at least one real generation provider works end-to-end; worker queue/render/retry works in container runtime; upload/private storage/authorized download pass; safety classification and human review pass including uncertain cases; backup restore/observability/alerts/rollback are exercised; and production release receives explicit approval.

**This SOP does not claim P1/P2 items are already fixed and does not authorize production deployment.**