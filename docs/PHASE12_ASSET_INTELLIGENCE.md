# Phase 12 — Multimodal Asset Intelligence

## Delivered foundation
- Core contracts for analysis jobs, extraction results, chunks, keyframes and capability availability.
- PostgreSQL persistence: jobs, extraction records, text chunks, keyframes and asset analysis metadata.
- API queue request, job listing/detail, asset intelligence retrieval, keyframe listing and full-text media search.
- Python worker with path confinement under MEDIA_ROOT, file-size limit, checksum, metadata extraction, and queued-job claiming using SKIP LOCKED.
- Supported extraction: text files, HTML cleanup, PDF text (pypdf), DOCX, XLSX.
- Optional OCR adapter using pytesseract (Tesseract executable is separately required).
- Optional video technical metadata and sampled keyframes with ffprobe/FFmpeg.
- Transcription, vision descriptions, semantic embeddings and scene-boundary detection report unavailable until adapters are configured.

## Migration
Apply migrations 001–010. Worker requirements are in apps/asset-worker/requirements.txt.

## API
- POST /v1/projects/:id/assets/:assetId/analyze
- GET /v1/projects/:id/asset-analysis?assetId=
- GET /v1/projects/:id/asset-analysis/:jobId
- GET /v1/projects/:id/assets/:assetId/intelligence
- GET /v1/projects/:id/assets/:assetId/keyframes
- GET /v1/projects/:id/media-search?q=&limit=

## Operational requirements not yet complete
Authentication/RBAC, upload flow and object storage, antivirus, worker lease renewal, sandboxed media processing, provider-backed transcription/vision, embeddings/pgvector, UI integration, build and integration tests.
