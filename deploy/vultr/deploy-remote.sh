#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/jweller/deploy"
COMPOSE_PROJECT="jweller"

cd "$DEPLOY_DIR"
docker compose -p "$COMPOSE_PROJECT" up -d --build
docker compose -p "$COMPOSE_PROJECT" ps

# API listens on host port 80 (8080 is used by another stack on this VPS)
curl -sf "http://127.0.0.1:80/api/" | grep -q '"status":"ok"'
echo "API healthy on localhost:80"
