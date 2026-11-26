"""Provider-neutral multimodal intelligence contracts and LangGraph workflow.

Concrete model providers are injected as adapters. This module never pretends a
modality ran when no adapter is configured; it records an explicit skipped state.
"""
from __future__ import annotations

from typing import Any, Literal, Protocol, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ConfigDict


Modality = Literal["semantic_search", "audio", "vision", "predictive"]


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


class IntelligenceState(TypedDict, total=False):
    request: dict[str, Any]
    evidence: dict[str, dict[str, Any]]
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
        return {"evidence": {modality: Evidence(
            modality=modality,
            status="skipped",
            asset_ref=request["asset_ref"],
            warnings=["No production adapter is configured for this modality."],
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
    """Build a composable graph; caller supplies auth-scoped adapters/checkpointer."""

    def semantic(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("semantic_search", adapters, state)

    def audio(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("audio", adapters, state)

    def vision(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("vision", adapters, state)

    def fuse(state: IntelligenceState) -> dict[str, Any]:
        evidence = state.get("evidence", {})
        completed = [item for item in evidence.values() if item.get("status") == "completed"]
        citations = [citation for item in completed for citation in item.get("citations", [])]
        warnings = [warning for item in evidence.values() for warning in item.get("warnings", [])]
        return {"fused": {
            "completed_modalities": sorted(item["modality"] for item in completed),
            "citations": citations,
            "warnings": warnings,
            "evidence_count": len(completed),
        }}

    def predictive(state: IntelligenceState) -> dict[str, Any]:
        return _run_adapter("predictive", adapters, state)

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
            "ready_for_downstream_review": bool(completed) and not failed,
        }, "status": "completed" if completed and not failed else "incomplete"}

    graph = StateGraph(IntelligenceState)
    graph.add_node("semantic_search", semantic)
    graph.add_node("audio_intelligence", audio)
    graph.add_node("computer_vision", vision)
    graph.add_node("evidence_fusion", fuse)
    graph.add_node("predictive_analysis", predictive)
    graph.add_node("quality_gate", quality)
    graph.add_edge(START, "semantic_search")
    graph.add_edge("semantic_search", "audio_intelligence")
    graph.add_edge("audio_intelligence", "computer_vision")
    graph.add_edge("computer_vision", "evidence_fusion")
    graph.add_edge("evidence_fusion", "predictive_analysis")
    graph.add_edge("predictive_analysis", "quality_gate")
    graph.add_edge("quality_gate", END)
    return graph.compile(checkpointer=checkpointer)
