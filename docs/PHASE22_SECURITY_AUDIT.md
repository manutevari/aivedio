# Phase 22 — Security Audit & Studio Team UX

## Implemented (feature branch)
- In-process authentication rate limiting by IP and endpoint:
  - Login: 8 attempts / 15 minutes.
  - Registration and bootstrap: 4 attempts / 15 minutes.
- API security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Authenticated project role endpoint: `GET /v1/projects/:id/role`.
- Admin-only atomic project ownership transfer endpoint; supports recovery/assignment for legacy projects without owner memberships.
- React Studio Team tab: owner can add existing accounts as editor/reviewer/viewer and remove non-owner members.
- Streamlit Team page: same member invite/remove functionality.
- E2E test for rate-limit activation and ownership-transfer authorization.
- Latest validation is pending in GitHub Actions.

## Remaining
- Rate limit is process-local; multi-instance production needs shared storage (e.g. Redis) and trusted proxy/IP configuration.
- No invitation email workflow; member must already have an account.
- No session list/revoke-other-session UI.
- No account recovery or email verification.
- Full route/resource authorization matrix and ownership audit remains required.
- Add CSP and review deployment-specific security headers for the Studio hosting origin.
- Production deployment, migrations and secret rotation are not performed in this phase.

## Audit update — endpoint authorization findings
- [x] Resolve direct resource ownership for assets, generation jobs, render jobs, scenes, subtitle cues, timeline tracks/clips, and workflow runs before applying project role checks.
- [x] Reject requests when an explicitly supplied project scope does not match the resource's actual project.
- [x] Conceal missing or cross-project direct resources with 404.
- [x] Provider endpoints are admin-only, including provider routing.
- [x] Workflow transition and checkpoint mutation endpoints are restricted to admin/trusted-worker authority (current implementation uses admin as the trusted boundary).
- [x] E2E regression tests for provider-route authorization and workflow transition/checkpoint denial to project reviewers.
- [ ] Introduce a dedicated worker service credential/role instead of using admin as the worker boundary.
- [x] Confirm asset analysis service validates projectId + assetId before queueing.
- [x] E2E regression: foreign asset ID cannot be reviewed by non-member.
- [x] E2E regression: nested asset-analysis operation rejects a foreign asset ID.
- [ ] Continue audit of remaining nested project-scoped child IDs and confirm all service-level SQL validates project ownership.
- [ ] Test direct resource cross-project attempts for each mapped resource type.

## Additional regression fix
- [x] Generation-job human review was passing a JS array to a JSONB reason-code column; serialize reason codes as JSON for both generation review and asset release review.
- [x] E2E regression now verifies reviewer approval succeeds and reviewer identity is session-bound.


## Deep-audit continuation (feature branch)

Additional corrections made during a hostile source review:
- [x] Generation-job creation validates scene and input-asset project ownership.
- [x] Reviewer/editor E2E fixtures are separated so the reviewer-denial assertion is not invalidated by changing that user to editor.
- [x] Locked timeline tracks reject clip creation, updates, split, trim and deletion.
- [x] Worker queues reclaim expired leases, mark exhausted stale jobs failed, and fence persistence/failure updates by the active lease owner.
- [x] Render retry outputs are isolated by attempt.
- [x] Asset release and render-job creation require technical QA and a cleared human safety review.
- [x] Creative-plan duration allocation is exact for short and long target durations; finite-number validation is added.
- [x] Edit manifests include image clips and preserve timeline gaps; split/trim inputs reject non-finite values.
- [x] PostgreSQL TLS certificate validation is enabled when PGSSLMODE=require.
- [x] CI runs creative-plan regression tests and Python syntax/dependency checks for all worker apps.

## Remaining high-priority audit work
- [ ] CI must pass on the latest branch commit; do not deploy while failing or pending.
- [ ] Worker lease tokens should be unique per claim, not only per process/worker name; add heartbeat/renewal for long generation and analysis jobs.
- [ ] Add real worker integration tests for lease recovery, stale-worker fencing, asset analysis, QA, audio analysis and FFmpeg rendering.
- [ ] Runtime schema validation is still inconsistent across API routes; validate all enums, finite numbers, IDs, sizes and nested objects.
- [ ] Review remaining cross-project nested IDs and all direct-resource endpoints.
- [ ] Enforce media-kind/track-kind compatibility and source/timeline timing invariants.
- [ ] Render features accepted in contracts but not executed (transitions, audio fades/ducking, overlays) must be implemented or explicitly blocked.
- [ ] No generation provider adapter is registered in the worker; real generation remains unavailable.
- [ ] Audit Streamlit/React state and permissions, UI mode controls, error/expired-session handling, duplicate project titles.
- [ ] Add dependency lockfile and supply-chain/reproducible-install checks; current CI installation is not frozen.
- [ ] Deployment/orchestration, secure storage, signed downloads, observability, migration rehearsal and rollback remain release blockers.
