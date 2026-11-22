# Phase 11 — Scriptwriting and Prompt Enrichment

- Free-only OpenRouter model selection from currently verified zero-cost models.
- Model is pinned in request and actual response model is checked; unexpected model outputs are discarded.
- Strict JSON parse and bounded schema normalization.
- Screenplay/dialogue/narration, scene action, on-screen text.
- Shot-specific generation prompts and negative prompts.
- Character/reference-aware context from project Flow assets.
- Optional Tavily research; factual claims must cite returned source IDs.
- Validation ensures planned scene and shot IDs are covered exactly once and citations resolve.
- Versioned packages; draft/awaiting-review; approve/reject API; review is stored in project memory.

Migration 009. Research requires TAVILY_API_KEY. Model generation requires OPENROUTER_API_KEY. No paid fallback.

Scope: this enriches existing creative plans. It does not execute media generation or automatically approve outputs. Authentication and end-to-end testing remain production blockers.
