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
