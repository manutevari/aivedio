# Phase 9 — Advanced editing and audio composition

## Implemented contracts
- Explicit transition and subtitle cue validation.
- Edit decision records for non-destructive edit history.
- Per-track audio mix settings (gain/mute/ducking configuration).
- FFmpeg composition filter builder for sequential video clips with cuts, fades/dissolves, wipes/slides and synchronized multi-layer audio.
- Audio layers use source trim, timeline delay, gain, stereo/sample-rate normalization, amix and limiter.
- FFmpeg argument construction uses argv arrays and no shell.

## Current scope
The filter builder is a first renderer increment. It does not yet render alpha overlays, animated titles, subtitle burn-in, waveform visualization, beat-sync, sidechain ducking or arbitrary overlapping video layers. Ducking is stored as a mix setting but not yet compiled into sidechain filters. These require separate QA and integration tests.

## Safety
- Never pass a user-provided raw FFmpeg filter string.
- Transition names are allow-listed.
- Numeric values are validated before filter construction.
- Paths are passed as separate process arguments; use MEDIA_ROOT path confinement for storage keys.
- Audio/video outputs must remain in review until safety and technical QA complete.

## Required setup
Apply migrations 001–007. Use the render worker with FFmpeg installed. This composition compiler is not yet wired into the production render worker; integration is the next sub-phase.
