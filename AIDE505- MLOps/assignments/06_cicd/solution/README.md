# node-auth-app: CI/CD

Every push to `main` runs [`.github/workflows/cicd.yml`](.github/workflows/cicd.yml) (named **CI/CD**):

1. **test**: starts db, backend and frontend with `docker compose up --build`, then runs the Playwright tests against `http://localhost:5173`.
2. **build-and-push**: only if the tests passed, builds both images for `linux/amd64` and `linux/arm64` and pushes them to the private Docker Hub repo `<docker-id>/auth-app`, tags `backend` and `frontend`.

When the run ends green, a GitHub webhook (`workflow_run` events) reaches the deploy server on the local machine through ngrok. The server runs `docker compose pull` and `up -d` with `docker-compose.deploy.yml`.

## Repository settings

| Where | Name | Value |
| --- | --- | --- |
| Actions → Variables | `DOCKERHUB_USERNAME` | Docker ID |
| Actions → Secrets | `DOCKERHUB_TOKEN` | Docker Hub token, Read & Write |
| Webhooks | Payload URL | `https://<ngrok-domain>/deploy`, JSON, *Workflow runs* only |

## Run locally

```bash
cp .env.example .env
docker compose up --build        # app on http://localhost:5173
npm ci && npx playwright test     # in another terminal
```
