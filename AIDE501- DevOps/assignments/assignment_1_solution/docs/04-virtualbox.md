# 4. Run the images on a Linux VM (VirtualBox)

Goal: show that the image built on Windows runs unchanged on Linux. That is
the whole point of containers.

## Create the VM

1. Install VirtualBox <https://www.virtualbox.org>.
   - Windows/Intel: any x86_64 Ubuntu ISO.
   - Apple Silicon Macs: VirtualBox only runs **ARM64** guests, so use the
     Ubuntu Server **arm64** ISO. Our images are multi-arch, so this still works.
2. Download **Ubuntu Server 24.04 LTS** (or a newer LTS).
3. New VM: 2 vCPU, 4 GB RAM, 25 GB disk. Tick "Skip unattended installation"
   if you want to show the installer.
4. In the installer, tick **Install OpenSSH server**.
5. Network: keep **NAT** and add port forwarding (Settings → Network →
   Advanced → Port Forwarding):

| Name | Host port | Guest port |
|---|---|---|
| ssh | 2222 | 22 |
| web | 8081 | 80 |

You can now work from your Windows terminal instead of the VM window:

```powershell
ssh -p 2222 <vm-user>@127.0.0.1
```

(Alternative: "Bridged adapter" gives the VM its own LAN IP. It's simpler to
explain, but it doesn't work on every university or Wi-Fi network.)

## Install Docker Engine

Copy the script in and run it:

```powershell
scp -P 2222 scripts/install-docker.sh <vm-user>@127.0.0.1:~
```

```bash
bash install-docker.sh
newgrp docker              # or log out and back in
docker version
docker run --rm hello-world
docker info | grep -E 'Architecture|Operating System'
```

The script installs from Docker's official apt repository, not Ubuntu's
older `docker.io` package. Explain each line: signing key, apt source,
packages, `docker` group. Being in the `docker` group is effectively root.

## Copy the deployment files

The VM needs only the deploy compose file, the registry files and a `.env`.
No source code:

```powershell
ssh -p 2222 <vm-user>@127.0.0.1 "mkdir -p ~/campus-events"
scp -P 2222 -r docker-compose.deploy.yml .env.example registries <vm-user>@127.0.0.1:~/campus-events/
```

```bash
cd ~/campus-events
cp .env.example .env && nano .env      # new secrets for this machine (WEB_PORT defaults to 80 here)
```

## Pull and run from each registry

Use the **read-only** tokens here.

```bash
# alias to keep commands short
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env'

# --- Docker Hub ---
docker login -u <dockerhub-user>                       # read-only token
dc --env-file registries/dockerhub.env pull
dc --env-file registries/dockerhub.env up -d
dc --env-file registries/dockerhub.env ps
curl -s localhost/api/health
```

Open <http://localhost:8081> on Windows (the NAT forward to port 80).

```bash
# --- GHCR ---
dc --env-file registries/dockerhub.env down            # keeps the db volume
echo <ghcr-pull-token> | docker login ghcr.io -u <github-user> --password-stdin
dc --env-file registries/ghcr.env pull
dc --env-file registries/ghcr.env up -d

# --- GitLab ---
dc --env-file registries/ghcr.env down
echo <deploy-token> | docker login registry.gitlab.com -u <deploy-token-username> --password-stdin
dc --env-file registries/gitlab.env pull
dc --env-file registries/gitlab.env up -d
```

Show that the three registries served the **same** image:

```bash
docker images --digests | grep campus-events
```

Bonus point to make: the image ID is the same, because it is literally the same
image under three names.

Clean up:

```bash
docker logout; docker logout ghcr.io; docker logout registry.gitlab.com
```
