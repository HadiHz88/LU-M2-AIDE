#!/usr/bin/env bash
# Install Docker Engine + Compose plugin on Ubuntu (VirtualBox VM or EC2),
# from Docker's official apt repository (the Ubuntu "docker.io" package lags behind).
# Source: https://docs.docker.com/engine/install/ubuntu/
#
#   curl -fsSL <raw-url-of-this-file> -o install-docker.sh   # or copy it with scp
#   bash install-docker.sh
set -euo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Trust Docker's signing key, then add the repository for this Ubuntu release.
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Run docker without sudo. Note: membership in "docker" is root-equivalent.
sudo usermod -aG docker "$USER"

sudo docker run --rm hello-world
docker compose version || sudo docker compose version
echo "Done. Log out and back in (or run 'newgrp docker') to use docker without sudo."
