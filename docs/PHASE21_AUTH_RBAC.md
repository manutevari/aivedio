# Phase 21 — Authentication & Project RBAC

## Implemented on the feature branch
- Migration 015 adds users, sessions, project memberships and project owner reference.
- Accounts use normalized email and scrypt password hashes.
- Sessions use 32-byte random opaque bearer tokens; only HMAC hashes are stored.
- Sessions expire after 14 days; logout revokes the current session.
- First-admin bootstrap is guarded by a configured key, a zero-user check and a PostgreSQL advisory transaction lock.
- Self-registration is disabled unless `AIVEDIO_ALLOW_SELF_REGISTRATION=true`.
- Project creation assigns the authenticated user as owner.
- Project listing is filtered by membership; global admin can see all.
- Roles: owner, editor, reviewer, viewer.
- Owner-only project member listing, add and remove endpoints.
- Project routes check membership. GET allows all roles; edits allow owner/editor; review/approve routes allow owner/editor/reviewer.
- Review actor identity is overwritten with the authenticated account email.
- Global asset and generation-job listing is filtered to projects the user belongs to.
- React and Streamlit now require sign-in and use a session token; both include sign-out.

## Environment
Required for local API authentication:
- `AIVEDIO_SESSION_SECRET`: at least 32 characters (use a random secret; do not commit it).
- `AIVEDIO_BOOTSTRAP_ADMIN_KEY`: at least 32 characters, only needed for one-time first-admin bootstrap.

Optional:
- `AIVEDIO_ALLOW_SELF_REGISTRATION=true` enables self-registration. Default is disabled.

First-admin bootstrap endpoint: `POST /v1/auth/bootstrap` with `bootstrapKey,email,password,displayName`. It only works when the users table is empty.
Sign-in: `POST /v1/auth/login`; session details returned include a bearer token.
Current clients store the bearer session in browser session storage / Streamlit session state.

## Role policy
- Owner: full project access and membership management.
- Editor: project reads and production edits.
- Reviewer: reads and approval/review actions; no project edits.
- Viewer: read-only.
- Admin: global administrative bypass.

## Limitations / release blockers
- The authorization hook is a first pass and the full route/resource audit is not complete. Routes that lack project ownership resolution must be hardened before public release.
- Account recovery, email verification, login throttling, admin/user management UI and invitation UX are not implemented.
- Session tokens are bearer tokens held by the clients, not HttpOnly cookies.
- Existing projects created before migration have no membership rows. A global admin can view and manage memberships, but a normal user will not see such projects until an owner/member is assigned.
- Reviewer identity binding applies to routes matching review/approval actions; remaining actor fields and audit logs need a full audit.
- Production deployment and migrations remain unapproved and were not run.
