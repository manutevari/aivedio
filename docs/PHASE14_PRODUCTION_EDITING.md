# Phase 14 — Intelligent Production Timeline & Editing

## Implemented
- Deterministic production-cut compiler from approved creative plan and approved script package.
- Per-shot timeline timing distributed within scene durations, shot prompts and negative prompts.
- Explicit asset assignments by shot ID or deterministic metadata matching (shotId, planSceneId, scriptSceneId).
- Ambiguous and missing assets stay explicit; readiness score and warnings are generated.
- Asset gate checks release state, generation safety approval, latest technical QA status, latest safety verdict and visual media kind.
- Versioned production cut records; draft cut creation does not modify the timeline.
- Apply operation validates cut readiness and rechecks database gates in a transaction, creates a new video track and clips, and records non-destructive provenance metadata.
- Timeline edit manifest combines tracks, clips, subtitles, transitions and audio mix settings for downstream render orchestration.

## Migration
Apply migrations 001–012. Phase 14 migration is `012_production_cuts.sql`.

## APIs
- `POST /v1/projects/:id/production-cuts` — create draft from approved script package. Body: `{scriptPackageId, assetAssignments?, createdBy?}`
- `GET /v1/projects/:id/production-cuts` — list versions
- `GET /v1/projects/:id/production-cuts/:cutId` — draft/detail
- `POST /v1/projects/:id/production-cuts/:cutId/apply` — create a new timeline video track and clips, only when all assets pass gates
- `GET /v1/projects/:id/timeline/manifest` — combined timeline/edit manifest

## Asset matching
Explicit `assetAssignments` map `shotId -> assetId`. Without assignment, the compiler matches metadata `shotId`, then `planSceneId` or `scriptSceneId`. Multiple matches are ambiguous and require explicit assignment. No fuzzy matching.

## Readiness policy
Only media with status `ready`, generation `safety_status=approved`, latest QA `pass|warning`, latest safety verdict `clear`, and supported visual kind can be applied. Source duration must cover the placed clip. Apply rechecks those values inside a transaction. Draft creation may include incomplete assets and never alters the timeline.

## Limitations
- No automatic generation or silent provider selection for missing shots.
- No automatic subtitle materialization yet; script subtitle/on-screen text is preserved in the production-cut content.
- Transition timing is exposed through manifest; a dedicated production-cut transition editor is pending.
- UI integration, render-worker consumption, tests, auth/RBAC and migration execution remain pending.
