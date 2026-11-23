"""AIVEDIO FastAPI Cloud adapter; forwards API traffic to the existing Fastify service."""
from __future__ import annotations

import os
from typing import Iterable

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

UPSTREAM = os.getenv("AIVEDIO_UPSTREAM_API_URL", "").strip().rstrip("/")
TIMEOUT = float(os.getenv("AIVEDIO_PROXY_TIMEOUT_SECONDS", "30"))

app = FastAPI(title="AIVEDIO API Adapter", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> Response:
    if not UPSTREAM:
        return JSONResponse(status_code=503, content={"ready": False, "reason": "AIVEDIO_UPSTREAM_API_URL is not configured"})
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            upstream = await client.get(f"{UPSTREAM}/ready")
        if upstream.status_code >= 500:
            return JSONResponse(status_code=503, content={"ready": False, "upstream_status": upstream.status_code})
        return JSONResponse(status_code=200, content={"ready": True, "upstream_status": upstream.status_code})
    except httpx.HTTPError:
        return JSONResponse(status_code=503, content={"ready": False, "reason": "upstream unavailable"})


HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
}


def filtered_headers(headers: Iterable[tuple[str, str]]) -> dict[str, str]:
    return {k: v for k, v in headers if k.lower() not in HOP_BY_HOP and k.lower() not in {"host", "content-length"}}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request) -> Response:
    if not UPSTREAM:
        return JSONResponse(status_code=503, content={"error": "AIVEDIO upstream is not configured"})
    url = f"{UPSTREAM}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"
    headers = filtered_headers(request.headers.items())
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
            upstream = await client.request(request.method, url, headers=headers, content=body)
    except httpx.TimeoutException:
        return JSONResponse(status_code=504, content={"error": "AIVEDIO upstream timed out"})
    except httpx.HTTPError:
        return JSONResponse(status_code=502, content={"error": "AIVEDIO upstream unavailable"})
    response_headers = filtered_headers(upstream.headers.items())
    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)
