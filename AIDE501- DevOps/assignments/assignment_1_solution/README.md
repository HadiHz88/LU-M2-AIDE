# Campus Events — AIDE501 Assignment 1 reference solution

A three-tier web app (React → Express → PostgreSQL) taken through the whole
lifecycle: run locally, containerize, publish to **three private registries**,
pull and run on a **VirtualBox Linux VM**, and deploy on **AWS EC2**.

```
Browser ──► frontend (nginx) ──/api──► backend (Express) ──► db (PostgreSQL)
  host :80 / :8080 → :8080        :3000 internal              :5432 internal
```

Only the frontend publishes a port. The backend and the database are reachable
only inside the compose network, by service name.

## Repository layout

| Path | What it is |
|---|---|
| `frontend/` | React (Vite) SPA, 5 pages, responsive. Multi-stage `Dockerfile` → non-root nginx. `nginx.conf` serves the app and proxies `/api`. |
| `backend/` | Express 5 REST API, JWT auth, bcrypt, rate limiting, Postgres via `pg`. Multi-stage `Dockerfile`, non-root, no npm at runtime. |
| `docker-compose.yml` | Builds and runs the three services from source (local). |
| `docker-compose.dev.yml` | Override: publishes Postgres on `127.0.0.1` for `npm run dev`. |
| `docker-compose.deploy.yml` | **Pulls** images from a registry (VM and EC2). Restart policies, log rotation, memory limits. |
| `registries/*.env` | One line per registry: `IMAGE_REPO=...`. Picks where images come from. |
| `scripts/publish.sh` | Build amd64+arm64 and push to any set of registries in one go. |
| `scripts/scan.sh` | Trivy vulnerability scan (fails on fixable HIGH/CRITICAL). |
| `scripts/install-docker.sh` | Docker Engine install for Ubuntu (VM and EC2). |
| `aws/iam/` | Least-privilege IAM policies (ECR pull for EC2, ECR push) + EC2 trust policy. |
| `.github/workflows/publish-ghcr.yml` | Bonus: build → scan → push to GHCR on every push. |
| `api.http` | Ready-to-run API requests (VS Code REST Client / JetBrains HTTP client). |
| `docs/` | Step-by-step guide, one file per part of the assignment. |

## Quick start

```bash
cp .env.example .env        # then edit the two secrets
docker compose up --build -d
```

Open <http://localhost:8080>. Stop with `docker compose down` (add `-v` to also wipe the database).

## The guide (one file ≈ one video)

| # | Assignment part | Guide |
|---|---|---|
| 1 | Develop and run the app locally | [docs/01-local-development.md](docs/01-local-development.md) |
| 2 | Dockerfile, container, compose | [docs/02-docker.md](docs/02-docker.md) |
| 3 | Publish to Docker Hub, GHCR, GitLab | [docs/03-registries.md](docs/03-registries.md) |
| 4 | VirtualBox Linux VM | [docs/04-virtualbox.md](docs/04-virtualbox.md) |
| 5a | AWS account, IAM, budgets, policies | [docs/05-aws-foundations.md](docs/05-aws-foundations.md) |
| 5b | EC2 deployment and cleanup | [docs/06-ec2-deployment.md](docs/06-ec2-deployment.md) |
| 6 | Demonstrate the API | [docs/07-api.md](docs/07-api.md) |
| 7 | Security considerations | [docs/08-security.md](docs/08-security.md) |
| 8 | Bonus: CI/CD, scanning, ECR, container management | [docs/09-bonus.md](docs/09-bonus.md) |

## Design decisions worth explaining

**"Publish the same application image" vs. three services.** The app is three
containers, so "the image" is really two images we build (frontend, backend);
the database uses the official `postgres` image and is never republished.

**Image naming: one repository per registry, component in the tag.**
Docker Hub's free plan allows a single private repository, so both images live
in one repo and the tag says which is which:

```
docker.io/<user>/campus-events:frontend-1.0.0
docker.io/<user>/campus-events:backend-1.0.0
```

The same scheme is used on GHCR, GitLab and ECR so that switching registries
is a one-line change (`registries/<name>.env`). With a paid plan you would
normally use one repository per component (`campus-events-frontend:1.0.0`).

**Multi-architecture images.** Images built on an Apple Silicon Mac are arm64
and crash on an x86 EC2 instance with `exec format error`. `scripts/publish.sh`
and the CI workflow build `linux/amd64` + `linux/arm64`, so the same tag runs on
a Windows laptop, a Mac, a `t3.micro` (x86) or a `t4g.micro` (Graviton/ARM).

**nginx as reverse proxy.** The browser only talks to one origin. No CORS, no
backend URL baked into the React build, and the API and database have no
public port. The same image works on localhost, the VM and EC2 unchanged.

## Hosting this as its own repository

GitHub only runs workflows from `.github/workflows` at the **repository root**.
To use the CI bonus, copy this folder into a new repository:

```bash
cp -R assignment_1_solution ~/campus-events && cd ~/campus-events
git init -b main && git add . && git commit -m "Initial commit"
gh repo create campus-events --private --source . --push
```
