# Phase 7 — Studio UI and production pipeline

## Scope
- Connect the Studio UI to project, scene, asset and generation-job APIs.
- Persist user scene edits instead of relying on hard-coded demo state.
- Add asset-library listing and quarantined-asset release controls.
- Add generation queue visibility and human job-review controls.
- Keep the API as the single authority for safety, provider routing and workflow state.
- Provide an explicit API-offline state instead of silently presenting mock content as saved.

## Review semantics
- Generation jobs begin in `awaiting_approval`; no worker may claim them until an explicit human review sets `safety_status='approved'` and queues them.
- Asset records are created in quarantine. Human release requires the parent job to have an approved safety review and a non-failing quality result.
- The present review API accepts a reviewer label for workflow prototyping. It is **not authentication**. Production release controls must be behind authenticated user identity, role-based permissions and an auditable approval policy.

## Limitations
- Browser uploads/object storage, authentication/authorization, real providers, live rendering and final media playback are not implemented here.
- Run migrations 001–005 before using persistence routes.
- Build/typecheck and end-to-end tests still need to run in a configured environment.
