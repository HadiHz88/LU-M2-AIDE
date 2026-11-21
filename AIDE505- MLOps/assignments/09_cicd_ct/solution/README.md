# bank-marketing-ci-cd-ct

AIDE505 exercise: CI/CD/CT for a bank marketing classifier with GitHub Actions, MLflow on DagsHub
and DVC.

Run it from **Actions → Bank Marketing CI/CD/CT → Run workflow**: `pipeline` with a dataset
version (`v1`, `v2`, `v3`), or `rollback` with an approved model version. Each run uploads its
`decision.json` as the `pipeline-results` artifact.

The workflow needs the variables `MLFLOW_TRACKING_URI` and `MLFLOW_TRACKING_USERNAME`, and the
secrets `MLFLOW_TRACKING_PASSWORD` and `AZURE_SAS_TOKEN`.
