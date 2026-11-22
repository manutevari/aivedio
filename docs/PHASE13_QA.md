# Phase 13 — Continuity, Safety & Quality Intelligence

## Delivered
- Typed quality finding/report, safety verdict, continuity snapshot and decision contracts in `packages/core/src/quality.ts`.
- Deterministic continuity comparison for scene attributes supplied by the caller.
- Technical checks for readable files, dimensions, target dimensions, frame rate, duration, detected black frames, frozen intervals and silence intervals when metadata exists.
- QA queue, reports and safety review persistence in migration `011_quality_safety.sql`.
- API service and endpoints for QA queue, report retrieval, continuity review and human safety review.
- Technical QA worker using FFprobe and optional FFmpeg black-frame detection. It uses MEDIA_ROOT path confinement.
- Safety classification is not faked. With no classifier, verdict remains `unavailable` and the decision requires HITL.

## Migration
Apply migrations 001–011 in order. Migration 011 creates quality_jobs, quality_reports and safety_reviews.

## API
- `POST /v1/projects/:id/quality/assets/:assetId/jobs` — queue technical QA; optional expectedProfile.
- `GET /v1/projects/:id/quality/jobs` — list jobs.
- `GET /v1/projects/:id/quality/reports?assetId=` — list reports.
- `GET /v1/projects/:id/quality/reports/:reportId` — report detail.
- `POST /v1/projects/:id/quality/continuity` — submit snapshots and compare scene continuity.
- `GET /v1/projects/:id/safety/reviews` — list safety reviews.
- `POST /v1/projects/:id/quality/reports/:reportId/safety-review` — human decision: clear, block, or needs_changes. Requires reviewer and notes.

Continuity request example:
```json
{
  "snapshots": [
    {"sceneId":"scene-1","sceneOrder":1,"attributes":{"character_appearance":"red coat","location":"kitchen","prop":"blue mug"}},
    {"sceneId":"scene-2","sceneOrder":2,"attributes":{"character_appearance":"red coat","location":"kitchen","prop":"blue mug"}}
  ]
}
```

## Worker
Install Python dependencies: `psycopg[binary]`. FFmpeg/FFprobe are optional, but needed for video probes and black-frame checks. Start with:
`python apps/qa-worker/worker.py`

Environment: `DATABASE_URL`, `MEDIA_ROOT`, optional `QA_WORKER_POLL_SECONDS`, `QA_WORKER_ID`.

## Limitations / safety
- This is the technical QA foundation, not a complete multimodal QA system.
- Visual character/wardrobe/prop matching needs a vision adapter.
- Audio clipping/loudness analysis needs a DSP adapter; current silence detection requires metadata supplied by a future adapter.
- Safety moderation adapter is not configured. Technical QA never grants safety clearance. Human review is required.
- Automatic repair execution is not implemented; findings contain recommendations only.
- Apply migration and run tests/build before deployment. No migration or deployment was performed.
