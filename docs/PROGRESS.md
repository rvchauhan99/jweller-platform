# Implementation progress

**Last updated:** 2026-08-21  
**Status:** Living checklist for **this monorepo** (`jweller-platform`).

## Where things live

| Path | Role |
|------|------|
| [`docs/`](./) | Product docs, locks |
| [`../backend/`](../backend/) | FastAPI + Motor (`server.py`) |
| [`../frontend/`](../frontend/) | Expo white-label storefront + interim admin |
| [`../memory/PRD.md`](../memory/PRD.md) | Prototype PRD notes |
| GitHub | [rvchauhan99/jweller-platform](https://github.com/rvchauhan99/jweller-platform) |

---

## Stack: shipped vs target

| Layer | Shipped today | Target (still locked) |
|-------|---------------|------------------------|
| Customer UI | Expo 54 + expo-router; tenant baked via `EXPO_PUBLIC_TENANT_CODE` / `HOST` / `NAME`; `X-Tenant-Host` on every call | Same APIs; optional Next.js web storefront later if needed |
| Jeweler admin | **Interim** Expo routes under `frontend/app/admin/*` | Dense **Next.js** admin (`admin.yourplatform.in`) |
| Platform console | Not built (seed creates demo tenants) | Next.js `platform-admin/` create-tenant wizard |
| API | FastAPI monolith `backend/server.py` + Motor | Same FastAPI; modular routers; Beanie optional |
| Cache / queue | None (in-process rate poller) | Redis site/theme cache + workers |
| Files | Unsplash/CDN URLs in seed | R2 / MinIO prefixes |
| Auth shopper | Guest `guest_id` only | `+91` OTP, per-tenant customer JWT |
| Payments | Reserve orders (no gateway) | Razorpay Model B |
| Tenancy | Host / `X-Tenant-Host` → Registry → tenant DB | Unchanged |
| Tests | 36/36 pytest (storefront, rates/SIP/orders, live pricing) | Keep + expand |

**Stance:** Expo is the shipped customer surface (Phase 7 pulled forward). Next.js admin + platform console remain the target ERP/control plane. Expo `/admin` is interim.

Demo seed tenants: **AURELIA** (`aurelia.luxejewel.app`), **NOIR** (`noir.luxejewel.app`).

---

## Phase checklist

Legend: **Done** · **Partial** · **Not started**

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Docs | **Done** | Spec in this repo |
| 1 Foundation | **Partial** | Registry + sites + admins + snapshots + Host resolve + admin JWT login. No Redis, no provisioning worker, no platform wizard (seed instead) |
| 2 Core admin | **Partial** | Expo interim: dashboard, inventory CRUD, orders status, branding/CMS, settings, SIP list. No POS, WAC purchases, GST, R2 uploads, domain UI |
| 3 Customer commerce | **Partial** | Catalog, cart, reserve checkout, guest order history. No OTP, no Razorpay, no invoice PDF |
| 4 Rates / commodity | **Partial** | Live gold/silver poller + margins + stale + product `live_price`. Commodity-by-gram SKU path / checkout lock TTL not full |
| 5 SIP | **Partial** | Plans, guest enroll, mock pay + rate lock, maturity fields, admin list. No gateway mandates, SMS, KYC gate, liability report |
| 6 Custom domains | **Not started** | Schema-ready in docs only |
| 7 Native white-label | **Partial** | Expo bake + no store switcher **Done**. Play Store per-brand packaging / listing pipeline **Not started** |

---

## Done (do not re-build)

### Tenancy / foundation
- Host / `X-Tenant-Host` resolution; reserved-host guard; never client `tenant_id`
- Registry: `tenants`, `tenant_sites`, `tenant_admins`, `theme_public_snapshots`
- Per-tenant DBs: categories, products, `site_theme`, `site_cms`, SIP, orders
- Idempotent seed of two branded tenants + theme snapshots
- Admin login: `tenant_code` + username + password → JWT `aud: admin`
- White-label: baked tenant; **no** in-app store switcher

### Storefront (Expo)
- Bootstrap + theme tokens (no hardcoded brand colors on the UI path)
- Home: hero, rate ticker, categories, featured, about
- Collections, category filters, product detail
- Loading / empty / error / unavailable states
- Wishlist (device-local)
- Cart → **reserve** checkout (no payment)
- Guest order history

### Rates
- Poller: gold-api.com + frankfurter.dev USD/INR
- Per-tenant margin; 15 min stale; last-known fallback
- Product `live_price` / `pricing` (weight × rate × purity + making)

### SIP (guest)
- Plans, enroll, list, mock installment pay with rate lock
- Admin SIP enrollments + dashboard “SIP due”

### Interim Expo admin
- Queue-first dashboard (pending orders, SIP due, low stock, rate health)
- Products / categories CRUD
- Orders list + status
- Theme + CMS editors
- Settings (business / margins)

---

## API inventory (implemented now)

Base: `/api`. Public tenant from `X-Tenant-Host` (or Host). Admin from Bearer JWT.

### Public
| Method | Path |
|--------|------|
| GET | `/public/bootstrap` |
| GET | `/public/cms` |
| GET | `/public/categories` |
| GET | `/public/products` |
| GET | `/public/products/{id}` |
| GET | `/public/rates` |
| GET | `/public/sip/plans` |
| POST | `/public/sip/enroll` |
| GET | `/public/sip/enrollments` |
| POST | `/public/sip/enrollments/{id}/pay` |
| POST | `/public/orders` |
| GET | `/public/orders` |

### Admin
| Method | Path |
|--------|------|
| POST | `/admin/auth/login` |
| GET | `/admin/me` |
| GET | `/admin/dashboard` |
| GET/POST/PUT/DELETE | `/admin/products`, `/admin/products/{id}` |
| GET/POST/PUT/DELETE | `/admin/categories`, `/admin/categories/{id}` |
| GET | `/admin/orders` |
| PUT | `/admin/orders/{id}/status` |
| GET | `/admin/sip/enrollments` |
| GET/PUT | `/admin/theme` |
| GET/PUT | `/admin/cms` |
| GET/PUT | `/admin/settings` |

**Not implemented:** `/api/public/auth/otp/*`, `/api/platform/*`, payment webhooks, Redis-backed bootstrap.

Full future contract: [API.md](./API.md).

---

## Known demo shortcuts

- Shopper identity = `guest_id` (device), not OTP customer
- Checkout creates **reserve** orders; no Razorpay
- SIP installment pay is **mock** (locks rate, no mandate)
- Rate margins live on tenant document (not full `rate_margins` collection UX)
- No Redis; theme/site always from Mongo
- Product images = external URLs, not R2
- Create tenant = seed script, not platform console

---

## Pending backlog (priority)

1. **P0** — Customer OTP (`+91`, Host-scoped); replace `guest_id` with customer session  
2. **P0** — Razorpay Model B; webhooks; rate lock TTL on pay  
3. **P1** — Storefront harden: multi-image, search, SIP due nudges; commodity path if needed  
4. **P1** — Split FastAPI monolith into routers/models; add Redis when scaling  
5. **P2** — Next.js jeweler admin (migrate off Expo `/admin`): tables, POS, reports  
6. **P2** — Platform console: create-tenant wizard + provisioning job  
7. **P2** — R2/MinIO, GST invoices, KYC, custom domains  
8. **P3** — Play Store per-tenant `applicationId` / icon / listing pipeline  

Details and phase mapping: [BUILD_ORDER.md](./BUILD_ORDER.md).
