# syntax=docker/dockerfile:1

# Stage 1: download the latest registered model from DagsHub through MLflow.
FROM python:3.12-slim AS fetch
WORKDIR /fetch
RUN pip install --no-cache-dir "mlflow-skinny==3.18.0"
COPY scripts/fetch_model.py .
ARG MLFLOW_TRACKING_URI
ARG MLFLOW_TRACKING_USERNAME
ARG MODEL_NAME=digits-random-forest
# Docker caches each step and reuses it while its inputs are unchanged. Nothing in the
# repository changes when a new model is registered, so without this argument a rebuild would
# reuse the old download. Pass a new value on every build (the workflow passes its run id).
ARG CACHE_BUST
# The DagsHub token is a build secret: it exists only while this command runs and is never
# written to a layer or to the image history (a build argument would be).
RUN --mount=type=secret,id=dagshub_token,env=MLFLOW_TRACKING_PASSWORD \
    python fetch_model.py /model

# Stage 2: the API.
FROM python:3.12-slim
WORKDIR /srv
# Install the exact library versions the model was trained with (MLflow writes them to the
# model's requirements.txt), then FastAPI. The full `mlflow` package also brings the tracking
# server and its UI, which the API never uses; `mlflow-skinny` is the same client library
# without them, at the same version. Only requirements.txt is copied here, so a new model
# trained with the same versions reuses this layer instead of reinstalling everything.
COPY app/requirements.txt app/requirements.txt
COPY --from=fetch /model/requirements.txt /tmp/model-requirements.txt
RUN sed -i 's/^mlflow==/mlflow-skinny==/' /tmp/model-requirements.txt \
    && pip install --no-cache-dir -r /tmp/model-requirements.txt -r app/requirements.txt
COPY --from=fetch /model /model
COPY app/ app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
