#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/jweller/deploy"
COMPOSE_PROJECT="jweller"

cd "$DEPLOY_DIR"
# The running container may have been started outside Compose and still owns port 80.
docker rm -f jweller-api >/dev/null 2>&1 || true
docker compose -p "$COMPOSE_PROJECT" up -d --build --remove-orphans
docker compose -p "$COMPOSE_PROJECT" ps

# API listens on host port 80. Wait until uvicorn is accepting requests.
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf "http://127.0.0.1:80/api/" | grep -q '"status":"ok"'; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != 1 ]; then
  docker logs --tail 50 jweller-api || true
  exit 1
fi
echo "API healthy on localhost:80"
