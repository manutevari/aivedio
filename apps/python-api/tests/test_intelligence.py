from app.intelligence import build_intelligence_graph


class FakeAdapter:
    def __init__(self, modality):
        self.modality = modality
        self.calls = 0

    def analyze(self, payload):
        self.calls += 1
        return {
            "status": "completed",
            "provider": "test",
            "model_version": "fixture-1",
            "asset_ref": payload["asset_ref"],
            "observations": [{"kind": "fixture", "value": self.modality}],
            "citations": [{"asset_ref": payload["asset_ref"], "timestamp_ms": 1200}],
            "confidence": 0.95,
        }


def test_multimodal_graph_fuses_requested_evidence():
    audio = FakeAdapter("audio")
    vision = FakeAdapter("vision")
    predictive = FakeAdapter("predictive")
    graph = build_intelligence_graph({"audio": audio, "vision": vision, "predictive": predictive})
    result = graph.invoke({
        "request": {
            "run_id": "run-test-0001",
            "project_id": "project-1",
            "asset_ref": "asset://test/video-1",
            "modalities": ["audio", "vision", "predictive"],
            "query": "Find the speaker and scene changes",
            "options": {},
        },
        "evidence": {},
    })
    assert result["status"] == "completed"
    assert result["quality"]["completed_modalities"] == ["audio", "predictive", "vision"]
    assert result["fused"]["evidence_count"] == 3
    assert len(result["fused"]["citations"]) == 3
    assert audio.calls == vision.calls == predictive.calls == 1


def test_unconfigured_adapter_is_explicitly_skipped_not_faked():
    graph = build_intelligence_graph({})
    result = graph.invoke({
        "request": {
            "run_id": "run-test-0002",
            "project_id": "project-1",
            "asset_ref": "asset://test/audio-1",
            "modalities": ["audio"],
            "options": {},
        },
        "evidence": {},
    })
    assert result["evidence"]["audio"]["status"] == "skipped"
    assert result["status"] == "incomplete"
    assert result["quality"]["ready_for_downstream_review"] is False
