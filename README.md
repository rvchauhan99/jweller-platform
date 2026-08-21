# Jewelers Platform (jweller-platform)

**Monorepo:** product docs, Cursor/agent rules, FastAPI backend, Expo white-label customer app + phone admin, and Next.js web jeweler admin.

| Path | Role |
|------|------|
| [`docs/`](docs/) | Spec, locks, progress |
| [`backend/`](backend/) | FastAPI + Motor |
| [`frontend/`](frontend/) | Expo storefront + phone `/admin` |
| [`admin/`](admin/) | Next.js dense jeweler admin (web) |
| [`platform-admin/`](platform-admin/) | Next.js platform console (create/suspend tenants) |
| [`AGENTS.md`](AGENTS.md) | Agent non-negotiables |
| [`.cursor/`](.cursor/) / [`.agents/`](.agents/) | Cursor rules + better-web-ui skills |

GitHub: [rvchauhan99/jweller-platform](https://github.com/rvchauhan99/jweller-platform)

Working name: **Jewelers Platform** (demo brand in code: LuxeJewel). Placeholders: `yourplatform.in` / demo `*.luxejewel.app`.

Separate from MealHQ (`mealhq-api`, `Zorvia`). Do not mix databases, Firebase, or deploy pipelines.

## What this platform is

One shared FastAPI backend serves N jewelers (tenants). Each tenant gets:

- its own MongoDB **database** (database-per-tenant)
- one or more **customer site URLs** in the Registry
- a **theme** (seeded / edited in admin)
- a **white-label customer app** (Expo; one Play Store listing per jeweler — packaging pending)
- staff login with a **tenant code** on **both** Expo admin and Next.js web admin (shared `/api/admin/*`)

## Locked product rules

1. **Customer site URL decides the tenant.** Resolve from `Host` / `X-Tenant-Host` via `tenant_sites`. Never trust client `tenant_id`.
2. **Same email or phone** on different sites = independent customers (per tenant DB).
3. **Theme is per tenant** (seed + admin editor today; create wizard later).
4. **Three visual languages.** Customer luxury vs dense admin vs platform console. See [`docs/FRONTEND.md`](docs/FRONTEND.md).
5. **Customer native = white-label only** — no in-app store switcher.
6. **Dual jeweler admin** — Expo phone ops + Next.js web ERP; POS/reports are web-first.

## Read order

1. [`docs/PROGRESS.md`](docs/PROGRESS.md) — what is done  
2. [`docs/INDEX.md`](docs/INDEX.md) — full index + locks  

## Layout

```
jweller-platform/
  docs/
  backend/
  frontend/   # Expo storefront + /admin
  admin/      # Next.js jeweler admin
  platform-admin/  # platform console
  memory/PRD.md
  AGENTS.md
  .cursor/
  .agents/
```

## Quick start (local)

```bash
# API
cd backend && uvicorn server:app --reload --port 8000

# Expo storefront / phone admin
cd frontend && npx expo start

# Web jeweler admin
cd admin && npm run dev
```

Demo admin: **AURELIA** / `owner` / `Aurelia@123`
