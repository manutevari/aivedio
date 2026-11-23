# Phase 20 — Production Security Configuration Guardrails

## Implemented
- Production requires an API bearer token.
- Production bearer token must contain at least 32 characters.
- Production requires explicit `AIVEDIO_ALLOWED_ORIGINS`.
- CORS rejects wildcard origins.
- CORS values must be exact origins (scheme/host/optional port), not URL paths.
- Production rejects localhost/loopback origins.
- Development retains localhost Studio defaults.
- Unit tests cover valid/invalid production and development configuration.
- CI executes these security configuration tests.

## Important limitation
This is configuration hardening, not full authentication or authorization. A single shared bearer token does not establish a user identity, role, project ownership, or reviewer authority. Route/resource ownership must be audited and enforced before a multi-user production deployment. Reviewer identity fields must eventually be derived from an authenticated identity, not trusted from request bodies.

## Production release gate
Do not deploy as a multi-user public service until authenticated sessions/identity, RBAC, ownership enforcement, reviewer identity binding, token rotation/revocation and a complete endpoint authorization audit are implemented and tested.
