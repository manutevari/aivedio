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
