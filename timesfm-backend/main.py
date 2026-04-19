import os
import asyncio
from typing import List

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routers.proxy_router import proxy_router

load_dotenv()


def resolve_allowed_origins() -> List[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:5173"]


app = FastAPI(title="TimesFM + Proxy Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(proxy_router)

model = None
model_mode = None  # "v2_5" | "legacy"
MAX_HORIZON = 256

# ─── Concurrency Control ────────────────────────────────────────────────────
# Semaphore limits concurrent model inference to prevent OOM on GPU/CPU.
# MAX_CONCURRENT_INFERENCES can be tuned via environment variable.
MAX_CONCURRENT_INFERENCES = int(os.getenv("MAX_CONCURRENT_INFERENCES", "2"))
inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT_INFERENCES)

# Track active/queued requests for observability
_active_inferences = 0
_total_inferences = 0
_rejected_inferences = 0


@app.on_event("startup")
def load_model():
    global model, model_mode
    try:
        import timesfm
        import torch

        torch.set_float32_matmul_precision("high")

        # Ưu tiên API TimesFM 2.5 nếu package hiện tại hỗ trợ
        if hasattr(timesfm, "TimesFM_2p5_200M_torch") and hasattr(timesfm, "ForecastConfig"):
            model = timesfm.TimesFM_2p5_200M_torch.from_pretrained("google/timesfm-2.5-200m-pytorch")
            model.compile(
                timesfm.ForecastConfig(
                    max_context=1024,
                    max_horizon=MAX_HORIZON,
                    normalize_inputs=True,
                    use_continuous_quantile_head=True,
                    force_flip_invariance=True,
                    infer_is_positive=True,
                    fix_quantile_crossing=True,
                )
            )
            model_mode = "v2_5"
            print("✅ TimesFM 2.5 model loaded successfully")
            return

        # Fallback cho package timesfm 1.3.0 (API cũ)
        model = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                backend="cpu",
                per_core_batch_size=32,
                horizon_len=MAX_HORIZON,
                num_layers=50,
                context_len=2048,
                use_positional_embedding=False,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-2.0-500m-pytorch",
            ),
        )
        model_mode = "legacy"
        print("✅ TimesFM legacy model loaded successfully (timesfm 1.x API)")
    except Exception as e:
        print("⚠️ Warning: Could not load TimesFM model locally. Please check your python environment and packages: ", e)


class ForecastRequest(BaseModel):
    history: List[float]
    horizon: int = 12


@app.get("/health")
def health():
    return {
        "ok": True,
        "model_loaded": bool(model),
        "model_mode": model_mode,
        "allowed_origins": resolve_allowed_origins(),
    }


@app.get("/api/forecast/status")
async def forecast_status():
    """Returns the current inference queue status for observability."""
    return {
        "max_concurrent": MAX_CONCURRENT_INFERENCES,
        "active_inferences": _active_inferences,
        "total_processed": _total_inferences,
        "total_rejected": _rejected_inferences,
        "queue_available": inference_semaphore._value,
    }


@app.post("/api/forecast")
async def forecast(req: ForecastRequest):
    global _active_inferences, _total_inferences, _rejected_inferences

    if not model:
        raise HTTPException(status_code=503, detail="Model is not loaded or missing dependencies.")

    if req.horizon < 1 or req.horizon > MAX_HORIZON:
        raise HTTPException(status_code=400, detail=f"horizon must be between 1 and {MAX_HORIZON}")

    # Non-blocking check: if all slots are occupied, reject immediately with 503
    # This prevents HeadlessBot from hanging indefinitely waiting for inference
    if inference_semaphore._value <= 0:
        _rejected_inferences += 1
        raise HTTPException(
            status_code=503,
            detail=f"Inference queue full ({MAX_CONCURRENT_INFERENCES} concurrent max). Retry later.",
        )

    async with inference_semaphore:
        _active_inferences += 1
        try:
            # Run model inference in a thread pool to avoid blocking the event loop
            result = await asyncio.get_event_loop().run_in_executor(
                None, _run_inference, req.history, req.horizon
            )
            _total_inferences += 1
            return {"point_forecast": result}
        finally:
            _active_inferences -= 1


def _run_inference(history: List[float], horizon: int) -> List[float]:
    """Synchronous model inference, executed in thread pool."""
    inputs = [np.array(history, dtype=np.float32)]

    if model_mode == "v2_5":
        point_forecast, _ = model.forecast(
            horizon=horizon,
            inputs=inputs,
        )
        result = point_forecast[0]
    else:
        # API cũ không nhận tham số horizon trực tiếp
        point_forecast, _ = model.forecast(
            inputs=inputs,
            freq=[0],
        )
        result = point_forecast[0][:horizon]

    return result.tolist()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
