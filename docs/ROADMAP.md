# Roadmap
## Phase 1 — Foundation
- [x] Workspace skeleton
- [x] Shared contracts, node classifier, decision policy, model-selection contracts
- [x] Flow data models, safety interface, checkpoints
- [x] React and Streamlit UI foundations
## Phase 2 — Persistence and workflow control plane
- [x] Schema and project/scene/workflow/checkpoint APIs
- [ ] Migration execution, auth, integration tests
## Phase 3 — Intelligence Core
- [x] Creative brief analyzer (heuristic baseline)
- [x] Context deduplication, relevance ranking and character-budget selection
- [x] PostgreSQL project memory with full-text search
- [x] Query history and expiring cache
- [x] OpenRouter model discovery endpoint
- [x] Free-model filtering and routing endpoint
- [ ] Embeddings/vector search, calibrated model-based intent, sentiment pipeline, HITL UI, tests
## Phase 4 — Flow Mode
- Storyboard canvas; references; scene generation/edit/extend; variants; continuity and QA
## Phase 5 — MCP capability and media-provider routing
- [x] Capability contracts and request constraint matching
- [x] Provider registry persistence
- [x] Discovery candidate/trust separation
- [x] Generation-job persistence and guarded state transitions
- [x] Routing API contracts
- [ ] Official MCP SDK runtime, real provider adapters, secure auth vault, worker execution, safety/QA pipelines
## Phase 6 — Media worker and generation execution
- [x] Worker app package and process lifecycle
- [x] Durable job claiming with row locks and SKIP LOCKED
- [x] Safety-approved jobs only are claimable
- [x] Reviewed provider-adapter contract and adapter registry
- [x] Asset validation and quarantine persistence
- [x] Baseline result quality assessment
- [x] Retry/backoff and lease metadata
- [ ] Real provider adapters, object storage, lease renewal, moderation/technical QA, auth, observability, integration tests
## Phase 7 — Studio UI and production pipeline
- [x] React Studio API connection: projects/scenes
- [x] Scene prompt editing and persistence
- [x] Project scene list and add-scene controls
- [x] Asset browser with quarantine review
- [x] Generation-job queue and approval/rejection UI
- [x] Streamlit API-connected project/Flow/assets/jobs workspace
- [x] Explicit API-offline state
- [x] Generation jobs start awaiting human approval; worker only claims safety-approved jobs
- [ ] Authentication/RBAC for approvals, real upload/storage, media previews, QA agents, integration tests
## Phase 8 — Timeline, editing and render pipeline
- [x] Persistent tracks and clips schema
- [x] Timeline API: tracks/clips CRUD, split and trim
- [x] Timeline validation and time/source-range contracts
- [x] Render profile validation and render job queue
- [x] FFmpeg worker execution foundation (shell=false)
- [x] MEDIA_ROOT path confinement and render output directory
- [x] React timeline overview and render queue UI
- [ ] Multi-track composition, transitions, audio mixing/ducking, subtitles, overlays, object storage, auth, output QA, tests

## Phase 9 — Advanced Editing & Audio Composition
- [x] Transition and subtitle cue validation contracts
- [x] Persistent subtitle cue records and APIs
- [x] Non-destructive edit decision records
- [x] Per-track audio mix settings API (gain/mute/ducking config)
- [x] Composition filter-graph planner for cuts, fades/dissolves, wipes/slides and synchronized audio layers
- [x] FFmpeg argument compiler (safe argv, no shell)
- [ ] Integrate composition planner into render worker
- [ ] Subtitle burn-in, sidechain ducking, overlays and visual QA
- [ ] End-to-end rendering tests and authenticated review

## Phase 10 — Creative Director & Production Planning
- [x] Creative brief/format contracts and deterministic story structure
- [x] Duration-aware scene plans and shot breakdowns
- [x] Camera, composition, lighting, emotional arc, music and continuity guidance
- [x] Generation-ready scene and shot prompt drafts
- [x] Plan validation and versioned persistence
- [x] Plan list, fetch, update and approval API
- [ ] Free-only LLM enrichment, reference-aware prompts, factual research/citations, Flow UI and continuity QA

## Phase 11 — Scriptwriting & Prompt Enrichment
- [x] Free-only OpenRouter model routing and pinned model verification
- [x] Structured screenplay, dialogue, narration, scene action and on-screen text
- [x] Shot-specific prompt and negative prompt generation
- [x] Project reference and character context ingestion
- [x] Optional Tavily research with source-linked factual claims
- [x] Scene/shot coverage and citation validation
- [x] Versioned script packages and review/approval APIs
- [ ] Authenticated review, integration tests, provider error retry UX and UI

## Phase 12 — Multimodal Asset Intelligence
- [x] Extraction contracts and capability registry
- [x] Asset analysis queue and extraction/chunk/keyframe schema
- [x] Queue request, status, retrieval and project media search API
- [x] Python worker with confined storage path validation
- [x] Metadata extraction and PDF/DOCX/XLSX/text extraction
- [x] Optional OCR integration with explicit unavailable status
- [x] Optional FFmpeg/ffprobe technical metadata and sampled keyframes
- [x] Explicit unavailable states for vision, embeddings, transcription and scene-boundary adapters
- [ ] Authenticated upload/storage, malware scanning, lease renewal, vector embeddings, provider adapters, UI and integration tests

## Phase 13 — Continuity, Safety & Quality Intelligence
- [x] Typed QA findings, severity, confidence, report and decision contracts
- [x] Deterministic scene-to-scene continuity comparison (provided snapshots)
- [x] Technical profile validation: dimensions, frame rate, duration, black/frozen frames, silence metadata
- [x] PostgreSQL QA job/report and safety-review persistence (migration 011)
- [x] API endpoints for quality jobs/reports, continuity reviews and human safety review
- [x] Technical QA worker with FFprobe/FFmpeg metadata and black-frame detection; path confinement
- [x] Safety classifier unavailable is explicitly held for HITL; no fabricated clear verdict
- [ ] Actual moderation/classifier adapters, visual continuity/character matching, audio loudness/clipping DSP, automatic repair execution
- [ ] Authentication/RBAC, worker lease recovery, integration tests and Studio UI

## Phase 14 — Intelligent Production Timeline & Editing
- [x] Deterministic production-cut compiler from approved plan + approved script package
- [x] Per-shot timing, shot prompt, negative prompt and explicit asset assignment/matching
- [x] Missing/ambiguous asset states and readiness score
- [x] Asset release, technical QA and safety-clear gates before materialization
- [x] Versioned production-cut persistence (migration 012)
- [x] Non-destructive apply to a new video timeline track with shot metadata
- [x] Timeline edit manifest API integrating clips, tracks, subtitles, transitions and audio-mix settings
- [ ] UI/Flow workspace integration, automatic subtitle cue creation, render-worker integration, integration tests and auth/RBAC

## Phase 15 — Audio Intelligence & Sound Design
- [x] Structured audio cues: dialogue, narration, music, ambience and SFX
- [x] Script music arc and sound-design extraction into versioned audio plans
- [x] Explicit missing assets and estimated/unconfirmed timing states
- [x] Audio plan cue editing with project-bound asset and release/QA/safety checks
- [x] Human approval requiring reviewed timing and cleared audio assets
- [x] Audio plan application to separate timeline tracks with per-cue gain metadata and mix settings
- [x] Audio QA queue, reports and worker using FFmpeg/FFprobe loudness, peak, clipping and silence analysis
- [x] Configurable ducking contracts and API
- [ ] Sidechain ducking in render graph, voice generation/recording adapters, music/SFX search, lip-sync measurement, UI and integration tests

## Phase 16 — Intelligent Rendering Engine
- [x] Versioned immutable render-manifest contract and validation
- [x] API snapshot of project timeline, released media, mix settings and subtitles
- [x] Timeline-aware FFmpeg compiler: multiple visual layers, still images, positioned clips, scaling, frame rate and mixed audio
- [x] Subtitle burn-in or sidecar SRT export
- [x] FFmpeg execution using shell=false and confined input/output paths
- [x] Render job lease claiming and expired-lease recovery
- [x] Retry/backoff, checkpoints and atomic partial-output rename
- [x] Post-render ffprobe QA: stream presence, duration, resolution and expected audio
- [x] Human review gate before marking final delivery complete
- [ ] Advanced transition implementation, sidechain ducking, subtitles styling, overlays/graphics, black/frozen-frame and audio loudness QA, download endpoint/object storage, authenticated review UI, integration tests

## Phase 17 — Studio GUI & Flow Workspace
- [x] Unified React Studio navigation across Overview, Plan, Script, Storyboard, Assets, Flow Library, Timeline, Audio, Quality & Safety, Renders and Generation Jobs
- [x] Project selection and creation with creative brief
- [x] Creative-plan versioning and approval
- [x] Script package generation, validation display and human review
- [x] Storyboard scene editing and persistence
- [x] Asset quarantine review and analysis/technical-QA queue actions
- [x] Project reference and character library views
- [x] Production-cut compilation and apply gate
- [x] Audio plan review, cue assignment/timing and apply gate
- [x] Timeline track/clip overview and manifest validation action
- [x] Render profile/subtitle settings, queue progress, QA and delivery review
- [x] Generation job safety/quality status and approval/rejection
- [x] Responsive styles for mobile widths
- [x] Streamlit workspace extended to cover the same production pipeline
- [ ] Interactive drag-and-drop timeline editing, actual media preview, upload UI, character CRUD forms, API authentication/role-based reviewer identity, complete endpoint validation and automated UI tests

## Phase 18 — Integration & Release Readiness
- [x] Repair escaped source line-break defects found during CI
- [x] Remove direct API render-state transition endpoint
- [x] Add optional bearer-token API protection and production fail-closed token requirement
- [x] Add CORS allowlist and preflight handling
- [x] Include audio clips in render duration calculation
- [x] Harden render worker path resolution against symlink escape
- [x] Recover expired/missing render leases
- [x] Add GitHub Actions CI workflow (typecheck, build, Python syntax)
- [x] CI green: typecheck and build (previous workflow); Python syntax and dependency dry-run pending re-verification with database E2E
- [ ] Secure user/session authentication and role-based review authorization
- [ ] API ownership/authorization audit
- [ ] Deterministic API E2E smoke: project → plan → script review → QA/safety-gated fixture assets → production cut → timeline → audio HITL gate → render snapshot → delivery review (CI still validating fixture integration)\n- [ ] Real provider generation and FFmpeg worker integration tests
- [ ] Migration rehearsal and worker/render integration tests
- [ ] Release deployment and rollback plan

## Phase 19 — End-to-End Integration Testing
- [x] Checksum-tracked transactional migration runner for controlled/CI databases
- [x] CI disposable PostgreSQL 16 service and migration execution
- [x] API bearer-token protection smoke test
- [x] Project/plan creation and approval through API
- [x] Deterministic script fixture and human-review endpoint
- [x] Asset release, technical QA and safety-gate fixture validation
- [x] Production cut compile/apply and timeline manifest validation
- [x] Audio plan HITL gate verification
- [x] Render manifest snapshot and delivery review gate validation
- [ ] Real provider, asset/audio/QA/render workers, FFmpeg, storage and UI E2E
- [ ] Authentication/RBAC and project ownership authorization audit
