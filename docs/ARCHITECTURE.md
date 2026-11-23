# Foundation Architecture
```mermaid
flowchart TD
 UI[Studio UI: Simple / Flow / Pro / Studio] --> API[Node API & Control Plane]
 API --> CORE[Workflow Core]
 CORE --> DEC[Confidence / Risk Decision]
 CORE --> MODELS[Model Registry & Auto Router]
 CORE --> SAFETY[Safety Gates]
 CORE --> CP[Checkpoint Interface]
 CORE --> FLOW[Project / Scene Model]
 MODELS --> OR[OpenRouter Gateway]
 MODELS --> MCP[MCP Capability Runtime]
 CORE --> WORKERS[Media Workers]
 WORKERS --> QA[Quality & Continuity]
 QA --> CORE
 CORE --> DB[(Postgres + pgvector)]
 CORE --> STORE[(Object Storage)]
```
Principles: Auto routing default; manual locks supported; free-only policy; safety uncertainty is not approval; quality failures trigger targeted repair; checkpoint/resume support; Flow Mode shares core services.
