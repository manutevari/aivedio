# Phase 17 — Studio GUI & Flow Workspace

A cohesive Studio workspace now spans the production workflow and is backed by existing API contracts.

## React Studio navigation
Overview, Plan, Script, Storyboard, Assets, Flow Library, Timeline, Audio, Quality & Safety, Renders, Generation Jobs.

## Implemented UI integration
- Project create/select and creative brief.
- Creative plan versions, structured scene plan display, approval.
- Screenplay packages, dialogue preview, validation/research metadata and approval/rejection.
- Scene prompt editing.
- Asset list, quarantine decisions, analysis and technical QA queue.
- Project references and character read-only library.
- Production cut compile/apply.
- Audio plan, cue timing/manual confidence, released asset assignment, approval and apply.
- Timeline tracks and clip summaries; manifest validation.
- Render profile, subtitle mode, render queue progress, output QA findings, human approve/reject.
- Generation job safety/quality status and review actions.
- Mobile/responsive layout.

## Streamlit parity
The Streamlit app includes workflow navigation for plans, scripts, scenes, assets, references/characters, timeline/cuts, audio, QA/safety, renders and generation review.

## Limitations
- Timeline is currently a visual/read-only summary, not drag-and-drop editing.
- Media playback/thumbnail extraction is not yet integrated.
- Asset upload and reference-file upload are not included in this pass.
- Character records are displayed but no CRUD form is included.
- API endpoints currently accept reviewer names from the UI; authentication and role-based review are not established.
- Build/typecheck and end-to-end API tests were not run in this environment.
- No deployment or migration was performed.
