from app.intelligence import build_intelligence_graph, merge_evidence


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


def _request(**overrides):
    request = {
        "run_id": "run-test-0001",
        "project_id": "project-1",
        "asset_ref": "asset://test/video-1",
        "modalities": ["audio", "vision", "predictive"],
        "query": "Find the speaker and scene changes",
        "options": {},
    }
    request.update(overrides)
    return {"request": request, "evidence": {}}


def test_multimodal_graph_fuses_requested_evidence():
    audio = FakeAdapter("audio")
    vision = FakeAdapter("vision")
    predictive = FakeAdapter("predictive")
    graph = build_intelligence_graph({"audio": audio, "vision": vision, "predictive": predictive})
    result = graph.invoke(_request())
    assert result["status"] == "completed"
    assert result["quality"]["completed_modalities"] == ["audio", "predictive", "vision"]
    assert result["fused"]["evidence_count"] == 3
    assert len(result["fused"]["citations"]) == 3
    assert audio.calls == vision.calls == predictive.calls == 1


def test_unconfigured_adapter_is_explicitly_skipped_not_faked():
    graph = build_intelligence_graph({})
    result = graph.invoke(_request(run_id="run-test-0002", modalities=["audio"]))
    assert result["evidence"]["audio"]["status"] == "skipped"
    assert result["status"] == "incomplete"
    assert result["quality"]["ready_for_downstream_review"] is False
    assert "audio" in result["quality"]["incomplete_modalities"]


def test_manual_evidence_policy_accepts_validated_input():
    graph = build_intelligence_graph({})
    result = graph.invoke(_request(
        run_id="run-test-manual",
        modalities=["audio"],
        missing_adapter_policy="manual",
        manual_evidence={"audio": {"observations": [{"kind": "transcript", "value": "hello"}]}},
    ))
    assert result["evidence"]["audio"]["status"] == "completed"
    assert result["evidence"]["audio"]["provider"] == "manual"
    assert result["status"] == "completed"


def test_manual_policy_without_input_is_explicitly_skipped():
    graph = build_intelligence_graph({})
    result = graph.invoke(_request(
        run_id="run-test-manual2",
        modalities=["audio"],
        missing_adapter_policy="manual",
    ))
    assert result["evidence"]["audio"]["status"] == "skipped"
    assert "not supplied" in result["evidence"]["audio"]["warnings"][0]


def test_evidence_reducer_preserves_duplicate_observations_and_conflicts():
    first = {"audio": {"status": "completed", "observations": [{"text": "same"}], "provider": "one"}}
    second = {"audio": {"status": "completed", "observations": [{"text": "same"}], "provider": "two"}}
    merged = merge_evidence(first, second)
    assert len(merged["audio"]["observations"]) == 2
    assert merged["audio"]["provider"] == "one"
    assert merged["audio"]["conflicts"] == [{"field": "provider", "values": ["one", "two"]}]
