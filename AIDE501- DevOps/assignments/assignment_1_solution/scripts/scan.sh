#!/usr/bin/env bash
# Scan local images for known vulnerabilities BEFORE publishing them.
# Exits with 1 if a HIGH or CRITICAL CVE that already has a fix is found.
#
#   docker compose build
#   scripts/scan.sh                                  # scans the two app images
#   scripts/scan.sh postgres:18-alpine               # or any image you name
#
# Trivy runs as a container: nothing to install. The cache volume keeps the
# vulnerability database between runs.
set -euo pipefail
TAG="${TAG:-1.0.0}"
IMAGES=("$@")
[ ${#IMAGES[@]} -eq 0 ] && IMAGES=("campus-events-backend:$TAG" "campus-events-frontend:$TAG")

status=0
for image in "${IMAGES[@]}"; do
  echo "==> Scanning $image"
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v trivy-cache:/root/.cache/trivy \
    aquasec/trivy:0.76.1 image \
    --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$image" || status=1
done
exit $status
