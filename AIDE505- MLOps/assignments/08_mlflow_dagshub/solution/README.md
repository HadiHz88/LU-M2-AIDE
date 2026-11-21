# AIDE505: DVC, MLflow on DagsHub, and a FastAPI model service

A random forest that recognises handwritten digits (scikit-learn's `load_digits`, 8×8 images),
tracked with MLflow on DagsHub and served by a FastAPI app with one endpoint, `POST /predict`.
A GitHub workflow builds the app into a Docker image; while the image builds, it downloads the
latest registered model from DagsHub through MLflow.

```text
MLFlowSetup.ipynb   trains two models, logs them to DagsHub, registers them, loads one back
scripts/fetch_model.py   downloads the newest version of the registered model (used by the build)
app/main.py         the FastAPI app: POST /predict
app/sample.json     one test image (a 6), used by the workflow's smoke test
Dockerfile          stage 1 fetches the model, stage 2 is the API
.github/workflows/docker.yml   builds, tests and pushes the image to ghcr.io
data/raw_dataset.csv.dvc   the course dataset, versioned with DVC (the CSV itself is not in Git)
```

## How it fits together

| What | Tool | Stored in |
|---|---|---|
| Code | Git | this GitHub repository |
| Dataset | DVC | DagsHub storage of the same repository (remote `origin` in `.dvc/config`) |
| Runs, metrics, models | MLflow | DagsHub: <https://dagshub.com/HadiHz88/aide505-mlflow-dagshub/experiments> |
| API image | Docker | `ghcr.io/hadihz88/aide505-mlflow-dagshub` |

The notebook registers every trained model as a new version of `digits-random-forest`. "Latest"
means the highest version number. Registering a model changes no file in this repository, so
after training, run the workflow by hand (**Actions → Build the API image → Run workflow**) to
ship the new model.

## Train

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook MLFlowSetup.ipynb
```

`dagshub.init(...)` in the notebook opens a browser tab to log in to DagsHub the first time.

## Get the dataset

`data/raw_dataset.csv` (23 MB, the course's DVC dataset) is not in Git; DVC stores it in the
repository's DagsHub storage. DagsHub uses your access token as both S3 keys. Keep them out of Git
with `--local`:

```bash
dvc remote modify origin --local access_key_id <DagsHub token>
dvc remote modify origin --local secret_access_key <DagsHub token>
dvc pull
```

## Build and run the API locally

```bash
export DAGSHUB_TOKEN=...   # a DagsHub access token (DagsHub > Settings > Tokens)
docker build \
  --build-arg MLFLOW_TRACKING_URI=https://dagshub.com/HadiHz88/aide505-mlflow-dagshub.mlflow \
  --build-arg MLFLOW_TRACKING_USERNAME=HadiHz88 \
  --build-arg CACHE_BUST=$(date +%s) \
  --secret id=dagshub_token,env=DAGSHUB_TOKEN \
  -t digits-api .
docker run --rm -p 8000:8000 digits-api
```

```bash
curl -s -X POST localhost:8000/predict -H 'Content-Type: application/json' -d @app/sample.json
```

```json
{"digit":6,"probability":0.9392,"model_name":"digits-random-forest","model_version":"2"}
```

`pixels` must hold 64 values from 0 to 16 (the 8×8 image, row by row); anything else is
rejected with a 422.

Or run the image the workflow built (packages on ghcr.io start out private; this needs the
package's visibility set to public in its settings, or a `docker login ghcr.io`):

```bash
docker run --rm -p 8000:8000 ghcr.io/hadihz88/aide505-mlflow-dagshub:latest
```

## Workflow settings

The workflow needs, under **Settings → Secrets and variables → Actions**:

- variable `DAGSHUB_USER`: the DagsHub username;
- secret `DAGSHUB_TOKEN`: a DagsHub access token, passed to `docker build` as a build secret so
  it never ends up in the image.

`DAGSHUB_REPO` (variable) is optional; it defaults to this repository's name.
