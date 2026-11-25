import httpx
import pytest
from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)
RealAsyncClient = httpx.AsyncClient


def test_health_is_local():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_fails_closed_without_upstream(monkeypatch):
    monkeypatch.setattr(main, "UPSTREAM", "")
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["ready"] is False


def test_proxy_fails_closed_without_upstream(monkeypatch):
    monkeypatch.setattr(main, "UPSTREAM", "")
    response = client.get("/v1/projects")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_proxy_preserves_method_path_query_headers_body(monkeypatch):
    monkeypatch.setattr(main, "UPSTREAM", "https://api.example.test")
    captured = {}

    async def handler(request: httpx.Request):
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["authorization"] = request.headers.get("authorization")
        captured["body"] = request.content
        return httpx.Response(201, json={"created": True}, headers={"x-upstream-test": "yes"})

    monkeypatch.setattr(main.httpx, "AsyncClient", lambda **kwargs: RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs))
    response = client.post("/v1/projects?sort=recent", headers={"Authorization": "Bearer test-token"}, json={"title": "Demo"})
    assert response.status_code == 201
    assert response.json() == {"created": True}
    assert captured["method"] == "POST"
    assert captured["url"] == "https://api.example.test/v1/projects?sort=recent"
    assert captured["authorization"] == "Bearer test-token"
    assert b"Demo" in captured["body"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,payload,expected",
    [
        (401, {"ready": False}, 503),
        (404, {"ready": False}, 503),
        (200, {"ready": False}, 503),
        (200, {"ready": True}, 200),
    ],
)
async def test_ready_requires_explicit_upstream_confirmation(monkeypatch, status, payload, expected):
    monkeypatch.setattr(main, "UPSTREAM", "https://api.example.test")

    async def handler(request: httpx.Request):
        return httpx.Response(status, json=payload)

    monkeypatch.setattr(
        main.httpx,
        "AsyncClient",
        lambda **kwargs: RealAsyncClient(
            transport=httpx.MockTransport(handler), **kwargs
        ),
    )
    response = client.get("/ready")
    assert response.status_code == expected
    assert response.json()["ready"] is (expected == 200)
