"""FastAPI service for the digits model the Docker build downloaded from DagsHub.

One endpoint: POST /predict takes an 8x8 image of a handwritten digit (64 pixel values from 0
to 16, row by row, as in scikit-learn's load_digits) and returns the predicted digit.
"""

import json
import os
from pathlib import Path
from typing import Annotated

import mlflow.sklearn
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/model"))

model = mlflow.sklearn.load_model(str(MODEL_DIR))
model_info = json.loads((MODEL_DIR / "model_info.json").read_text())

app = FastAPI(title="Digits classifier", version=model_info["version"])

Pixel = Annotated[float, Field(ge=0, le=16)]


class DigitImage(BaseModel):
    pixels: list[Pixel] = Field(min_length=64, max_length=64)


class Prediction(BaseModel):
    digit: int
    probability: float
    model_name: str
    model_version: str


@app.post("/predict")
def predict(image: DigitImage) -> Prediction:
    probabilities = model.predict_proba(np.array([image.pixels]))[0]
    best = int(probabilities.argmax())
    return Prediction(
        digit=int(model.classes_[best]),
        probability=round(float(probabilities[best]), 4),
        model_name=model_info["name"],
        model_version=model_info["version"],
    )
