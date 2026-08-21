# Build order

**Last updated:** 2026-08-21  
**Status:** Implementation **in progress** in this monorepo. Living checklist: [PROGRESS.md](./PROGRESS.md).

## Actual sequence used

Work did **not** follow Phase 1 → 7 in order. Shipped first:

1. FastAPI + Host/`X-Tenant-Host` tenancy + seed tenants  
2. Expo **white-label** customer app (Phase 7 early)  
3. Live rates + guest SIP + reserve cart  
4. Interim Expo jeweler `/admin`  
5. Next.js dense admin `admin/` (dual clients; POS/reports web-first)

**Next** (priority order): Live Checkout SDK → SIP Autopay → harden storefront → modularize API → platform console → R2/GST/KYC/domains → Play Store packaging.

---

## Locked rules every phase must keep

1. Customer **site URL** in Registry `tenant_sites`; public tenancy from **Host** / `X-Tenant-Host`.
2. **Same email/phone** allowed on different sites (per tenant DB uniqueness only).
3. **Theme** seeded (wizard or seed) into `site_theme`; storefront from tokens.
4. India / INR / GST / IST / `+91` OTP; console-only tenant create; English UI chrome. See [INDEX.md](./INDEX.md).
5. Customer native: **per-tenant white-label** only — no store switcher. See locked item 16.
6. Model B payments (jeweler merchant). No platform-collects gold. No global customer SSO.

---

## Phase 0 — Documentation

**Status: Done**

Spec in `docs/`. Brand name / production hostname still placeholder.

---

## Phase 1 — Foundation

**Status: Partial**

| Item | Status |
|------|--------|
| Registry `tenants`, `tenant_sites`, `tenant_admins`, `theme_public_snapshots` | Done |
| Host / `X-Tenant-Host` resolve; reserved hosts | Done |
| Idempotent seed (AURELIA, NOIR) including theme | Done (stand-in for worker) |
| Jeweler admin login by tenant_code | Done |
| Expo storefront bootstrap + theme chrome | Done |
| Provisioning worker + platform create-tenant wizard | Not started |
| Redis hostname + theme cache | Not started |
| Docker Compose (Mongo, Redis, MinIO) as documented | Not started |

---

## Phase 2 — Core admin

**Status: Partial** (dual Expo + Next.js)

| Item | Status |
|------|--------|
| Dashboard (pending work first) | Done (Expo + Next.js); sales online/offline split Done |
| Inventory / categories CRUD | Done (Expo + Next.js) |
| Theme editor + CMS | Done (Expo + Next.js) |
| Orders pipeline (status) | Done (Expo + Next.js) |
| Settings / margins | Done (Expo + Next.js) |
| Customers list/detail | Done (Expo + Next.js) |
| SIP plan templates CRUD | Done (Expo + Next.js) |
| Staff CRUD (owner) | Done (Expo + Next.js) |
| Gateway keys (encrypted) | Done (Expo + Next.js) |
| Next.js dense admin (`admin/`) | Done (parity + POS/purchases/reports) |
| Expo phone admin | Done (ops); POS/CSV web-first |
| POS / offline sales | Done (Next.js) |
| Purchases + weighted average cost | Done (Next.js) |
| Reports CSV | Done (Next.js) |
| R2 product images | **Done** (admin upload → R2 / MOCK_R2; storefront uses returned public URL) |
| Domain list UI | Not started |
| GST invoice PDF | **Done** (stub; no IRN) |

**Next** (priority order): Live Checkout SDK → SIP Autopay → harden storefront → modularize API → platform console → R2/GST/KYC/domains → Play Store packaging.

---

## Phase 3 — Customer commerce

**Status: Partial**

| Item | Status |
|------|--------|
| Catalog browse / filters / PDP | Done (Expo) — search + multi-image |
| Cart + address + **reserve** order | Done |
| Guest order history | Done |
| Wishlist (local) | Done |
| Customer OTP scoped to Host | **Done** (mock SMS / OTP_DEV_CODE) |
| Razorpay Model B checkout + webhooks | **Done** (Test Mode + mock path) |
| Invoice PDF | **Done** (stub; no IRN) |
| Profile (Account tab) | **Done** |

---

## Phase 4 — Commodity + rate engine

**Status: Partial**

| Item | Status |
|------|--------|
| Shared live rate fetcher + tenant margins | Done |
| Stale flag / last-known | Done |
| Product live_price on detail/list | Done |
| Full commodity checkout + lock TTL | Partial / pending |
| Rate lock at paid order (gateway) | **Done** (TTL on order create) |

---

## Phase 5 — SIP

**Status: Partial**

| Item | Status |
|------|--------|
| Plan list + guest enroll + mock pay + rate lock | Done |
| Admin enrollments / due on dashboard | Done (+ due/overdue filter) |
| Gateway mandates / real debit | **Done** (UPI Autopay mock + live client; Test Mode checklist) |
| Missed-payment SMS / KYC gate / liability report | SMS deferred; liability report Done |

---

## Phase 6 — Custom domains

**Status: Not started**

TXT verify, Cloudflare for SaaS / SSL, primary hostname rules — schema in docs only.

---

## Phase 7 — Native app

**Status: Partial**

| Item | Status |
|------|--------|
| White-label Expo app; baked hostname; no store switcher | Done |
| Same public APIs; no second tenancy model | Done |
| Play Store per-brand `applicationId` / icon / listing pipeline | Not started |
| Reject shared multi-store customer APK | Locked |

---

## Pending backlog (execution order)

1. **P2** GST IRN / DNS verify for custom domains  
2. **P3** Play Store per-tenant packaging  
3. **Later** Redis (only if load needs it); Live SMS (MSG91)

---

## v1 non-goals

- Global customer SSO / shared loyalty across jewelers  
- Platform-collects payments (Model A)  
- Hand-rolled Let’s Encrypt  
- WhatsApp chat inbox / notification inbox UI  
- NestJS or Postgres  
- Shared / multi-store customer native app (store switcher)  
- Touching MealHQ repos  

---

## Repo layout

```
jweller-platform/          ← this monorepo
  docs/                    product spec + progress
  backend/                 FastAPI (server.py + routers/)
  frontend/                Expo customer + phone admin
  admin/                   Next.js jeweler ERP
  platform-admin/          Next.js platform console
  memory/PRD.md
  AGENTS.md
  .cursor/  .agents/
```

Target additions later: Next.js `admin/`, `platform-admin/`, `workers/`, Redis, R2.
