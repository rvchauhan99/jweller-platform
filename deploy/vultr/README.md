# Vultr demo deploy (Jweller API)

Bangalore Shared CPU — Docker Compose: **FastAPI only**. Mongo is **Atlas** (`MONGO_URL` in `.env`).

## CI/CD (automatic)

Pushes to **`main`** that touch `backend/**`, `deploy/vultr/**`, or `.github/workflows/deploy-vultr-api.yml` trigger [`.github/workflows/deploy-vultr-api.yml`](../../.github/workflows/deploy-vultr-api.yml):

1. Rsync `backend/` → `/opt/jweller/backend/` (never `.env` or `tests`)
2. Rsync `deploy/vultr/` → `/opt/jweller/deploy/` (never `.env`)
3. Run [`deploy-remote.sh`](deploy-remote.sh) on the VPS (`docker compose up -d --build`)
4. Post-deploy smoke: `/api/`, bootstrap, and `GET /public/savings/summary` → **401** (route exists)

### GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `VULTR_HOST` | VPS public IP (e.g. `139.84.223.174`) |
| `VULTR_SSH_USER` | SSH user (e.g. `root`) |
| `VULTR_SSH_PRIVATE_KEY` | PEM private key for VPS login |

Frontend / APK builds are **not** part of this workflow.

---

## Manual deploy (fallback)

```bash
# on Mac, from repo root
rsync -avz --exclude '__pycache__' --exclude '.env' --exclude 'tests' \
  backend/ root@SERVER_IP:/opt/jweller/backend/
rsync -avz deploy/vultr/ root@SERVER_IP:/opt/jweller/deploy/
scp deploy/.env root@SERVER_IP:/opt/jweller/deploy/.env   # first time only

ssh root@SERVER_IP 'bash /opt/jweller/deploy/deploy-remote.sh'
```

Allow the VPS public IP in **Atlas → Network Access** (or `0.0.0.0/0` for demos).

## Smoke

```bash
curl -s http://SERVER_IP/api/
curl -s -H 'X-Tenant-Host: aurelia.luxejewel.app' http://SERVER_IP/api/public/bootstrap | head
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Tenant-Host: aurelia.luxejewel.app' \
  http://SERVER_IP/api/public/savings/summary
# expect 401 without customer JWT
```

## Notes

- Not production. `APP_ENV=development` keeps demo OTP.
- Upgrade Vultr plan to 2 GB if OOM under load.
- HTTPS / Caddy can be added later.
