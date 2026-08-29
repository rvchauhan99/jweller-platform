# Vultr demo deploy (Jweller API)

Bangalore Shared CPU — Docker Compose: **FastAPI only**. Mongo is **Atlas** (`MONGO_URL` in `.env`).

## First deploy

```bash
# on Mac, from repo root
rsync -avz --exclude '__pycache__' --exclude '.env' --exclude 'tests' \
  backend/ root@SERVER_IP:/opt/jweller/backend/
rsync -avz deploy/vultr/ root@SERVER_IP:/opt/jweller/deploy/
scp deploy/.env root@SERVER_IP:/opt/jweller/deploy/.env

ssh root@SERVER_IP
cd /opt/jweller/deploy
docker compose up -d --build
```

Allow the VPS public IP in **Atlas → Network Access** (or `0.0.0.0/0` for demos).

## Smoke

```bash
curl -s http://SERVER_IP/api/
curl -s -H 'X-Tenant-Host: aurelia.luxejewel.app' http://SERVER_IP/api/public/bootstrap | head
```

## Notes

- Not production. `APP_ENV=development` keeps demo OTP.
- Upgrade Vultr plan to 2 GB if OOM under load.
- HTTPS / Caddy can be added later.
