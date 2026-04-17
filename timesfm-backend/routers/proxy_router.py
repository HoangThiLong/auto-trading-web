import hashlib
import hmac
import os
import time
from typing import Any, Dict

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

proxy_router = APIRouter(prefix="/api/proxy", tags=["proxy"])

MEXC_BASE_URL = os.getenv("MEXC_BASE_URL", "https://contract.mexc.com")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing required env var: {name}")
    return value


def _mexc_signature(api_key: str, secret_key: str, request_time: str, body: str = "") -> str:
    sign_payload = f"{api_key}{request_time}{body}"
    return hmac.new(secret_key.encode("utf-8"), sign_payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _extract_forward_headers(request: Request) -> Dict[str, str]:
    header_aliases = {
        "apikey": "ApiKey",
        "request-time": "Request-Time",
        "signature": "Signature",
        "content-type": "Content-Type",
    }
    forwarded: Dict[str, str] = {}
    for key, value in request.headers.items():
        alias = header_aliases.get(key.lower())
        if alias:
            forwarded[alias] = value
    return forwarded


@proxy_router.get("/mexc/balance")
async def proxy_mexc_balance() -> Dict[str, Any]:
    api_key = _require_env("MEXC_API_KEY")
    secret_key = _require_env("MEXC_SECRET_KEY")

    request_time = str(int(time.time() * 1000))
    signature = _mexc_signature(api_key, secret_key, request_time)

    headers = {
        "ApiKey": api_key,
        "Request-Time": request_time,
        "Signature": signature,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.get(f"{MEXC_BASE_URL}/api/v1/private/account/assets", headers=headers)

    try:
        payload: Dict[str, Any] = response.json()
    except Exception:
        payload = {"success": False, "message": response.text}

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=payload)

    return payload


class ProxyAiChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=12000)
    provider: str = Field(default="gemini")


@proxy_router.post("/ai/chat")
async def proxy_ai_chat(req: ProxyAiChatRequest) -> Dict[str, Any]:
    provider = req.provider.strip().lower()
    if provider != "gemini":
        raise HTTPException(status_code=400, detail="Only 'gemini' provider is supported in this sample endpoint")

    api_key = _require_env("GEMINI_API_KEY")
    gemini_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    )

    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": req.prompt,
                    }
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(gemini_url, json=body)

    try:
        payload: Dict[str, Any] = response.json()
    except Exception:
        payload = {"error": response.text}

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=payload)

    text = (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    return {
        "provider": "gemini",
        "model": GEMINI_MODEL,
        "text": text,
        "raw": payload,
    }


@proxy_router.get("/mexc_v1/{path:path}")
async def proxy_mexc_v1_get(path: str, request: Request) -> Any:
    """Universal proxy for MEXC GET endpoints."""
    params = dict(request.query_params)
    headers = _extract_forward_headers(request)
    url = f"{MEXC_BASE_URL}/api/v1/{path}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params, headers=headers or None)

    try:
        payload: Any = response.json()
    except Exception:
        payload = response.text

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=payload)

    return payload


@proxy_router.post("/mexc_v1/{path:path}")
async def proxy_mexc_v1_post(path: str, request: Request) -> Any:
    """Universal proxy for MEXC POST endpoints."""
    headers = _extract_forward_headers(request)
    url = f"{MEXC_BASE_URL}/api/v1/{path}"

    try:
        body = await request.json()
    except Exception:
        body = {}

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=body, headers=headers or None)

    try:
        payload: Any = response.json()
    except Exception:
        payload = response.text

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=payload)

    return payload
