# AGENTS.md — Jewelers Platform

Private multi-tenant jewelers SaaS. **This repository is the monorepo:** docs + FastAPI (`backend/`) + Expo (`frontend/`). Progress: [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Do not

- Invent a shared cross-tenant customer SSO, or platform-collects payments (Model A).
- Touch MealHQ repos (`mealhq-api`, `Zorvia` / `Zorvia-main`).
- Deploy, commit, or open PRs unless explicitly asked.
- Add an in-app store switcher to the customer app (white-label only).
- Restyle jeweler admin as the storefront theme preset.
- Rebuild features already marked **Done** in PROGRESS unless asked.

## Read order

1. [`docs/PROGRESS.md`](docs/PROGRESS.md)
2. [`docs/INDEX.md`](docs/INDEX.md)
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
4. [`docs/TENANT_SITES.md`](docs/TENANT_SITES.md)
5. [`docs/AUTH_IDENTITY.md`](docs/AUTH_IDENTITY.md)
6. [`docs/THEMING.md`](docs/THEMING.md)
7. [`docs/FRONTEND.md`](docs/FRONTEND.md)
8. Remaining docs as needed

## Non-negotiables

- Tenancy for **customer** traffic: `Host` / `X-Tenant-Host` → Registry `tenant_sites` → tenant DB.
- Tenancy for **jeweler admin**: JWT from `tenant_code` + username login — not Host.
- Customer uniqueness is **inside one tenant DB**, not global.
- Customer app is **per-tenant white-label** (Expo bake in `frontend/src/config/tenant.ts`).
- Storefront uses tenant theme tokens; admin uses platform tokens.
- Never commit `.env` or secrets.
- UI: [docs/FRONTEND.md](docs/FRONTEND.md). No generic metric-card dashboards. No hardcoded brand colors.
- v1: India / INR / `+91` OTP (OTP pending); console-only tenant create (seed today); Razorpay Model B (pending); English chrome.

## When editing code

- Prefer updating `docs/PROGRESS.md` (and related docs) in the same change set when behavior changes.
- Backend: `backend/server.py` (monolith today) + `backend/tests/`.
- Frontend: `frontend/app/` (customer) and `frontend/app/admin/` (interim).
