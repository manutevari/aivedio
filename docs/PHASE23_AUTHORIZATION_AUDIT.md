# Phase 23 — API Authorization Surface Audit

## Changes implemented
- Provider configuration and discovery listing are admin-only.
- Global intelligence-cache reads are admin-only.
- Global memory search without project scope is admin-only.
- Workflow event/checkpoint reads require project membership when the workflow is project-bound; unbound/global workflows are admin-only.
- Project memory search now excludes projectless/global memory rows for non-admin users.
- CI E2E tests cover global memory/provider/cache restrictions and project-memory isolation.

## Audit approach
Authorization is applied in Fastify hooks before route handlers. The current route classification covers:
- `/v1/projects/:id/**`: membership and role policy.
- Query/body `projectId`: membership policy.
- Resource IDs: lookup of owning project for assets, generation jobs, renders, scenes, subtitles, timeline tracks/clips and workflow runs.
- Unscoped mutations: admin-only except project creation and authentication/session endpoints.
- Public authentication endpoints: rate-limited bootstrap/register/login.

## Remaining audit work
- Route/resource ownership matrix for all remaining endpoint variants.
- Review project-bound workflows with nullable project IDs.
- Query-history access policy.
- Cache write/read ownership model.
- Admin/session UI and revocation of other sessions.
- Confirm forwarded-IP handling when behind a trusted proxy.
- Shared rate-limit storage for multiple API instances.
- Complete automated negative tests for every endpoint and nested resource.
