#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/jweller/deploy"

cd "$DEPLOY_DIR"
docker compose up -d --build
docker compose ps

curl -sf "http://127.0.0.1:8080/api/" | grep -q '"status":"ok"'
echo "API healthy on localhost:8080"
