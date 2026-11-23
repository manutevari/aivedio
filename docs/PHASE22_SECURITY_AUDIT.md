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
- [ ] Continue audit of nested project-scoped child IDs and confirm all service-level SQL validates project ownership.
- [ ] Test direct resource cross-project attempts for each mapped resource type.
