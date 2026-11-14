# 2. Docker: images, containers, compose

## Vocabulary (say it once, clearly)

- **Image**: a read-only template (filesystem layers + metadata). Built from a `Dockerfile`.
- **Container**: a running instance of an image, with its own writable layer, network and process tree.
- **Registry / repository / tag**: where images are stored / a named collection / a version label.
  `docker.io/alice/campus-events:backend-1.0.0` = registry / namespace / repository : tag.

## Read the Dockerfiles

`backend/Dockerfile` (two stages):

1. `deps` stage runs `npm ci --omit=dev`. Copying `package*.json` **before** the
   source means this slow layer is cached until dependencies change.
2. Runtime stage copies only `node_modules` and `src`, removes npm (not needed
   at runtime, and the main source of CVEs), runs as the `node` user, declares a
   `HEALTHCHECK`, and uses exec-form `CMD` so `docker stop` reaches node directly.

`frontend/Dockerfile` (two stages):

1. `build` stage: Node compiles React to static files in `dist/`.
2. Runtime stage: `nginx-unprivileged` + `dist/` + `nginx.conf`. No Node, no
   source code. Non-root, so it listens on 8080.

`.dockerignore` keeps `node_modules`, `.env` and `.git` out of the build
context: faster builds and no secrets in images.

## Build and run ONE container

```bash
docker build -t campus-events-frontend:1.0.0 ./frontend
docker images campus-events-frontend
docker history campus-events-frontend:1.0.0        # the layers
docker run -d --name web -p 8080:8080 campus-events-frontend:1.0.0
docker ps                                          # STATUS shows (healthy)
curl http://localhost:8080/healthz                 # PowerShell: curl.exe ...
docker logs web
docker rm -f web
```

The page loads but API calls fail: nginx cannot find a host called `backend`.
A single container is not the application. That is why we need compose.

## Run the whole application with compose

```bash
cp .env.example .env                 # PowerShell: copy .env.example .env
docker compose up --build -d
docker compose ps
docker compose logs -f backend       # Ctrl+C to stop following
```

Open <http://localhost:8080>.

What `docker-compose.yml` shows:

| Feature | Where |
|---|---|
| 3 services | `db`, `backend`, `frontend` |
| Service discovery by name | `DATABASE_URL=...@db:5432`, nginx `proxy_pass http://backend:3000` |
| Start order with health | `depends_on: condition: service_healthy` |
| Persistent data | named volume `db-data` |
| Secrets from the environment | `${POSTGRES_PASSWORD:?...}` fails fast if missing |
| Only one public port | `frontend` has `ports:`, the others don't |

Prove the isolation:

```bash
docker compose exec backend wget -qO- http://localhost:3000/api/health   # works inside
curl http://localhost:3000/api/health                                    # fails from the host
```

Prove persistence:

```bash
docker compose down        # containers and network removed, volume kept
docker compose up -d       # your users and events are still there
docker compose down -v     # -v also deletes the volume: data gone
```
