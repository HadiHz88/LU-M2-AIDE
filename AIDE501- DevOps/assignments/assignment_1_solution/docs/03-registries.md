# 3. Publish the images to three private registries

The flow is the same everywhere: **create a private repository → create a
token → `docker login` → `docker tag` → `docker push`**. Do Docker Hub slowly
and in full; for GHCR and GitLab, focus on what is different.

We publish two images per registry (see "Image naming" in the README):
`<IMAGE_REPO>:backend-1.0.0` and `<IMAGE_REPO>:frontend-1.0.0`.

Build them first:

```bash
docker compose build        # produces campus-events-backend:1.0.0 and campus-events-frontend:1.0.0
```

> **Tokens, not passwords.** Each registry gets a token with only the scopes it
> needs. You can revoke a token without changing your password, and it can't
> sign in to the website. Use **write** tokens on your laptop only, and
> **read-only** tokens on servers (VM, EC2).

> **Always use `--password-stdin`.** A token passed with `-p` ends up in your
> shell history and in the process list.

## A. Docker Hub

1. Sign up at <https://hub.docker.com>.
2. **Create the repository first, as Private**: Repositories → Create → name
   `campus-events`, visibility **Private**. (If you push to a repository that
   doesn't exist yet, Docker Hub creates it with your default visibility, which
   is usually public.)
3. Account settings → Personal access tokens → Generate:
   - `laptop-push`: access **Read & Write**
   - `server-pull`: access **Read-only** (for the VM and EC2)
4. Log in, tag, push:

```bash
docker login -u <dockerhub-user>           # paste the Read & Write token as password
docker tag campus-events-backend:1.0.0  docker.io/<dockerhub-user>/campus-events:backend-1.0.0
docker tag campus-events-frontend:1.0.0 docker.io/<dockerhub-user>/campus-events:frontend-1.0.0
docker push docker.io/<dockerhub-user>/campus-events:backend-1.0.0
docker push docker.io/<dockerhub-user>/campus-events:frontend-1.0.0
```

Show the repository page: two tags, the lock icon (private), digest, size.

## B. GitHub Container Registry (GHCR)

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Tokens (classic)** → Generate new token (classic). GHCR only accepts
   classic tokens for `docker login`.
   - `ghcr-push`: scope **`write:packages`** (it includes `read:packages`). Set an expiry.
   - `ghcr-pull`: scope **`read:packages`** only.
2. Log in, tag, push (image path must be **lowercase**):

```bash
echo <ghcr-push-token> | docker login ghcr.io -u <github-user> --password-stdin
# PowerShell: "<token>" | docker login ghcr.io -u <github-user> --password-stdin
docker tag campus-events-backend:1.0.0  ghcr.io/<github-user>/campus-events:backend-1.0.0
docker tag campus-events-frontend:1.0.0 ghcr.io/<github-user>/campus-events:frontend-1.0.0
docker push ghcr.io/<github-user>/campus-events:backend-1.0.0
docker push ghcr.io/<github-user>/campus-events:frontend-1.0.0
```

3. Check github.com/<github-user>?tab=packages → `campus-events` → Package
   settings: visibility is **Private** by default on first push. Optionally
   "Connect repository" to link it to the source repo.

## C. GitLab Container Registry

1. Sign up at <https://gitlab.com>, create a project `campus-events` with
   visibility **Private**. The registry is part of the project. It is enabled
   by default; check Settings → General → Visibility → **Container registry**.
   Its visibility follows the project (private → only members can pull).
2. Deploy → Container registry shows the exact login and push commands for your project.
3. Tokens:
   - Laptop: avatar → Edit profile → Access tokens → **Personal access token** with
     scopes `read_registry` + `write_registry`, with an expiry date.
   - Servers: project → Settings → Repository → **Deploy tokens** → scope
     `read_registry` only. A deploy token is tied to *this project* only, not
     to your whole account. This is the least-privilege option.
4. Log in, tag, push:

```bash
echo <gitlab-pat> | docker login registry.gitlab.com -u <gitlab-user> --password-stdin
docker tag campus-events-backend:1.0.0  registry.gitlab.com/<gitlab-user>/campus-events:backend-1.0.0
docker tag campus-events-frontend:1.0.0 registry.gitlab.com/<gitlab-user>/campus-events:frontend-1.0.0
docker push registry.gitlab.com/<gitlab-user>/campus-events:backend-1.0.0
docker push registry.gitlab.com/<gitlab-user>/campus-events:frontend-1.0.0
```

## Do all three at once (after you have shown it by hand)

Fill in `registries/dockerhub.env`, `ghcr.env` and `gitlab.env`, log in to
all three, then:

```bash
scripts/publish.sh 1.0.0           # Git Bash / WSL / macOS / Linux
```

It builds **one** multi-architecture image (amd64 + arm64) per component and
pushes it to all three registries. All three registries then hold the same
image, with the same digest.

No account yet? Rehearse with a local registry. It's the same kind of server
Docker Hub runs:

```bash
docker run -d --name registry -p 5001:5000 registry:3
scripts/publish.sh 1.0.0 local
curl http://localhost:5001/v2/campus-events/tags/list
```

## Where did my credentials go?

```bash
cat ~/.docker/config.json
```

On Docker Desktop, a credential helper (`desktop`, `wincred`, `osxkeychain`)
stores the tokens in the OS keychain. On a plain Linux server they go into
`~/.docker/config.json` **base64-encoded, not encrypted**, which is why
`docker login` warns you. Servers get read-only tokens, and you run
`docker logout <registry>` when you're done.
