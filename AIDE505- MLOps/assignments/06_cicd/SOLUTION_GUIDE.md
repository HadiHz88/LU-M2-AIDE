# CI/CD Part 1: solution guide

This lab automates the path from `git push` to a running app. On every push to `main`, a GitHub
Actions workflow runs the Playwright tests against the full Compose stack, then builds the frontend
and backend images and pushes them to a private Docker Hub repository. When that workflow ends
green, a GitHub webhook reaches a small deploy server on your machine through ngrok, which pulls
the new images and restarts the stack.

There is no `starter.zip`. You start from the finished lab 05 app: unzip
`04_docker_containers/starter.zip`, copy `05_docker_compose/solution/` over it, and delete
`src/auth.js`. Put that project in a new GitHub repository whose default branch is `main`.
`solution/` holds only what this lab adds or changes: the workflow, two edited app files, a README,
and `deploy/`, which is the handout's `auth-app-deploy/` folder (your machine's side, kept outside
the app repository).

## 1. The pipeline you will build

In the handout's diagram, the workflow is `.github/workflows/cicd.yml` and runs on GitHub. On your
machine, `deploy/deploy_server.py` (port 9000, reached through ngrok) runs `pull` and `up -d` on
`deploy/docker-compose.deploy.yml`. CI builds, Docker Hub stores, your machine only pulls.

## 2. Docker Hub

**2.1 Account and private repository.** Create one private repository named `auth-app`. The free
plan allows one private repository, so both images go into it, told apart by their tag:
`<docker-id>/auth-app:frontend` and `<docker-id>/auth-app:backend`.

**2.2 Access tokens.** Create two personal access tokens: `github-actions` with Read & Write (GitHub
pushes images) and `local-deploy` with Read-only (your machine pulls them). Copy each one when it
is shown: Docker never shows it again. Your machine only ever pulls, so it gets a token that cannot
overwrite your images if it leaks.

**2.3 Log in on your machine.** The images are private, so the machine that pulls them must be
logged in. Paste the `local-deploy` token as the password:

```bash
docker login --username <your-docker-id>
```

The deploy server runs `docker compose pull` as your user, so it uses this login. Without it, the
pull fails and the server logs `Deploy FAILED (see the output above)`.

## 3. GitHub Actions

### 3.1 Store the credentials in GitHub

In the repository, Settings → Secrets and variables → Actions: a variable `DOCKERHUB_USERNAME`
(your Docker ID) and a secret `DOCKERHUB_TOKEN` (the `github-actions` token). The solution's
`README.md` records these settings in a table. The username is not secret (it is part of the image
name), the token is: GitHub encrypts it and masks it in logs. Set both before your first push,
otherwise the image name becomes `/auth-app` and the login fails.

### 3.2 How a GitHub workflow works

The solution's workflow has two jobs. Each runs on a fresh `ubuntu-latest` machine, so the second
job checks out the code again. `needs: test` makes the second job wait for the first and skip if it
failed: that one line keeps a broken commit off Docker Hub.

### 3.3 Authenticating to Docker Hub

The handout's login step is used unchanged, in the `build-and-push` job. The `test` job never logs
in: it builds and runs everything on the runner.

### 3.4 The workflow

The top of `.github/workflows/cicd.yml`:

File: `.github/workflows/cicd.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main]

# Two quick pushes: the older run is cancelled, so an old image can't overwrite a newer one.
concurrency:
  group: cicd-${{ github.ref }}
  cancel-in-progress: true

env:
  IMAGE: ${{ vars.DOCKERHUB_USERNAME }}/auth-app
```

`name: CI/CD` must be exact: the deploy server compares the run's name with it. `concurrency` is
an addition to the handout: without it, two runs can push at once and the older one can finish
last. A cancelled run ends with conclusion `cancelled`, which the deploy server ignores.

**Job `test`.** It sets `POSTGRES_PASSWORD: ci-only-password` as a job-level `env:`, checks out the
code, sets up Node 24 with the npm cache, runs `npm ci` and
`npx playwright install --with-deps chromium`, then:

```yaml
      - name: Start db, backend and frontend
        run: docker compose up -d --build --wait

      - name: Wait until the API answers through nginx
        run: curl --fail --silent --show-error --retry 30 --retry-delay 1 --retry-all-errors http://localhost:5173/api/health

      # playwright.config.js has reuseExistingServer: true, so it tests the stack on :5173
      # instead of starting the Vite dev server.
      - name: Run the Playwright tests
        run: npx playwright test

      - name: Show container logs
        if: failure()
        run: docker compose logs

      - name: Keep the HTML report
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- `.env` is git-ignored since lab 05, so it is not on the runner, and `docker-compose.yml` refuses
  to start without `POSTGRES_PASSWORD`. Compose also reads variables from the shell, so the job's
  `env:` is enough. That database dies with the runner, so a fixed password is fine there and
  nowhere else.
- `--wait` returns once the containers run and `db` is healthy. The backend has no healthcheck, so
  "running" does not yet mean "listening". The `curl` loop covers that: `/api/health` goes through
  nginx to the backend, which runs `SELECT 1` on Postgres, so a 200 means all three services work.
- `playwright.config.js` is unchanged from lab 05. Its `webServer` has
  `reuseExistingServer: true`, and nginx already answers on `http://localhost:5173`, so Playwright
  tests the real stack instead of starting `npm run dev`. Only Chromium is installed because the
  config has a single `chromium` project.
- `if: failure()` prints container logs only when something broke. `if: always()` keeps the HTML
  report even when tests fail, which is when you need it. It appears as the `playwright-report`
  artifact on the run's page for 7 days.

**Job `build-and-push`.** It has `needs: test`, checks out the code, runs
`docker/setup-qemu-action@v4` and `docker/setup-buildx-action@v4`, logs in with the handout's step,
then builds one image per step. The backend step is the same as this one with
`context: ./backend`, tag `:backend` and `scope=backend`:

```yaml
      - name: Build and push the frontend
        uses: docker/build-push-action@v7
        with:
          context: .
          file: Dockerfile.multistage
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ env.IMAGE }}:frontend
          cache-from: type=gha,scope=frontend
          cache-to: type=gha,mode=max,scope=frontend
```

- The runners are `linux/amd64`, while lab 05 was measured on an Apple silicon Mac
  (`linux/arm64`). Building both platforms puts one image per CPU under each tag, and your machine
  pulls the one that runs natively. QEMU emulates arm64 on the runner, Buildx drives the build.
- The contexts and Dockerfiles are the ones `docker-compose.yml` uses, so CI pushes what it tested.
- The `gha` cache keeps BuildKit layers between runs, so a push that only changes `src/main.js`
  reuses the `npm ci` layers. `mode=max` also caches the builder stage, and `scope` keeps the two
  images' caches apart.

The multi-platform build is why `Dockerfile.multistage` changes. Only the first `FROM` is edited:

File: `Dockerfile.multistage`

```dockerfile
# $BUILDPLATFORM = the machine doing the build. The output is plain HTML/CSS/JS, the same
# for every CPU, so this stage runs natively once, even when building an arm64 image on
# an amd64 CI runner.
FROM --platform=$BUILDPLATFORM node:26-alpine AS builder
```

In lab 05 it was `FROM node:26-alpine AS builder`. Without `--platform=$BUILDPLATFORM`, Buildx would
run `npm ci` and `vite build` a second time under slow QEMU emulation, only to produce the same
files. Stage 2 (`nginx:stable-alpine`) has no `--platform`, so each platform still gets its own
nginx. The backend needs no such change: its `npm ci --omit=dev` installs only `express` and `pg`,
plain JavaScript, so emulating it is cheap.

Also delete the single-stage `Dockerfile` (lab 04's Vite dev-server image). Nothing uses it any
more: Compose and CI both build the frontend from `Dockerfile.multistage`.

The handout's five requirements:

| Requirement | Met by |
| --- | --- |
| 1. Named exactly `CI/CD` | `name: CI/CD` |
| 2. Pushes to `main` only | `on: push: branches: [main]` |
| 3. Tests the full stack, nothing pushed if a test fails | `docker compose up` then `npx playwright test`; `needs: test` |
| 4. Pushes `:frontend` and `:backend` | the two `docker/build-push-action` steps |
| 5. Green only if everything succeeded | any failed step fails its job, and a failed or skipped job fails the run |

**Checkpoint.** Push to `main`. In the solution's own repository this was the first commit,
`feat: add CI/CD pipeline for node-auth-app`, which added the lab 05 project and the pipeline
together. The Actions tab shows a CI/CD run with two jobs, "Playwright tests (full stack)" then
"Build and push images", both green, and the test step lists the three tests of
`tests/auth.spec.js` as passed. On Docker Hub, `auth-app` shows the tags `frontend` and `backend`
with a recent "last pushed" time, each for `linux/amd64` and `linux/arm64`.

## 4. Run the app from Docker Hub

Create the deploy folder outside the project (`auth-app-deploy/` in the handout, `deploy/` in
`solution/`). `deploy/docker-compose.deploy.yml` starts with `name: auth-app-deploy`. Its `db`
service is lab 05's, plus `restart: unless-stopped`. The two app services lose their `build:`:

File: `deploy/docker-compose.deploy.yml`

```yaml
  backend:
    image: ${DOCKERHUB_USERNAME:?set DOCKERHUB_USERNAME in .env}/auth-app:backend
    environment:
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/auth
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    image: ${DOCKERHUB_USERNAME}/auth-app:frontend
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: unless-stopped
```

- `image:` instead of `build:`: this file only runs what CI pushed. `restart: unless-stopped`
  brings the stack back after Docker Desktop restarts.
- The service names must stay `db`, `backend` and `frontend`: the frontend image contains
  `nginx.conf`, which forwards `/api/` to `http://backend:3000`, and the backend connects to
  `db:5432`.
- The named volume `db-data` keeps users across every `pull` and `up -d`. Because the project name
  differs, it is `auth-app-deploy_db-data`, not lab 05's `node-auth-app_db-data`: the deployed
  app starts with an empty database, so register a new user the first time.
- Your Docker ID and the database password come from a `.env` next to the file, so the compose
  file holds no account name or password. `deploy/.gitignore` excludes `.env` and
  `.webhook-secret`.

File: `deploy/.env.example`

```bash
# Copy to .env and fill in. .env is not committed.
DOCKERHUB_USERNAME=your-docker-id
POSTGRES_PASSWORD=change-me
```

**Checkpoint.** Stop the lab 05 stack first (`docker compose down` in the project folder): both
stacks publish port 5173. Then, from the deploy folder:

```bash
cp .env.example .env      # then fill in your Docker ID and a password
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

`pull` downloads your two private images (this is where the login from 2.3 matters) and
`postgres:18-alpine`. Open `http://localhost:5173`, register and log in: the app works as in lab
05, but nothing was built on your machine.

## 5. The deploy server (provided)

Save the handout's `deploy_server.py` in the deploy folder; the solution's copy is unchanged. It
accepts only requests whose `X-Hub-Signature-256` matches an HMAC-SHA256 of the body made with the
shared secret (anyone can find your ngrok URL, only GitHub knows the secret), and compares with
`hmac.compare_digest`, which takes the same time whatever the input. Then it decides:

File: `deploy/deploy_server.py`

```python
def reason_to_ignore(payload):
    """Return why this workflow_run event should NOT trigger a deploy, or None."""
    run_info = payload.get("workflow_run", {})
    if payload.get("action") != "completed":
        return f"action is '{payload.get('action')}', waiting for 'completed'"
    if run_info.get("name") != WORKFLOW_NAME:
        return f"workflow '{run_info.get('name')}' is not '{WORKFLOW_NAME}'"
    if run_info.get("head_branch") != BRANCH:
        return f"branch '{run_info.get('head_branch')}' is not '{BRANCH}'"
    if run_info.get("conclusion") != "success":
        return f"workflow conclusion is '{run_info.get('conclusion')}'"
    return None
```

Only a completed, successful `CI/CD` run on `main` deploys. The deploy (`pull` then `up -d`) runs
in a background thread because GitHub expects an answer within 10 seconds, and a lock allows one
deploy at a time. The server listens on `127.0.0.1` only: ngrok runs on the same machine, so
nothing else on your network can reach port 9000.

Generate the shared secret. The solution keeps it in a git-ignored file next to the server:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))" > .webhook-secret
```

Instead of the handout's two `export` lines, the solution adds a start script:

File: `deploy/start-deploy-server.sh`

```bash
cd "$(dirname "$0")"
export WEBHOOK_SECRET="$(cat .webhook-secret)"
export COMPOSE_FILE="$PWD/docker-compose.deploy.yml"
exec python3 deploy_server.py
```

It moves into its own folder (so `.env` and `.webhook-secret` are found wherever you start it),
sets the handout's two variables, and replaces itself with Python so Ctrl+C stops the server. It is
for macOS and Linux; on Windows, use the handout's PowerShell commands.

Run `./start-deploy-server.sh` and leave it running. It prints, in this format:

```text
[hh:mm:ss] Deploy server listening on http://localhost:9000 (GitHub calls POST /deploy)
[hh:mm:ss] Deploys successful 'CI/CD' runs on 'main' using /path/to/deploy/docker-compose.deploy.yml
```

`http://localhost:9000` in a browser shows `Deploy server is running`.

## 6. ngrok: a public address for your machine

GitHub cannot reach `localhost`, so ngrok gives your machine a public HTTPS URL that forwards to
port 9000. Sign up at https://dashboard.ngrok.com/signup, install it (`brew install ngrok` on
macOS), then:

```bash
ngrok config add-authtoken <your-authtoken>    # once per machine
ngrok http 9000
```

ngrok prints a line like `Forwarding https://your-name.ngrok-free.dev -> http://localhost:9000`.
The free dev domain is fixed, so you configure the webhook only once. `http://127.0.0.1:4040` shows
every request through the tunnel with the server's answer: the fastest way to debug the webhook.

## 7. The GitHub webhook

Settings → Webhooks → Add webhook: Payload URL `https://<ngrok-domain>/deploy`, content type
`application/json`, Secret the contents of `.webhook-secret`, events "Workflow runs" only (untick
Pushes), Active ticked.

GitHub sends a `ping` right away: the server logs `Ping from GitHub: the webhook is connected` and
Recent Deliveries shows a green tick.

Why Workflow runs and not Pushes: a push event fires before the images exist. A `workflow_run`
event fires when the run changes state, and the server deploys only on `completed` with
`success`. GitHub also sends deliveries when a run is requested and in progress; the server
answers `202` and logs lines like `Ignored: action is 'requested', waiting for 'completed'`. That
is expected.

When a delivery misbehaves, the server's answer says why:

| Answer | Cause |
| --- | --- |
| `401 Invalid signature` | the webhook secret and `.webhook-secret` differ |
| `400 Body is not JSON ...` | content type is not `application/json` |
| `404 Not found` | the Payload URL is missing `/deploy` |
| `202 Ignored event 'push'` | Pushes is still ticked |
| `202 Deploy started`, then `Deploy FAILED` in the terminal | Docker is not running, or the login (2.3) or `deploy/.env` is missing |

## 8. Run the whole pipeline

Three things must be running: Docker Desktop, the deploy server (step 5) and `ngrok http 9000`
(step 6). The solution's repository history follows the handout's script, one commit per stage:

| Commit | Message | What it shows |
| --- | --- | --- |
| `0983696` | `feat: add CI/CD pipeline for node-auth-app` | the 3.4 checkpoint |
| `c61e61c` | `feat: say the app was deployed by CI/CD` | a visible change, deployed end to end |
| `67e6098` | `test: break a test on purpose` | a red run: nothing pushed, nothing deployed |
| `d793784` | `Revert "test: break a test on purpose"` | back to green |

### A visible change

The handout suggests the Welcome heading. The solution changes the line under it instead:

File: `src/main.js`

```diff
-    <p>You are logged in.</p>
+    <p>You are logged in. Deployed automatically by CI/CD.</p>
```

The tests find the heading `Welcome, <name>!` by role and name and never read this paragraph, so
the run stays green. If you change the heading and it no longer contains `Welcome, <name>!`, the
happy-path test fails: update `tests/auth.spec.js` in the same commit.

Commit, push to `main`, and watch:

1. Actions: the CI/CD run starts, both jobs turn green.
2. Docker Hub: both tags show a new "last pushed" time.
3. Webhook → Recent Deliveries: `workflow_run` deliveries answered `202`, the `completed` one with
   `Deploy started`.
4. The deploy server terminal, in this format, with Docker's pull and up output in between:

```text
[hh:mm:ss] Deploying commit <sha>...
[hh:mm:ss] Running: docker compose -f /path/to/deploy/docker-compose.deploy.yml pull
[hh:mm:ss] Running: docker compose -f /path/to/deploy/docker-compose.deploy.yml up -d
[hh:mm:ss] Deploy finished: commit <sha> is live on http://localhost:5173
```

5. `http://localhost:5173`: log in. The welcome page now says "You are logged in. Deployed
   automatically by CI/CD." Earlier users are still there: `up -d` recreated the app containers
   but kept the `db-data` volume.

### Break a test on purpose

The solution changes the expected error message of the sad-path test, so it no longer matches what
the app shows:

File: `tests/auth.spec.js`

```diff
-  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
+  await expect(page.getByRole("alert")).toHaveText("Wrong password");
```

Push it. What you should see:

- `login with invalid credentials shows an error` fails; the other two tests pass. "Show container
  logs" runs (`if: failure()`) and the report is still uploaded (`if: always()`).
- "Build and push images" is skipped (`needs: test`) and the run is red.
- Docker Hub: the "last pushed" times do not move.
- The deploy server logs `Ignored: workflow conclusion is 'failure'`, and `http://localhost:5173`
  keeps running the last good version.

Let the red run finish before pushing the fix: with `cancel-in-progress: true`, a new push to
`main` cancels a running run, and you would see `cancelled` instead of `failure`. Then
`git revert` the broken commit and push: an ordinary green push, so the whole chain runs again.

## 9. Deliverable

A Loom video (https://www.loom.com) of the whole process, from the push to the containers running
locally: the push, the green Actions run, the new "last pushed" time on Docker Hub, the webhook
delivery, the server's `Deploy finished` line, and the change live on `http://localhost:5173`. The
red run and its `Ignored: workflow conclusion is 'failure'` line are worth showing too.

## Files in solution/

| File | New or changed | What it does |
| --- | --- | --- |
| `.github/workflows/cicd.yml` | New | The CI/CD workflow: tests the full stack, then builds and pushes both images for amd64 and arm64 |
| `Dockerfile.multistage` | Changed | Builder stage runs on `$BUILDPLATFORM`, so the static files are built once, natively |
| `src/main.js` | Changed | Welcome page says "Deployed automatically by CI/CD." (the step 8 change) |
| `README.md` | New | What the pipeline does, the repository settings, and how to run the stack and tests locally before pushing |
| `deploy/docker-compose.deploy.yml` | New | Runs db, backend and frontend from the Docker Hub images, nothing built |
| `deploy/deploy_server.py` | New (provided) | The handout's webhook receiver, unchanged |
| `deploy/start-deploy-server.sh` | New | Reads `.webhook-secret`, sets `COMPOSE_FILE`, starts the server |
| `deploy/.env.example` | New | Template for `deploy/.env` (Docker ID, database password) |
| `deploy/.gitignore` | New | Keeps `.env` and `.webhook-secret` out of Git |

Delete from the starting point: `Dockerfile`, the single-stage Vite image from lab 04.

Create yourself and never commit: `deploy/.env` (from `deploy/.env.example`),
`deploy/.webhook-secret` (step 5), and, for local runs only, the app's `.env` from lab 05.

To get the finished project:

```bash
unzip 04_docker_containers/starter.zip                 # gives node-auth-app/
cp -R 05_docker_compose/solution/. node-auth-app/
rm node-auth-app/src/auth.js                            # end of lab 05
cp -R 06_cicd/solution/. node-auth-app/
rm node-auth-app/Dockerfile
mv node-auth-app/deploy auth-app-deploy                 # your machine's side, outside the repo
```

Push `node-auth-app` to a new GitHub repository on `main`, then do steps 2 to 7 by hand: accounts,
tokens, secret, tunnel and webhook are settings no file can carry.
