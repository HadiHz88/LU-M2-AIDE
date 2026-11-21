"""Download the newest version of a registered MLflow model.

The Docker build runs this script. MLflow reads the server and the login from the environment:
MLFLOW_TRACKING_URI (https://dagshub.com/<owner>/<repo>.mlflow), MLFLOW_TRACKING_USERNAME (the
DagsHub username) and MLFLOW_TRACKING_PASSWORD (a DagsHub access token).

Usage: python fetch_model.py <output folder>
"""

import json
import os
import sys

import mlflow
from mlflow import MlflowClient

MODEL_NAME = os.environ.get("MODEL_NAME", "digits-random-forest")


def main() -> None:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "model"
    client = MlflowClient()

    versions = client.search_model_versions(f"name='{MODEL_NAME}'")
    if not versions:
        sys.exit(f"No registered model named '{MODEL_NAME}' on {mlflow.get_tracking_uri()}")

    # "Latest" = the highest version number, i.e. the model registered most recently.
    latest = max(versions, key=lambda v: int(v.version))
    print(f"Downloading {MODEL_NAME} version {latest.version} (run {latest.run_id})")

    mlflow.artifacts.download_artifacts(
        artifact_uri=f"models:/{MODEL_NAME}/{latest.version}", dst_path=out_dir
    )

    # Recorded so the API can say which model answered.
    info = {
        "name": MODEL_NAME,
        "version": latest.version,
        "run_id": latest.run_id,
        "tracking_uri": mlflow.get_tracking_uri(),
    }
    with open(os.path.join(out_dir, "model_info.json"), "w") as f:
        json.dump(info, f, indent=2)
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
