# Build order

**Last updated:** 2026-08-21  
**Status:** Implementation **in progress** in this monorepo. Living checklist: [PROGRESS.md](./PROGRESS.md).

## Actual sequence used

Work did **not** follow Phase 1 → 7 in order. Shipped first:

1. FastAPI + Host/`X-Tenant-Host` tenancy + seed tenants  
2. Expo **white-label** customer app (Phase 7 early)  
3. Live rates + guest SIP + reserve cart  
4. Interim Expo jeweler `/admin`

**Next** (priority order): OTP → Razorpay → harden storefront → modularize API → Next.js admin → platform console → R2/GST/KYC/domains → Play Store packaging.

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

**Status: Partial** (interim Expo admin)

| Item | Status |
|------|--------|
| Dashboard (pending work first) | Done (Expo) |
| Inventory / categories CRUD | Done (Expo) |
| Theme editor + CMS | Done (Expo) |
| Orders pipeline (status) | Done (Expo) |
| Settings / margins | Done (Expo) |
| Next.js dense admin (target) | Not started |
| POS / offline sales | Not started |
| Purchases + weighted average cost | Not started |
| R2 product images | Not started |
| Domain list UI | Not started |
| Staff ACL depth / GST fields full | Not started |

---

## Phase 3 — Customer commerce

**Status: Partial**

| Item | Status |
|------|--------|
| Catalog browse / filters / PDP | Done (Expo) |
| Cart + address + **reserve** order | Done |
| Guest order history | Done |
| Wishlist (local) | Done |
| Customer OTP scoped to Host | Not started |
| Razorpay Model B checkout + webhooks | Not started |
| Invoice PDF | Not started |

---

## Phase 4 — Commodity + rate engine

**Status: Partial**

| Item | Status |
|------|--------|
| Shared live rate fetcher + tenant margins | Done |
| Stale flag / last-known | Done |
| Product live_price on detail/list | Done |
| Full commodity checkout + lock TTL | Partial / pending |
| Rate lock at paid order (gateway) | Pending (needs Razorpay) |

---

## Phase 5 — SIP

**Status: Partial**

| Item | Status |
|------|--------|
| Plan list + guest enroll + mock pay + rate lock | Done |
| Admin enrollments / due on dashboard | Done |
| Gateway mandates / real debit | Not started |
| Missed-payment SMS / KYC gate / liability report | Not started |

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

1. **P0** Customer OTP (`+91`) + customer JWT; retire guest-only for checkout/SIP  
2. **P0** Razorpay Model B; webhooks; lock TTL  
3. **P1** Storefront harden (multi-image, search, SIP nudges)  
4. **P1** Split FastAPI monolith; Redis when needed  
5. **P2** Next.js jeweler admin (replace Expo interim)  
6. **P2** Platform console + provisioning job  
7. **P2** R2/MinIO, GST invoices, KYC, custom domains  
8. **P3** Play Store white-label release pipeline  

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
  backend/                 FastAPI (server.py monolith today)
  frontend/                Expo customer + interim admin
  memory/PRD.md
  AGENTS.md
  .cursor/  .agents/
```

Target additions later: Next.js `admin/`, `platform-admin/`, `workers/`, Redis, R2.
