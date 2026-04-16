from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
model_mode = None  # "v2_5" | "legacy"
MAX_HORIZON = 256


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


@app.post("/api/forecast")
def forecast(req: ForecastRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model is not loaded or missing dependencies.")

    if req.horizon < 1 or req.horizon > MAX_HORIZON:
        raise HTTPException(status_code=400, detail=f"horizon must be between 1 and {MAX_HORIZON}")

    inputs = [np.array(req.history, dtype=np.float32)]

    if model_mode == "v2_5":
        point_forecast, _ = model.forecast(
            horizon=req.horizon,
            inputs=inputs,
        )
        result = point_forecast[0]
    else:
        # API cũ không nhận tham số horizon trực tiếp
        point_forecast, _ = model.forecast(
            inputs=inputs,
            freq=[0],
        )
        result = point_forecast[0][:req.horizon]

    return {
        "point_forecast": result.tolist(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
