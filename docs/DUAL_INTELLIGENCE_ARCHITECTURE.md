# AIVEDIO Dual Intelligence Architecture

## Purpose

Unify the original creative-production pipeline with the Research-Grade + Operation-Grade design. AIVEDIO remains one product with two isolated execution planes and one shared set of contracts.

## Product flow

1. User submits a project, brief, audio, video, image, or document through the existing React studio and authenticated API.
2. The trusted API validates identity, project membership, quotas, consent, and asset access. The browser never receives internal worker credentials.
3. A Python FastAPI control plane creates a typed run and LangGraph orchestrates the workflow.
4. Existing creative agents remain part of the workflow: optional Researcher, Script Agent, Narrator, Voice Modulator, Translation/Localization/Transliteration, Speech Generator, Script Critic, Video Critic, Quality Analyzer, Improvisor, Implementation Agent, Patcher, and Auditor.
5. The multimodal intelligence branch adds Semantic Search, Audio Intelligence, Computer Vision, and Predictive Analysis. Results use shared typed evidence contracts and are fused before quality review.
6. Risky, costly, irreversible, or user-visible changes pause for authenticated human approval.
7. Final artifacts, provenance, metrics, and audit events are written through authorized domain services; LangGraph checkpoints are workflow state, not business records.

## Two execution planes

### Operation-Grade plane

- Runs approved, versioned models and deterministic production workflows.
- Has bounded concurrency, timeouts, retries, idempotency, quotas, resource limits, health checks, and observability.
- Uses inference-only model endpoints; no training jobs or experimental weights.
- Supports staged rollout, shadow comparison, canary, rollback, and human approval.
- Is the only plane allowed to produce customer-facing deliverables or perform authorized business side effects.

### Research-Grade plane

- Runs isolated experiments, dataset preparation, training/fine-tuning, evaluation, ablation studies, and benchmarks.
- Uses versioned datasets, model artifacts, code revisions, seeds, metrics, and experiment metadata.
- Has separate credentials, queues, storage prefixes, compute budgets, and network policies.
- Cannot write production project records, approve its own promotion, or deploy models.
- Publishes candidate artifacts to a quarantine/model-registry area only.

## Shared modality contracts

All modality adapters return normalized, provenance-bearing evidence: schema version, modality, model/provider and version, asset reference, timestamps/frame ranges, confidence, structured observations, warnings, and processing status. Raw media is stored in object storage; PostgreSQL stores ownership, metadata, jobs, and audit records; pgvector stores embeddings with project/tenant scope and access checks.

- Semantic Search: transcript, captions, OCR, scene descriptions, and metadata embeddings; hybrid lexical/vector retrieval; timestamped citations.
- Audio Intelligence: ASR, language identification, diarization, speech/music/sound-event classification, audio quality and alignment. Emotion-related outputs are probabilistic cues, not facts about a person.
- Computer Vision: frame sampling, scene segmentation, OCR, object detection/tracking, visual consistency, and video QA. Respect privacy, consent, retention, and model limitations.
- Predictive Analysis: calibrated forecasts and risk/quality scores with model version, features, confidence/uncertainty, evaluation window, and explanation. Never present predictions as certainty; avoid unsupported audience/personality claims.

## LangGraph orchestration

The graph owns typed state, conditional routing, checkpoints, bounded retries, cancellation, deadlines, and interrupt/resume approval. Specialized workers are adapters behind stable interfaces; they do not independently mutate project state. Parallel fan-out can be added for independent modalities when resource limits and cancellation semantics are implemented.

The initial Python service is an incremental migration slice. It does not replace the current Fastify API, auth/RBAC, React UI, business schema, or workers until route-by-route parity and explicit cutover approval.

## Model promotion lifecycle

Research experiment -> dataset/license/privacy validation -> reproducible benchmark -> safety/security evaluation -> model registry candidate -> staging -> shadow comparison -> canary -> authenticated approval -> production alias. Failed gates reject the candidate. Rollback restores the previous immutable model version. No direct Research-to-Production deployment.

## Data and security boundaries

- The authenticated API is the source of truth for user/project authorization. Request-supplied user_id, project_id, or actor_id is not proof of identity.
- Service-to-service calls use scoped, rotated credentials; secrets never reach browser or Streamlit clients.
- Enforce tenant/project filters on every asset, vector, transcript, checkpoint, and retrieval operation.
- Keep graph checkpoints, business records, approval audit events, model registry, and experiment tracking logically distinct.
- Redact sensitive prompts/media metadata from traces; tracing is opt-in until retention and access policies are reviewed.
- Validate MIME type, file size, duration, codecs, decompression limits, and malware policy before media processing.
- Apply retention/deletion consistently to originals, derived frames, transcripts, embeddings, caches, and backups.

## Operational deployment

React remains on Vercel. Python API and long-running CPU/GPU workers run on container/worker infrastructure suitable for persistent jobs; do not assume Vercel request functions are appropriate for long-running media inference or training. Separate queues by workload (interactive API, audio, vision, embeddings, prediction, research training). Use object storage for large media and signed, short-lived access URLs.

## Phased delivery

1. Fix and verify the existing Python/LangGraph CI slice and isolate Python package imports.
2. Add typed multimodal contracts and a provider-neutral LangGraph intelligence workflow.
3. Integrate current asset/audio/QA workers through adapters; do not duplicate them before capability review.
4. Add semantic indexing/retrieval with tenant-scoped pgvector and timestamp citations.
5. Add vision and predictive inference behind explicit feature flags and evaluation gates.
6. Build research isolation, experiment tracking, dataset governance, and model registry.
7. Add promotion pipeline, shadow/canary and rollback.
8. Shadow-compare with existing TypeScript/worker paths, run security and regression tests, then request explicit production cutover approval.

## Definition of done

- Existing project, auth, creative plan, timeline, render, media and approval contracts remain compatible.
- Every modality has adapter contract tests, failure/timeout tests, provenance, access-control tests and quality benchmarks.
- Research cannot access production mutation credentials.
- Model promotion and rollback are auditable and reproducible.
- CI and staging end-to-end tests are green before any production cutover.
