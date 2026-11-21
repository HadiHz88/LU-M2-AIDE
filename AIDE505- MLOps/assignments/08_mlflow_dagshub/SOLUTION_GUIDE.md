# DVC and MLflow with DagsHub: solution guide

The assignment has two parts:

1. Follow `15-MLFlow.pdf`: train models in `MLFlowSetup.ipynb`, track them with MLflow on
   DagsHub, register them, load one back and serve it.
2. Serve the trained model with a FastAPI app that has a single endpoint, `/predict`. A GitHub
   workflow builds the app into a Docker image, and while the image builds it fetches the latest
   trained model from DagsHub through MLflow.

You hand in the workflow file, the Dockerfile and the link to a **public** GitHub repository.

The reference solution is the repository
[HadiHz88/aide505-mlflow-dagshub](https://github.com/HadiHz88/aide505-mlflow-dagshub). This guide
walks through it in order. `solution/` holds every file it adds or changes.

**Starting point:** `15-MLFlow.pdf`, the starter `starter.zip` (the teacher's
`mlflow-with-daghub.zip`: `MLFlowSetup.ipynb` and `data/raw_dataset.csv`) and, as reference, lab
07's `DVC-with-Azure-Blob-Storage.pdf`.

**What was checked:** everything below was run for real on 20 November 2026 with Python 3.12,
MLflow 3.18.0, scikit-learn 1.9.1, dagshub 0.7.3 and DVC 3.67.1:

- the notebook, against DagsHub;
- `mlflow models serve` on the registered model;
- `dvc push` to DagsHub storage;
- the GitHub workflow.

The Docker image was also built and called locally, against a local MLflow server. The outputs
shown are the real ones.

**Credentials:** your DagsHub access token is a secret. It never goes into a file that Git
tracks, not even into the notebook's output.

## How the pieces fit

| What | Tool | Where it lives |
|---|---|---|
| Code: notebook, app, Dockerfile, workflow | Git | the GitHub repository |
| The dataset (23 MB, too big for Git) | DVC | DagsHub storage of the same repository |
| Runs, parameters, metrics, model files | MLflow | DagsHub's MLflow server for the repository |
| The API image | Docker | built by GitHub Actions, pushed to `ghcr.io` |

**About the dataset:** neither the written task nor `15-MLFlow.pdf` asks for DVC. The DVC handout
is attached only as a reference, and it uses the class Azure container. Keeping the dataset under
DVC still fits the assignment's title, and DagsHub gives every repository free DVC storage. So data,
runs and models end up in one place, behind one token.

## Part 1: Accounts and project

### 1. GitHub and DagsHub

1. **On GitHub:** create a public repository, here `aide505-mlflow-dagshub`, and push the starter's
   files to it.
2. **On DagsHub:** sign up with **Sign in with GitHub**, then **Create → Connect a repository →
   GitHub** and pick that repository. DagsHub mirrors it, and each repository gets an MLflow server
   and a storage space.
3. **Token:** DagsHub → your avatar → **User Settings → Tokens**. Copy the token; you need it below.

The DagsHub repository's address is `https://dagshub.com/<owner>/<repo>`, and its MLflow server
is the same address followed by `.mlflow`. Here `<owner>` is your DagsHub username.

### 2. The Python environment

```bash
python -m venv .venv && source .venv/bin/activate
pip install mlflow==3.18.0 dagshub==0.7.3 scikit-learn==1.9.1 "dvc[s3]==3.67.1" notebook
```

The repository lists these in `requirements.txt`. **Pin the versions.** The Docker image later
installs exactly the versions the model was trained with, and a model pickled with one
scikit-learn version is not guaranteed to load with another.

`dvc[s3]` is needed because DagsHub storage speaks the S3 protocol.

### 3. Version the dataset with DVC on DagsHub

```bash
git init            # skip if you cloned your GitHub repository
dvc init
dvc add data/raw_dataset.csv
git add .dvc .dvcignore data/raw_dataset.csv.dvc data/.gitignore
git commit -m "Track the dataset with DVC"
```

These are the commands of the DVC handout: Git keeps the pointer `data/raw_dataset.csv.dvc`
(md5 `42171ec985af1d3aed38f4d6f497030b`), DVC keeps the data.

Then point DVC at DagsHub storage instead of the Azure container:

```bash
dvc remote add -d origin s3://dvc
dvc remote modify origin endpointurl https://dagshub.com/<owner>/<repo>.s3
dvc remote modify origin --local access_key_id <DagsHub token>
dvc remote modify origin --local secret_access_key <DagsHub token>
dvc push
```

```text
1 file pushed
```

- DagsHub storage acts like an S3 bucket: `s3://dvc` names it, and `endpointurl` sends the
  requests to DagsHub instead of Amazon.
- DagsHub uses your token as **both** keys.
- `--local` keeps the token in `.dvc/config.local`, which Git ignores. Only the endpoint goes into
  `.dvc/config`.
- `dvc status -c` then prints `Cache and remote 'origin' are in sync.`

## Part 2: The notebook (`15-MLFlow.pdf`, steps 1 to 4)

The starter notebook does not run as given, and it lacks two things the handout says it covers:
registering a model and loading it back. The fixed version is `MLFlowSetup.ipynb` in
`solution/`. Cells marked **(added)** there are new.

### 4. Install the libraries

The first cell is `! pip3 install sklearn`. It fails: `sklearn` is a placeholder package on PyPI
that refuses to install and prints `Did you mean to install scikit-learn instead?`. The package is
`scikit-learn` (you still import it as `sklearn`):

```python
%pip install scikit-learn
```

`%pip` installs into the notebook's own environment. `! pip3` may install into another Python.
The same change applies to the `mlflow` and `dagshub` install cells.

### 5. Train two models without MLflow

These cells run as they are. They train two random forests on scikit-learn's digits dataset (8×8
images of handwritten digits), 80/20 split, `random_state=42`:

| Model | `n_estimators` | `max_depth` | Accuracy |
|---|---|---|---|
| 1 | 20 | 5 | 0.9389 |
| 2 | 100 | 10 | 0.9722 |

Nothing is saved: the numbers vanish with the output. MLflow fixes that in the second half.

### 6. Connect MLflow to DagsHub

Copy the snippet from DagsHub (**Remote → Experiments**) and replace the placeholders:

```python
import dagshub
dagshub.init(repo_owner="<owner>", repo_name="<repo>", mlflow=True)
```

```text
Initialized MLflow to track repo "HadiHz88/aide505-mlflow-dagshub"
Repository HadiHz88/aide505-mlflow-dagshub initialized!
```

The first time, `dagshub.init` opens a browser tab to log you in. To log in from a terminal
instead, run `dagshub login --token <DagsHub token>`. MLflow's tracking URI is now
`https://dagshub.com/<owner>/<repo>.mlflow`.

### 7. Fix the logging function and its calls

The corrected function also registers each model:

```python
REGISTERED_MODEL = "digits-random-forest"

def train_and_log_model(n_estimators, max_depth, run_name):
    with mlflow.start_run(run_name=run_name):
        model = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=42)
        model.fit(X_train, y_train)
        accuracy = accuracy_score(y_test, model.predict(X_test))

        mlflow.log_param("n_estimators", n_estimators)
        mlflow.log_param("max_depth", max_depth)
        mlflow.log_metric("accuracy", accuracy)
        mlflow.sklearn.log_model(
            model,
            name="model",
            serialization_format="cloudpickle",
            input_example=X_test[:1],
            registered_model_name=REGISTERED_MODEL,
        )

train_and_log_model(n_estimators=20, max_depth=5, run_name="random_forest_model_run_1")
train_and_log_model(n_estimators=100, max_depth=10, run_name="random_forest_model_run_V1.0.2")
```

What was wrong:

1. **The calls do not run.** The notebook writes
   `train_and_log_model(n_estimators=20, max_depth=5, "random_forest_model_run_1")`. Python stops
   with `SyntaxError: positional argument follows keyword argument`. Name the last argument.
2. **The runs had no name.** `run_name` was only used as the model's folder, so DagsHub listed
   the runs under random names. `start_run(run_name=...)` names the run.
3. **`log_model` fails with a recent MLflow.**
   - MLflow 3.18 saves scikit-learn models with `skops`, which refuses a random forest
     (`The saved sklearn model references untrusted types`). `serialization_format="cloudpickle"`
     selects the older format. It prints a warning about pickle files; that is fine for a model
     you trained yourself.
   - A model name cannot contain dots, so `random_forest_model_run_V1.0.2` is rejected as a name.
     The model is called `model` inside each run; the run keeps its name with the dots.

What was added:

- `input_example` records the input: 64 pixel values.
- `registered_model_name` adds a version of `digits-random-forest` to the model registry on every
  call.

```text
Successfully registered model 'digits-random-forest'.
Created version '1' of model 'digits-random-forest'.
Logged RandomForest model with n_estimators=20, max_depth=5, accuracy=0.9389
Registered model 'digits-random-forest' already exists. Creating a new version of this model...
Created version '2' of model 'digits-random-forest'.
Logged RandomForest model with n_estimators=100, max_depth=10, accuracy=0.9722
```

DagsHub's MLflow server accepted all of this with MLflow 3.18.

### 8. The model registry and loading a model (added)

```python
client = MlflowClient()
versions = client.search_model_versions(f"name='{REGISTERED_MODEL}'")
latest = max(versions, key=lambda v: int(v.version))

loaded = mlflow.sklearn.load_model(f"models:/{REGISTERED_MODEL}/{latest.version}")
print("predicted:", loaded.predict(X_test[:10]))
print("actual:   ", y_test[:10])
```

```text
version 1: run random_forest_model_run_1, accuracy 0.9389
version 2: run random_forest_model_run_V1.0.2, accuracy 0.9722
latest version: 2
predicted: [6 9 3 7 2 1 5 2 5 2]
actual:    [6 9 3 7 2 1 5 2 5 2]
```

**"Latest" means the highest version number**, i.e. the model registered last. The Docker build
uses the same rule.

### 9. See the results

The notebook's last cell says to run `mlflow ui`. With DagsHub, that starts a **local** server
that knows nothing about your runs. Open the repository on DagsHub instead
(`https://dagshub.com/<owner>/<repo>/experiments`), or follow the link MLflow prints after each
run:

```text
🏃 View run random_forest_model_run_1 at: https://dagshub.com/HadiHz88/aide505-mlflow-dagshub.mlflow/#/experiments/0/runs/a342e2a5111949699c6ccaf4a37c92f6
```

- The experiment `RandomForest_V1.0.1` holds both runs, with their parameters, accuracy and model.
- The model registry holds `digits-random-forest` with versions 1 and 2.

### 10. Serve the model with MLflow (`15-MLFlow.pdf`, step 5)

MLflow needs the same server and login as the notebook: `MLFLOW_TRACKING_URI`,
`MLFLOW_TRACKING_USERNAME` and `MLFLOW_TRACKING_PASSWORD` (the token). Set them in the
terminal, or start the server from Python after `dagshub.init(...)`, which sets all three. Then,
with the environment activated:

```bash
mlflow models serve -m "models:/digits-random-forest/2" -p 5003 --env-manager local
curl -s localhost:5003/invocations -H 'Content-Type: application/json' \
  -d '{"inputs": [[0,0,0,7,12,0,0,0,0,0,4,16,8,0,0,0,0,0,12,11,0,0,0,0,0,0,15,10,8,6,1,0,0,0,15,16,8,10,8,0,0,0,14,7,0,0,12,0,0,0,8,11,0,5,16,2,0,0,0,9,14,14,5,0]]}'
```

```text
{"predictions": [6]}
```

- `--env-manager local` uses the current environment. Without it, MLflow builds a fresh one, and
  that is what asks for `virtualenv` in the handout.
- If the environment is not activated, the server stops with `Return code = 127`: MLflow runs
  `uvicorn` by name, and the shell cannot find it.

## Part 3: The FastAPI app

`app/main.py` loads the model once at startup from `/model` (the folder the Docker build fills)
and exposes only `POST /predict`:

```python
class DigitImage(BaseModel):
    pixels: list[Annotated[float, Field(ge=0, le=16)]] = Field(min_length=64, max_length=64)

@app.post("/predict")
def predict(image: DigitImage) -> Prediction:
    probabilities = model.predict_proba(np.array([image.pixels]))[0]
    best = int(probabilities.argmax())
    return Prediction(digit=int(model.classes_[best]), probability=round(float(probabilities[best]), 4),
                      model_name=model_info["name"], model_version=model_info["version"])
```

```bash
curl -s -X POST localhost:8000/predict -H 'Content-Type: application/json' -d @app/sample.json
```

```json
{"digit":6,"probability":0.9392,"model_name":"digits-random-forest","model_version":"2"}
```

`app/sample.json` is the first test image, a 6.

- Pydantic checks the input: a list that is not 64 values from 0 to 16 gets a `422` with the
  reason (`List should have at least 64 items after validation, not 3`).
- FastAPI's generated `/docs` page is not an endpoint of the app. The OpenAPI schema lists only
  `/predict`.

## Part 4: The Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS fetch
WORKDIR /fetch
RUN pip install --no-cache-dir "mlflow-skinny==3.18.0"
COPY scripts/fetch_model.py .
ARG MLFLOW_TRACKING_URI
ARG MLFLOW_TRACKING_USERNAME
ARG MODEL_NAME=digits-random-forest
ARG CACHE_BUST
RUN --mount=type=secret,id=dagshub_token,env=MLFLOW_TRACKING_PASSWORD \
    python fetch_model.py /model

FROM python:3.12-slim
WORKDIR /srv
COPY app/requirements.txt app/requirements.txt
COPY --from=fetch /model/requirements.txt /tmp/model-requirements.txt
RUN sed -i 's/^mlflow==/mlflow-skinny==/' /tmp/model-requirements.txt \
    && pip install --no-cache-dir -r /tmp/model-requirements.txt -r app/requirements.txt
COPY --from=fetch /model /model
COPY app/ app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Stage 1 downloads the model. `scripts/fetch_model.py` asks MLflow for every version of
`digits-random-forest`, takes the highest, and downloads `models:/digits-random-forest/<version>`.
It also writes `model_info.json`, so the API can report which version answered. MLflow reads the
server address and the login from the environment variables `MLFLOW_TRACKING_URI`,
`MLFLOW_TRACKING_USERNAME` and `MLFLOW_TRACKING_PASSWORD`.

Choices that matter:

- **The token is a build secret, not a build argument.** `--mount=type=secret,...,env=` makes it
  exist only while that one command runs. A build argument would be stored in the image's
  history, where anyone who pulls the image can read it with `docker history`.
- **`CACHE_BUST` makes the build fetch again.** Docker reuses a cached step as long as its inputs
  have not changed. Registering a new model changes no file in the repository, so without this
  argument a rebuild would reuse the old download. Every build must pass a new value; the
  workflow passes its run id. Docker's own `--no-cache-filter fetch` is *not* enough. In the
  check, it re-ran the download (the log said version 3), but the final image still held
  version 2's files, copied from the cache.
- **Same library versions as training.** MLflow writes the training environment's versions into
  the model's `requirements.txt` (`scikit-learn==1.9.1`, `numpy`, `scipy`, `cloudpickle`,
  `mlflow==3.18.0` …), and stage 2 installs exactly those.
  - The full `mlflow` package also brings the tracking server and its UI. `mlflow-skinny` is the
    same client without them, so it is swapped in: the image went from 1.36 GB to 875 MB.
  - Only `requirements.txt` is copied before `pip install`, so a new model trained with the same
    versions reuses that layer.
- **The base image matches the training Python** (`python_env.yaml` in the model says 3.12).

`.dockerignore` lets in only `app/` and `scripts/`: no dataset, no `.git`, no `.venv`.

Build and run it yourself:

```bash
export DAGSHUB_TOKEN=<DagsHub token>
docker build \
  --build-arg MLFLOW_TRACKING_URI=https://dagshub.com/<owner>/<repo>.mlflow \
  --build-arg MLFLOW_TRACKING_USERNAME=<owner> \
  --build-arg CACHE_BUST=$(date +%s) \
  --secret id=dagshub_token,env=DAGSHUB_TOKEN \
  -t digits-api .
docker run --rm -p 8000:8000 digits-api
```

## Part 5: The GitHub workflow

`.github/workflows/docker.yml` runs on every push to `main` and by hand (**Actions → Build the API
image → Run workflow**). After training a new model, run it by hand: nothing in the repository
changed, so no push will trigger it.

It needs two settings under **Settings → Secrets and variables → Actions**:

- the variable `DAGSHUB_USER` (your DagsHub username);
- the secret `DAGSHUB_TOKEN`.

The steps:

1. **Check the settings.** It stops with a clear error if either is missing, and builds the image
   name in lowercase: `ghcr.io/<owner>/<repo>`, since image names cannot contain capitals.
2. **Build** with `docker/build-push-action`:
   - `build-args`: the tracking URI, the username and `CACHE_BUST=<run id>-<attempt>`;
   - `secrets: dagshub_token=${{ secrets.DAGSHUB_TOKEN }}`;
   - the GitHub Actions cache, so unchanged layers are reused.
3. **Test:** start the container, POST `app/sample.json` to `/predict` until it answers, and fail
   unless the digit is 6. The served model version goes to the run's summary.
4. **Push** the image to `ghcr.io` with the workflow's own `GITHUB_TOKEN` (`packages: write`).

The first run, on the push of the workflow, took under two minutes and went green:

```text
Downloading digits-random-forest version 2 (run 68fbb4618a4a440b93b72e9721cf50a9)
{"digit":6,"probability":0.9392,"model_name":"digits-random-forest","model_version":"2"}
```

**A package on `ghcr.io` starts out private,** even when the repository is public. To let anyone
`docker pull` it, open the package from your GitHub profile (**Packages**), then **Package
settings → Change visibility → Public**. The assignment does not require this: it asks for the
workflow, the Dockerfile and the repository.

## Checklist

- The GitHub repository is public and holds the fixed notebook, `app/`, `scripts/`, the
  `Dockerfile` and `.github/workflows/docker.yml`.
- On DagsHub: the experiment `RandomForest_V1.0.1` with two named runs, the model
  `digits-random-forest` with versions 1 and 2, and `data/raw_dataset.csv` in storage.
- No token in any tracked file: `.dvc/config.local` is not in Git, and the notebook output shows
  none.
- The latest workflow run is green, and its summary names the model version it served.
- Deliverables: the workflow file, the Dockerfile and the repository link.
