#!/usr/bin/env bash
# Build both images for amd64 AND arm64 and push them to one or more registries
# in a single step. Each registry's image path comes from registries/<name>.env.
#
#   scripts/publish.sh 1.0.0                     # dockerhub + ghcr + gitlab
#   scripts/publish.sh 1.0.0 ghcr                # only GHCR
#   scripts/publish.sh 1.0.0 local               # rehearse on a local registry
#
# Log in to each registry first (docker login ...). Why multi-arch? An image
# built on an Apple Silicon Mac is arm64 and fails on an x86 EC2 instance
# (t3.micro) with "exec format error". Building both fixes that for everyone.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:?usage: scripts/publish.sh <version> [registry ...]}"
shift
REGISTRIES=("$@")
[ ${#REGISTRIES[@]} -eq 0 ] && REGISTRIES=(dockerhub ghcr gitlab)
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Multi-platform builds need a BuildKit builder running in a container.
# network=host lets it reach a registry on localhost (the "local" rehearsal).
BUILDER=campus-events-builder
docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
  docker buildx create --name "$BUILDER" --driver docker-container --driver-opt network=host >/dev/null

for component in backend frontend; do
  tags=()
  for r in "${REGISTRIES[@]}"; do
    repo=$(grep -E '^IMAGE_REPO=' "registries/$r.env" | cut -d= -f2-)
    if [[ "$repo" == *"<"* ]]; then
      echo "registries/$r.env still has a <placeholder>: edit it first" >&2
      exit 1
    fi
    tags+=(--tag "$repo:$component-$VERSION")
  done
  echo "==> $component -> ${tags[*]//--tag /}"
  # Note: BuildKit also attaches a provenance attestation (how/where the image
  # was built). Registries list it as an extra "unknown/unknown" platform entry.
  docker buildx build --builder "$BUILDER" --platform "$PLATFORMS" "${tags[@]}" --push "./$component"
done
