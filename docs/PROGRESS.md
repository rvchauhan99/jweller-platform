# Implementation progress

**Last updated:** 2026-08-22  
**Status:** Living checklist for **this monorepo** (`jweller-platform`). Cloud Run Test Mode API: see [OPERATIONS.md](./OPERATIONS.md).

## Where things live

| Path | Role |
|------|------|
| [`docs/`](./) | Product docs, locks |
| [`../backend/`](../backend/) | FastAPI + Motor (`server.py` + `routers/`) |
| [`../frontend/`](../frontend/) | Expo white-label storefront + phone jeweler admin |
| [`../admin/`](../admin/) | Next.js jeweler admin (dense ERP / web) |
| [`../platform-admin/`](../platform-admin/) | Next.js platform console (create/suspend tenants) |
| [`../memory/PRD.md`](../memory/PRD.md) | Prototype PRD notes |
| GitHub | [rvchauhan99/jweller-platform](https://github.com/rvchauhan99/jweller-platform) |

---

## Stack: shipped vs target

| Layer | Shipped today | Target (still locked) |
|-------|---------------|------------------------|
| Customer UI | Expo 54 + expo-router; tenant baked via `EXPO_PUBLIC_TENANT_*`; `X-Tenant-Host` on every call | Same APIs; optional Next.js web storefront later if needed |
| Jeweler admin | **Dual clients, one API:** Next.js `admin/` (web ERP) + Expo `frontend/app/admin/*` (phone ops) | Same; POS/reports stay web-first |
| Platform console | **Next.js `platform-admin/`** create/suspend + domain list | Impersonation audit UI later |
| API | FastAPI `server.py` + **`routers/`** (public, admin, platform, webhooks) + Motor | Beanie optional |
| Cache / queue | None (in-process rate poller + **in-process provision**) | Redis **deferred** until multi-tenant load needs it |
| Files | Unsplash/CDN URLs in seed; **R2 upload** for new gallery images (`BUCKET_*` / `MOCK_R2`) | Public CDN hostname via `BUCKET_PUBLIC_BASE_URL` |
| Auth shopper | **`+91` OTP** + per-tenant customer JWT (`aud: customer`) | Unchanged |
| Payments | **Razorpay Model B** Checkout + **SIP UPI Autopay** (mock + live client) | Live Mode go-live; production Autopay webhooks |
| Tenancy | Host / `X-Tenant-Host` → Registry → tenant DB | Unchanged |
| Tests | pytest storefront / rates / SIP / orders / **OTP** / **Razorpay** | Keep + expand admin coverage |

**Stance:** Expo is the shipped customer surface. Jeweler admin is **dual**: Expo for phone queue/ops, Next.js for dense web ERP (POS, purchases, CSV). Do **not** deprecate Expo admin.

Demo seed tenants: **AURELIA** (`aurelia.luxejewel.app`), **NOIR** (`noir.luxejewel.app`).

---

## Phase checklist

Legend: **Done** · **Partial** · **Not started**

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Docs | **Done** | Spec in this repo |
| 1 Foundation | **Partial** | Registry + sites + admins + snapshots + Host resolve + admin JWT + **platform JWT + in-process provision**. No Redis (deferred). Demo seed still loads AURELIA/NOIR |
| 2 Core admin | **Partial** | Dual admin + R2 gallery. **Platform domain list** (no DNS verify). Jeweler tax invoice PDF Done (no IRN) |
| 3 Customer commerce | **Partial** | Catalog, search, multi-image PDP, profile, cart, OTP, Razorpay Test Checkout, jeweler tax invoice PDF |
| 4 Rates / commodity | **Partial** | Intl spot INR + **% + ₹/g** shop premium + rate lock; metal buy → wallet |
| 5 SIP | **Partial** | Plans (gold/silver), enroll + **preferred_day** + **compulsory first Checkout**, UPI Autopay. KYC/SMS pending |
| 6 Custom domains | **Partial** | Add host via platform console (`pending_dns`); DNS verify later |
| 7 Native white-label | **Partial** | Expo bake + no store switcher **Done**. Play Store per-brand packaging **Not started** |

---

## Done (do not re-build)

### Tenancy / foundation
- Host / `X-Tenant-Host` resolution; reserved-host guard; never client `tenant_id`
- Registry: `tenants`, `tenant_sites`, `tenant_admins`, `theme_public_snapshots`, `platform_super_admins`, `provisioning_jobs`
- Per-tenant DBs: categories, products, `site_theme`, `site_cms`, SIP, orders, customers, purchases
- Idempotent seed of two branded tenants + theme snapshots
- Admin login: `tenant_code` + username + password → JWT `aud: admin`
- **Platform console:** JWT `aud: platform`; create/suspend/activate; sites list/add; in-process provision (**no Redis**)
- Modular FastAPI: `server.py` + `routers/` (public, admin, platform, webhooks)
- White-label: baked tenant; **no** in-app store switcher

### Storefront (Expo)
- Bootstrap + theme tokens (no hardcoded brand colors on the UI path)
- Home: **live e-rates** (gold /10g, silver /kg) + **savings summary** (`GET /public/savings/summary`) + SIP preview; Start SIP / one-time buy CTAs
- Shop tab (`collections`): hero, categories, featured, about (former catalog home)
- Collections, **search**, category filters, product detail (multi-image)
- Account: profile edit / sign out / orders shortcut
- Loading / empty / error / unavailable states
- Wishlist (device-local)
- Cart → checkout with **customer JWT** + Razorpay Checkout (Test Mode) / mock `dev-confirm` when `MOCK_RAZORPAY=1`
- Order history (authenticated)

### Customer auth
- `POST /public/auth/otp/request|verify` (+91); `GET/PATCH /public/me`
- Customer JWT `aud: customer` bound to Host tenant; same phone ≠ same account across tenants
- SMS: `LogSmsProvider` in non-prod (`OTP_DEV_CODE` default `123456` + `dev_otp` on request); live SMS deferred
- Jeweler tax invoice PDF (ReportLab): weight/purity/making/HSN + GST 3% breakup; `GET /public/orders/{id}/invoice` + admin BFF binary proxy; Expo file write + share
- Admin dashboard `payment_health` (gateway enabled, mock flag, last paid)
- Razorpay Test Mode runbook: [RAZORPAY_TEST_RUNBOOK.md](./RAZORPAY_TEST_RUNBOOK.md)

### Rates
- Poller: gold-api.com + frankfurter.dev USD/INR (international spot → INR)
- Per-tenant **% + absolute ₹/g** city premium; admin live base→sell preview; 15 min stale; last-known fallback
- Product `live_price` / `pricing` (weight × rate × purity + making)
- Rate lock snapshot + TTL on Razorpay order create
- Not migrating to GoldAPI.io/IBJA for storefront (spot family; local board = tenant premium)

### SIP (customer JWT)
- Plans, enroll (`preferred_day` 1–28), list; **first installment Checkout required at enroll**; later dues on preferred day
- Installment pay via Razorpay order + webhook/dev-confirm (rate lock)
- **UPI Autopay:** mandate setup/confirm/charge; admin pause/resume/cancel; fallback one-time Checkout
- Admin SIP enrollments + plans CRUD + dashboard “SIP due”
- One-time gold/silver buy: `POST /public/metal/buy` (+ confirm) → credits `metal_wallets`
- Runbook: [RAZORPAY_AUTOPAY.md](./RAZORPAY_AUTOPAY.md)

### Payments (Razorpay Model B)
- Tenant gateway keys (owner UI); encrypted secrets
- `POST /public/orders/{id}/pay` (+ `/confirm`, `/dev-confirm`), SIP same, `POST /public/webhooks/razorpay`
- Test Mode: `MOCK_RAZORPAY=0` + AURELIA `DEMO_RAZORPAY_*` / Admin gateway; Expo WebView Checkout
- Pytest: API must run with `MOCK_RAZORPAY=1` — see [TESTING.md](./TESTING.md); MCP notes [RAZORPAY_MCP.md](./RAZORPAY_MCP.md)
- Gate: [TESTING.md](./TESTING.md) — mock pytest mandatory after integrations

### Expo jeweler admin (phone)
- Queue-first dashboard (pending orders, SIP due, low stock, rate health, **today sales online/offline**)
- Products / categories CRUD; orders status + **Invoice** (paid) + **Return** (shipped/delivered → restock; admin-only); theme + CMS; settings
- **Profile:** change password + optional TOTP; login 2FA challenge; forgot-password SMS OTP
- Customers list/detail; SIP plans + enrollments; staff CRUD (owner); gateway keys (owner)
- Desktop CTA for POS / purchases / CSV (web-only)

### Next.js jeweler admin (`admin/`)
- Cookie auth (`admin_token`) + `/api/auth/*` + `/api/admin/[...path]` BFF proxy to FastAPI
- Dense ERP: Dashboard, POS, Orders (blob invoice download; admin Return), Inventory, Customers, Gold SIP, Purchases, Reports, Branding, Staff, Settings, **Profile** (password + authenticator)
- Login: optional TOTP step; **Forgot password** (SMS OTP); Staff phone for reset delivery
- Platform tokens (not storefront gold)

### Order return (admin-only)
- `PUT /admin/orders/{id}/status` with `{ status: "returned", reason? }` from shipped|delivered; restocks once (`return_restocked`); no Razorpay refund in v1
- No public return API; customer Orders list shows **returned** status only

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
| POST | `/public/auth/otp/request` |
| POST | `/public/auth/otp/verify` |
| GET/PATCH | `/public/me` |
| GET | `/public/sip/plans` |
| POST | `/public/sip/enroll` |
| GET | `/public/sip/enrollments` |
| POST | `/public/sip/enrollments/{id}/pay` |
| POST | `/public/sip/enrollments/{id}/pay/confirm` |
| POST | `/public/sip/enrollments/{id}/pay/dev-confirm` |
| POST | `/public/orders` |
| GET | `/public/orders` |
| GET | `/public/orders/{id}` |
| POST | `/public/orders/{id}/pay` |
| POST | `/public/orders/{id}/pay/confirm` |
| POST | `/public/orders/{id}/pay/dev-confirm` |
| GET | `/public/orders/{id}/invoice` |
| POST | `/public/webhooks/razorpay` |

### Admin
| Method | Path |
|--------|------|
| POST | `/admin/auth/login` | optional `totp`; may return `two_fa_required` |
| POST | `/admin/auth/forgot/request` \| `/confirm` |
| POST | `/admin/auth/change-password` |
| POST | `/admin/auth/2fa/generate` \| `/enable` \| `/disable` |
| GET | `/admin/me` |
| GET | `/admin/dashboard` |
| GET/POST/PUT/DELETE | `/admin/products`, `/admin/products/{id}` |
| GET/POST/PUT/DELETE | `/admin/categories`, `/admin/categories/{id}` |
| GET | `/admin/orders` |
| PUT | `/admin/orders/{id}/status` | Forward pipeline + cancel; **returned** (admin-only, restock) |
| GET | `/admin/orders/{id}/invoice` |
| GET | `/admin/sip/enrollments` |
| GET/POST/PUT/DELETE | `/admin/sip/plans` |
| GET/PUT | `/admin/theme` |
| GET/PUT | `/admin/cms` |
| GET/PUT | `/admin/settings` |
| GET | `/admin/customers`, `/admin/customers/{id}` |
| POST | `/admin/customers` |
| GET/POST/PUT/DELETE | `/admin/staff` |
| GET/PUT | `/admin/gateway` |
| POST | `/admin/pos/sale` |
| GET/POST | `/admin/purchases` |
| GET | `/admin/reports/sales`, `/stock`, `/sip-liability` |

**Not implemented:** Redis-backed bootstrap, live SMS provider, Play Store packaging, DNS verify.

Full future contract: [API.md](./API.md).

---

## Known demo shortcuts

- OTP uses `OTP_DEV_CODE` (default `123456`) + log SMS; Expo shows testing banner + OTP from `dev_otp`; login UI locks **+91** (user types 10 digits)
- Razorpay Test Mode: real sandbox Checkout + `pay/confirm`; jeweler tax invoice PDF; pytest still uses mock
- SIP: enroll + preferred debit day + compulsory first Checkout **or** later UPI Autopay; gold/silver UI filter; see [RAZORPAY_AUTOPAY.md](./RAZORPAY_AUTOPAY.md)
- One-time metal buy credits customer metal wallet (gold/silver grams)
- Rate margins live on tenant document
- No Redis; theme/site always from Mongo
- Product images = R2 via `POST /admin/uploads` (QuickerPay-style `BUCKET_*`); seed still Unsplash URLs; `MOCK_R2=1` for local/pytest
- Create tenant = **platform console** (`platform-admin/`) or demo seed

---

## Pending backlog (priority)

1. **P2** — GST IRN polish; more domain DNS verify  
2. **P3** — Play Store per-tenant packaging  
3. **Later** — Redis when multi-tenant load needs it; Live SMS (MSG91) — only when asked  

When a backlog item ships, move it to **Done** and update this date.
