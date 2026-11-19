#!/bin/sh
# Starts deploy_server.py with the settings from section 5 of the guide.
# The secret is the same value as the GitHub webhook's secret; it lives in .webhook-secret (not committed).
cd "$(dirname "$0")"
export WEBHOOK_SECRET="$(cat .webhook-secret)"
export COMPOSE_FILE="$PWD/docker-compose.deploy.yml"
exec python3 deploy_server.py
