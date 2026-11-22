# Phase 15 — Audio Intelligence & Sound Design

## Implemented foundation
- Audio cue types: dialogue, narration, music, ambience and sound effects.
- Compile approved script music arc and sound-design directions into versioned audio production plans.
- Dialogue cue durations are estimates (word-rate heuristic); they are not treated as final timing.
- Music and ambience are scene-level; SFX are intentionally unplaced until editor confirms timing.
- Cue asset assignment and timing edits are persisted; asset IDs are checked against project scope.
- Release, generation safety, latest technical QA and latest safety verdict are checked at cue editing, approval and apply.
- Audio plans require all cue timings manually reviewed, all assets assigned and ready before approval.
- Applying approved plans creates audio/music/sfx timeline tracks and clips with non-destructive provenance. Per-cue gain is represented as clip volume and metadata; track mix settings are persisted.
- Audio analysis jobs and reports; worker uses FFmpeg/FFprobe to measure integrated loudness (when parsable), loudness range, peak, RMS, clipping and silence intervals.
- Ducking configuration contracts and endpoint validation.

## Migration
Apply migrations 001–013. Phase 15 migration is `013_audio_intelligence.sql`.

## APIs
- `POST /v1/projects/:id/production-cuts/:cutId/audio-plans` — compile draft; optional `assetAssignments`, `createdBy`.
- `GET /v1/projects/:id/audio-plans` — list.
- `GET /v1/projects/:id/audio-plans/:planId` — detail.
- `PATCH /v1/projects/:id/audio-plans/:planId/cues/:cueId` — edit cue; must include manually reviewed timing fields and/or asset assignment.
- `POST /v1/projects/:id/audio-plans/:planId/review` — approve/reject. Approval checks manually confirmed timing and release/QA/safety gates.
- `POST /v1/projects/:id/audio-plans/:planId/apply` — materialize to timeline tracks.
- `POST /v1/projects/:id/assets/:assetId/audio-analysis` — queue analysis; optional thresholds.
- `GET /v1/projects/:id/audio-analysis` — reports, optionally filter by assetId.
- `GET /v1/projects/:id/audio-analysis/jobs` — queue.
- `GET /v1/projects/:id/audio-analysis/:reportId` — report.
- `PUT /v1/projects/:id/audio-mix/:trackId/ducking` — validated ducking configuration.

## Worker
Install `psycopg[binary]`; FFmpeg/FFprobe are required for meaningful audio measurements.
Start with `python apps/audio-worker/worker.py`.
Environment: `DATABASE_URL`, `MEDIA_ROOT`, optional `AUDIO_WORKER_POLL_SECONDS`, `AUDIO_WORKER_ID`.

## Safety and limitations
- Analysis is technical only; it does not grant safety clearance.
- No automatic audio cleanup, normalization, noise reduction or repair is executed.
- No voice synthesis, voice cloning, music generation or SFX provider is wired in this phase.
- SFX placement and dialogue timing require manual confirmation; lip-sync measurement is not implemented.
- Ducking settings are persisted, but sidechain execution in the render graph is still pending.
- Loudness and true-peak parsers are best-effort and report warnings if unavailable.
- Migration is not applied; workers are not deployed; build/tests are not run; production deployment not performed.
