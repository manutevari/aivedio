# Phase 22 — Security Audit & Studio Team UX

## Implemented (feature branch)
- In-process authentication rate limiting by IP and endpoint:
  - Login: 8 attempts / 15 minutes.
  - Registration and bootstrap: 4 attempts / 15 minutes.
- API security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Authenticated project role endpoint: `GET /v1/projects/:id/role`.
- React Studio Team tab: owner can add existing accounts as editor/reviewer/viewer and remove non-owner members.
- Streamlit Team page: same member invite/remove functionality.
- E2E test for rate-limit activation.
- Latest validation is pending in GitHub Actions.

## Remaining
- Rate limit is process-local; multi-instance production needs shared storage (e.g. Redis) and trusted proxy/IP configuration.
- No invitation email workflow; member must already have an account.
- No session list/revoke-other-session UI.
- No account recovery or email verification.
- Full route/resource authorization matrix and ownership audit remains required.
- Add CSP and review deployment-specific security headers for the Studio hosting origin.
- Production deployment, migrations and secret rotation are not performed in this phase.
