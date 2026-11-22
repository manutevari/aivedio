# Phase 8 — Timeline, editing and render pipeline

## Implemented foundation
- Persistent timeline tracks and clips with independent source/timeline time ranges.
- Clip validation, trim, split and ordering helpers.
- PostgreSQL timeline and render-job schema.
- Timeline CRUD and render-job API.
- Render profiles for MP4/MOV/WebM, H.264/H.265/VP9, supported frame rates and up to 8K dimensions within a pixel budget.
- Render worker claims queued render jobs and invokes FFmpeg without a shell.
- Render input paths are confined to MEDIA_ROOT; outputs are written under RENDER_OUTPUT_ROOT.
- Render jobs finish in awaiting_review, not published automatically.

## Current renderer boundary
The first FFmpeg adapter exports a sequential video montage from a validated render manifest. It normalizes frame size, frame rate and pixel format. This version does not yet compose arbitrary overlapping tracks, transitions, subtitles, audio mixes, ducking, or overlays. The schema/UI can represent multiple tracks; the renderer needs those features in subsequent increments.

## Run
- Apply migrations 001–006.
- Run API with DATABASE_URL configured.
- Install FFmpeg on the worker host and set MEDIA_ROOT and RENDER_OUTPUT_ROOT.
- Start render worker: `pnpm --filter @aivedio/worker render`.
- Render API requires a project and a JSON render manifest containing `videoClips` with storage keys and trim/timing fields.

## Production blockers
Authentication/authorization, object-storage adapter, content moderation, final-output QA, render leases/heartbeats, job cancellation, and end-to-end tests must be completed before public deployment.
