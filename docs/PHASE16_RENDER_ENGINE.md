# Phase 16 — Intelligent Rendering Engine

## Pipeline
The API snapshots the timeline into a versioned immutable manifest. The render worker validates that snapshot, confines input storage paths under MEDIA_ROOT, compiles FFmpeg argv without a shell, executes to a temporary output, probes the result and only publishes the file to the review state when technical QA passes.

## Implemented
- Render manifest schema version 1 and deterministic validation.
- API snapshot includes timeline clips, released media storage keys, track gains/mute, subtitle cues and render profile.
- Multiple visual layers positioned by timeline time; clip order uses track order and z-index.
- Still images supported as looped FFmpeg inputs.
- Basic scaling/padding/frame-rate normalization, opacity, source trim and playback speed.
- Audio clips are trimmed, tempo-adjusted, gain applied, delayed to timeline position, mixed and limited.
- Optional subtitle burn-in or SRT sidecar.
- Queue claims with PostgreSQL row locks, expired-lease recovery, attempt counts, backoff, progress/checkpoints.
- Temporary output is renamed atomically after successful render and QA.
- ffprobe QA checks video stream, expected audio stream, output duration and dimensions.
- Human review required: render is awaiting_review; only approve changes to completed/final delivery state.

## Migration
Apply migrations through 014_render_engine.sql (not applied by this implementation).

## API
- POST `/v1/projects/:id/render-jobs` — snapshots current timeline into immutable manifest and queues render.
- GET `/v1/projects/:id/render-jobs` — list render jobs.
- GET `/v1/render-jobs/:id` — job detail, manifest snapshot, QA and output metadata.
- POST `/v1/render-jobs/:id/review` — approve/reject render output. Approval requires awaiting_review, output key and non-failing QA.

Request example:
```json
{
  "profile": {
    "container":"mp4","videoCodec":"h264","audioCodec":"aac",
    "width":1920,"height":1080,"fps":24,"quality":"standard",
    "audioSampleRate":48000
  },
  "options":{"subtitleMode":"burn_in"}
}
```
subtitleMode supports none, burn_in, sidecar.

## Worker environment
- DATABASE_URL
- MEDIA_ROOT (input assets)
- RENDER_OUTPUT_ROOT (render output files)
- RENDER_WORKER_ID (optional)
- RENDER_POLL_MS (optional)

Run: `pnpm --filter @aivedio/worker render`. FFmpeg and FFprobe must be installed in the worker environment.

## Safety / limitations
- No shell execution; FFmpeg arguments are passed as argv.
- Storage paths are confined and URL paths are not accepted as storage keys.
- Only released/ready assets are snapshotted.
- Outputs are not marked completed without human review.
- Ducking settings are preserved but sidechain ducking is not implemented; this renderer currently mixes static levels.
- Transition metadata is validated but advanced transitions are not yet executed; clips are composited by their timeline position.
- Burn-in subtitle styling currently uses FFmpeg defaults; custom font/style settings are not fully compiled.
- QA is basic ffprobe stream/duration/resolution checks. Black/frozen frame, loudness, clipping, A/V sync, full semantic safety checks are pending.
- Output files remain local to worker storage; authenticated download/object storage is not implemented.
- Migration not applied, worker not deployed, no build/typecheck/tests executed, no production deployment performed.
