"""Provider-neutral multimodal intelligence contracts and LangGraph workflow.

Concrete model providers are injected as adapters. Missing providers are represented
as explicit skipped evidence; manually supplied evidence is validated and labelled.
"""
from __future__ import annotations

import json
from copy import deepcopy
from typing import Annotated, Any, Literal, Protocol, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field

Modality = Literal["semantic_search", "audio", "vision", "predictive"]


def _stable_items(items: list[Any]) -> list[Any]:
    """Sort without deduplicating: repeated observations remain observable."""
    return sorted(items, key=lambda item: json.dumps(item, sort_keys=True, default=str))


def merge_evidence(
    current: dict[str, dict[str, Any]] | None,
    update: dict[str, dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    """Deterministically merge modality evidence while retaining collisions.

    Distinct modalities are merged by key. Repeated writes to one modality append
    list-valued evidence (including duplicates) and preserve conflicting scalar
    values in a conflicts field rather than silently discarding either update.
    """
    merged = deepcopy(current or {})
    for modality in sorted((update or {}).keys()):
        incoming = deepcopy((update or {})[modality])
        if modality not in merged:
            merged[modality] = incoming
            continue
        existing = merged[modality]
        for field in ("observations", "citations", "warnings"):
            existing[field] = _stable_items(
                list(existing.get(field, [])) + list(incoming.get(field, []))
            )
        conflicts = list(existing.get("conflicts", []))
        for field in sorted(set(existing) | set(incoming)):
            if field in {"observations", "citations", "warnings", "conflicts"}:
                continue
            left, right = existing.get(field), incoming.get(field)
            if left is None:
                existing[field] = right
            elif right is not None and left != right:
                conflicts.append({"field": field, "values": _stable_items([left, right])})
        if conflicts:
            existing["conflicts"] = _stable_items(conflicts)
    return {key: merged[key] for key in sorted(merged)}


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1.0"] = "1.0"
    modality: Modality
    status: Literal["completed", "skipped", "failed"]
    provider: str | None = None
    model_version: str | None = None
    asset_ref: str | None = None
    observations: list[dict[str, Any]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)


class ModalityAdapter(Protocol):
    def analyze(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return an Evidence-compatible mapping; adapters must be side-effect free."""


class IntelligenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str = Field(min_length=8, max_length=128)
    project_id: str = Field(min_length=1, max_length=128)
    asset_ref: str = Field(min_length=1, max_length=512)
    modalities: list[Modality] = Field(min_length=1)
    query: str | None = Field(default=None, max_length=4000)
    options: dict[str, Any] = Field(default_factory=dict)
    missing_adapter_policy: Literal["skip", "manual"] = "skip"
    manual_evidence: dict[str, dict[str, Any]] = Field(default_factory=dict)


class IntelligenceState(TypedDict, total=False):
    request: dict[str, Any]
    evidence: Annotated[dict[str, dict[str, Any]], merge_evidence]
    fused: dict[str, Any]
    quality: dict[str, Any]
    status: str


class IntelligenceAdapters(TypedDict, total=False):
    semantic_search: ModalityAdapter
    audio: ModalityAdapter
    vision: ModalityAdapter
    predictive: ModalityAdapter


def _run_adapter(
    modality: Modality,
    adapters: IntelligenceAdapters,
    state: IntelligenceState,
) -> dict[str, Any]:
    request = state["request"]
    if modality not in request["modalities"]:
        return {"evidence": {modality: Evidence(modality=modality, status="skipped").model_dump()}}

    adapter = adapters.get(modality)
    if adapter is None:
        manual = request.get("manual_evidence", {}).get(modality)
        if request.get("missing_adapter_policy", "skip") == "manual" and manual is not None:
            evidence = Evidence.model_validate({
                **manual,
                "modality": modality,
                "status": "completed",
                "provider": "manual",
                "asset_ref": request["asset_ref"],
                "warnings": list(manual.get("warnings", [])) + ["Evidence supplied manually; no provider adapter executed."],
            })
            return {"evidence": {modality: evidence.model_dump()}}
        reason = (
            "Manual evidence was requested but not supplied."
            if request.get("missing_adapter_policy") == "manual"
            else "No production adapter is configured for this modality."
        )
        return {"evidence": {modality: Evidence(
            modality=modality,
            status="skipped",
            asset_ref=request["asset_ref"],
            warnings=[reason],
        ).model_dump()}}

    result = adapter.analyze({
        "run_id": request["run_id"],
        "project_id": request["project_id"],
        "asset_ref": request["asset_ref"],
        "query": request.get("query"),
        "options": request.get("options", {}),
    })
    evidence = Evidence.model_validate({"modality": modality, **result})
    return {"evidence": {modality: evidence.model_dump()}}


def build_intelligence_graph(adapters: IntelligenceAdapters, checkpointer: Any = None):
    """Build a multimodal graph; caller supplies auth-scoped adapters/checkpointer."""

    def semantic(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("semantic_search", adapters, state)

    def audio(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("audio", adapters, state)

    def vision(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("vision", adapters, state)

    def predictive(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("predictive", adapters, state)

    def fuse(state: IntelligenceState) -> dict[str, Any]:
        evidence = state.get("evidence", {})
        completed = [item for item in evidence.values() if item.get("status") == "completed"]
        citations = [citation for item in completed for citation in item.get("citations", [])]
        warnings = [warning for item in evidence.values() for warning in item.get("warnings", [])]
        return {"fused": {
            "completed_modalities": sorted(item["modality"] for item in completed),
            "citations": _stable_items(citations),
            "warnings": sorted(warnings),
            "evidence_count": len(completed),
        }}

    def quality(state: IntelligenceState) -> dict[str, Any]:
        evidence = state.get("evidence", {})
        requested = set(state["request"]["modalities"])
        failed = [key for key, value in evidence.items() if value.get("status") == "failed"]
        completed = [key for key, value in evidence.items() if value.get("status") == "completed"]
        missing = sorted(requested - set(completed))
        return {"quality": {
            "requested_modalities": sorted(requested),
            "completed_modalities": sorted(completed),
            "failed_modalities": sorted(failed),
            "incomplete_modalities": missing,
            "ready_for_downstream_review": bool(completed) and not failed and not missing,
        }, "status": "completed" if completed and not failed and not missing else "incomplete"}

    graph = StateGraph(IntelligenceState)
    graph.add_node("semantic_search", semantic)
    graph.add_node("audio_intelligence", audio)
    graph.add_node("computer_vision", vision)
    graph.add_node("predictive_analysis", predictive)
    graph.add_node("evidence_fusion", fuse)
    graph.add_node("quality_gate", quality)
    graph.add_edge(START, "semantic_search")
    graph.add_edge(START, "audio_intelligence")
    graph.add_edge(START, "computer_vision")
    graph.add_edge(START, "predictive_analysis")
    graph.add_edge(
        ["semantic_search", "audio_intelligence", "computer_vision", "predictive_analysis"],
        "evidence_fusion",
    )
    graph.add_edge("evidence_fusion", "quality_gate")
    graph.add_edge("quality_gate", END)
    return graph.compile(checkpointer=checkpointer)
