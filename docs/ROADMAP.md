# Roadmap
## Phase 1 — Foundation
- [x] Workspace skeleton
- [x] Shared contracts
- [x] Node classification
- [x] Confidence/risk decision policy
- [x] Auto/manual model-selection contracts
- [x] Flow project and scene model
- [x] Fail-closed safety contract
- [x] Checkpoint interface
- [x] React and Streamlit UI foundations
## Phase 2 — Persistence and workflow control plane
- [x] PostgreSQL schema for projects, scenes, workflow runs, events, checkpoints
- [x] Project/scene CRUD API
- [x] Workflow run creation and guarded status transitions
- [x] Event history and checkpoint endpoints
- [ ] Run SQL migration against configured database
- [ ] Integration tests and API authentication
## Phase 3 — Intelligence
- OpenRouter free-model registry; intent/sentiment/context; retrieval; query history; token optimization; HITL UI
## Phase 4 — Flow Mode
- Storyboard canvas; reference library; scene generation/edit/extend; variants; continuity and QA agents
## Phase 5 — Media and production
- MCP discovery/runtime; media workers; timeline; editing; rendering; export
