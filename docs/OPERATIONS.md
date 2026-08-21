# Operations

**Last updated:** 2026-08-22  
**Status:** Living runbook. Provisioning is **in-process** (no Redis worker this wave). Cloud Run Test Mode API shipped.

---

## Cloud Run (Test Mode) — shipped

| Item | Value |
|------|--------|
| Project | `zorvia-app` |
| Region | `asia-south1` |
| Service | `jweller-api` |
| URL | `https://jweller-api-685896962185.asia-south1.run.app` |
| Image | `asia-south1-docker.pkg.dev/zorvia-app/jweller/api:latest` |
| Profile | Razorpay Test Mode (`MOCK_RAZORPAY=0`, `ALLOW_PAY_DEV_CONFIRM=0`) |
| Data | Atlas Mongo — cloned from local `platform_registry` + registered `tenant_*` DBs |

**Webhook (Razorpay Test Dashboard):**  
`https://jweller-api-685896962185.asia-south1.run.app/api/public/webhooks/razorpay`

**Smoke:** `GET /api/` → LuxeJewel; `GET /api/public/bootstrap` with `X-Tenant-Host: aurelia.luxejewel.app`.

Container: [backend/Dockerfile](../backend/Dockerfile) + [backend/requirements.cloudrun.txt](../backend/requirements.cloudrun.txt). Never commit `.env` or Atlas URIs.

---

## Provisioning (Sprint 4 — shipped)

Triggered by `POST /api/platform/tenants` from the platform console ([`platform-admin/`](../platform-admin/)).

**v1 behavior:** HTTP runs an **idempotent in-process** provision (same seed shape as demo tenants). A `provisioning_jobs` document is written for status; there is **no Redis queue** and **no separate worker process**.

### Steps (idempotent)

1. Validate `tenant_code` / subdomain uniqueness; insert `tenants` with `status=provisioning`.
2. Upsert `provisioning_jobs` with `idempotency_key = provision:{tenant_id}`.
3. Seed tenant DB `tenant_{code}`: categories, products (starter), SIP plans, `site_theme` from wizard preset, `site_cms` defaults.
4. Insert primary `tenant_sites` hostname `{subdomain}.luxejewel.app` (`kind=subdomain`, `status=active`).
5. Upsert `theme_public_snapshots` (Mongo only — **no Redis** theme/site cache).
6. Upsert owner in `tenant_admins`.
7. Set `tenants.status=active`; mark job `done`.

On failure: job `status=failed` + `error_log`; tenant may remain `provisioning` / non-public until fixed.

Platform operator seed: `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (defaults `ops@luxejewel.app` / `Platform@123`).

---

## Local stack (current)

- Mongo + FastAPI (`backend/`).
- Jeweler admin: Next.js `admin/` (cookie BFF).
- Platform console: Next.js `platform-admin/` (port 3002 typical).
- Expo storefront + phone admin: `frontend/`.
- **Not required:** Redis, live SMS (MSG91), Docker Compose worker.

R2: real `BUCKET_*` or `MOCK_R2=1`.

## Wildcard DNS (later)

- `*.luxejewel.app` → storefront.
- Separate records for admin / console / api when deployed.

Custom domains: add via platform console sites API; DNS verify **later** (`pending_dns` today).

---

## Tenant suspend

- `POST /api/platform/tenants/{id}/suspend` → `tenants.status=suspended`.
- Public Host / `X-Tenant-Host`: **503** Store temporarily unavailable (resolver requires `active`).
- `activate` restores.

---

## Offboarding / export

Trust feature, not an afterthought.

- Export tenant Mongo (mongodump that DB) + R2 prefix zip.
- After confirmed offboard: `status=deleted`, disable sites.

---

## Backup and restore

- Cluster snapshots cover Registry + all tenant DBs.
- **Single-tenant restore:** mongodump/mongorestore `tenant_*` only. Registry `tenant_sites` must stay consistent.

---

## Observability

- Structured logs: `tenant_id`, `hostname`. Never log OTP or gateway secrets.
- Metrics later: provision success, OTP send, checkout, webhook verify fail.

---

## Explicitly deferred

| Item | Status |
|------|--------|
| Redis bootstrap / theme / site cache | Deferred — not needed at current load |
| Live SMS MSG91 | Deferred — OTP testing UX remains |
| Separate provisioning worker process | Deferred — in-process is enough |
| Play Store per-tenant packaging | P3 backlog |
