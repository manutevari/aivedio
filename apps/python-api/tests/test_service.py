from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)


def _payload(thread_id="thread-test-123"):
    return {"thread_id": thread_id, "project_id": "project-1", "user_id": "user-1", "brief": "A test brief"}


def test_health_is_live_without_secrets():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_fails_closed_without_runtime_configuration(monkeypatch):
    monkeypatch.setattr(main, "DATABASE_URL", "")
    monkeypatch.setattr(main, "INTERNAL_TOKEN", "")
    monkeypatch.setattr(main, "OPENROUTER_KEY", "")
    monkeypatch.setattr(main.app.state, "graph", None)
    assert client.get("/ready").status_code == 503


def test_internal_routes_reject_missing_bearer_token():
    assert client.post("/internal/v1/agent-runs", json=_payload()).status_code == 401


def test_internal_routes_fail_closed_if_token_not_configured(monkeypatch):
    monkeypatch.setattr(main, "INTERNAL_TOKEN", "")
    response = client.post("/internal/v1/agent-runs", headers={"Authorization": "Bearer anything"}, json=_payload("thread-test-456"))
    assert response.status_code == 503


def test_invalid_token_is_rejected_before_readiness(monkeypatch):
    monkeypatch.setattr(main, "INTERNAL_TOKEN", "expected-secret")
    monkeypatch.setattr(main.app.state, "graph", None)
    response = client.post("/internal/v1/agent-runs", headers={"Authorization": "Bearer wrong-secret"}, json=_payload("thread-test-789"))
    assert response.status_code == 401


def test_valid_token_reaches_readiness_and_returns_503(monkeypatch):
    monkeypatch.setattr(main, "INTERNAL_TOKEN", "expected-secret")
    monkeypatch.setattr(main.app.state, "graph", None)
    response = client.post("/internal/v1/agent-runs", headers={"Authorization": "Bearer expected-secret"}, json=_payload("thread-test-101"))
    assert response.status_code == 503


def test_audit_routes_to_human_gate_only_when_passed():
    state = {"audit": {"verdict": "pass", "score": 80, "findings": []}, "repair_count": 0}
    assert main._route_after_audit(state) == "human_gate"


def test_audit_retries_patch_for_noncritical_failure_with_budget():
    state = {"audit": {"verdict": "needs_changes", "score": 50, "findings": []}, "repair_count": 0}
    assert main._route_after_audit(state) == "patcher"


def test_audit_blocks_after_repair_budget_exhausted():
    state = {"audit": {"verdict": "fail", "score": 10, "findings": []}, "repair_count": 2}
    assert main._route_after_audit(state) == "human_gate"


def test_critical_audit_finding_never_routes_to_approval():
    state = {"audit": {"verdict": "pass", "score": 99, "findings": [{"severity": "critical"}]}, "repair_count": 2}
    assert main._route_after_audit(state) == "human_gate"


def test_langgraph_checkpoint_pause_and_resume_at_human_gate(monkeypatch):
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command

    def fake_json_call(role, instruction, payload):
        if role == "Improvisor":
            return {"ideas": [], "recommendedDirection": "Keep the brief clear", "assumptions": []}
        if role == "Implementation Agent":
            return {"steps": [], "requirements": [], "risks": [], "rollback": "Restore previous brief"}
        if role == "Patcher":
            return {"target": "projects.creative_brief", "before": payload["brief"], "after": payload["brief"] + " refined", "summary": "Clarified brief", "reversible": True}
        if role == "Auditor":
            return {"verdict": "pass", "score": 90, "findings": [], "summary": "Pass"}
        raise AssertionError(role)

    monkeypatch.setattr(main, "_json_call", fake_json_call)
    graph = main.build_graph(InMemorySaver())
    config = {"configurable": {"thread_id": "test-thread-pause-resume"}}
    initial = {"thread_id": "test-thread-pause-resume", "project_id": "project-1", "user_id": "user-1",
               "brief": "Original brief", "requested_outcome": "Improve clarity", "repair_count": 0}
    graph.invoke(initial, config=config)
    paused = graph.get_state(config)
    assert paused.next == ("human_gate",)
    assert paused.values["audit"]["verdict"] == "pass"
    resumed = graph.invoke(Command(resume={"decision": "approve", "actor_id": "trusted-test-reviewer", "notes": "Test approval"}), config=config)
    assert resumed["status"] == "approved"
    assert resumed["approval"]["decision"] == "approve"
