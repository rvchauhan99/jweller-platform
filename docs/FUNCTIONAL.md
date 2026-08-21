# Functional specification

**Last updated:** 2026-08-21  
**Status:** Journeys + implementation status. Code: `backend/`, `frontend/`. Checklist: [PROGRESS.md](./PROGRESS.md).

Identity and theming rules in [AUTH_IDENTITY.md](./AUTH_IDENTITY.md) and [THEMING.md](./THEMING.md) apply. Visual language: [FRONTEND.md](./FRONTEND.md).

---

## Actors

| Actor | App today | Target |
|-------|-----------|--------|
| Shopper | Expo white-label customer app | OTP login + Razorpay pay (mock/dev-confirm locally) |
| Owner / staff | **Dual:** Expo `/admin` (phone) + Next.js `admin/` (web ERP) | Same dual model; platform console separate |
| Platform operator | Next.js `platform-admin/` | Create tenant, suspend/activate, domain list (DNS verify later) |

---

## Platform operator

**Status: Partial** — console shipped; demo seed still loads AURELIA/NOIR. Provisioning is **in-process** (no Redis worker).

### Create tenant (shipped)

1. Business name, plan, tenant_code, subdomain.
2. Theme preset (+ optional color overrides).
3. Owner username + password.
4. Submit → in-process provision → `active` (job record for status).
5. Operator shares admin URL + tenant_code with the jeweler.

Custom domain: add later on tenant detail (`pending_dns`; DNS verify later).

### Operate platform

- List tenants by status.
- Suspend / activate (storefront 503 when suspended).
- Domain list / add hostnames.
- **Not this wave:** impersonate, SaaS billing UI, Redis caches, live SMS.

---

## Jeweler admin

**Status: Partial** — dual clients on shared `/api/admin/*`.

- **Expo** (`frontend/app/admin/*`): phone ops — queue, inventory, orders, SIP, customers, staff, branding, settings, gateway.
- **Next.js** (`admin/`): dense web ERP — same ops + **POS**, purchases/WAC, CSV reports.

Login (both): tenant_code + username + password → JWT (`aud: admin`). Web stores JWT in httpOnly cookie via BFF; Expo uses Bearer in secure storage.

| Area | Expo | Next.js web | Still pending |
|------|------|-------------|---------------|
| Dashboard | Queue + sales split + rate health | Same | — |
| Inventory | CRUD | Tables + CRUD | R2 images, HUID polish |
| Online orders | List + status | Tables + status | Gateway refunds |
| Customers | List + detail | List + detail | KYC |
| SIP | Plans CRUD + enrollments | Same | Mandates, SMS |
| Branding / CMS | Theme + CMS | Theme + CMS | Domain list UI |
| Settings | Business + margins + gateway | Same | GST invoice PDF |
| Staff | Owner CRUD | Owner CRUD | Fine-grained ACL |
| POS / purchases / reports | Desktop CTA only | Full | — |

Demo login: `AURELIA` / `owner` / `Aurelia@123`.

---

## Shopper (customer app)

**Status: Partial** — Expo white-label. Tenant from baked `X-Tenant-Host`. Theme + CMS from bootstrap.

### Browse — Done

- Home sections from theme + CMS (hero, rate ticker, categories, featured, about)
- Catalog by category; search; filters: purity, price (server-backed)
- Product detail with **live_price** + multi-image gallery

### Account — Partial

- **Today:** OTP (`+91` fixed prefix; user enters 10 digits) on **this** tenant only; testing banner + OTP `123456` via `dev_otp` (non-prod); customer JWT; Account profile edit + sign out; same phone on another jeweler’s app = different account
- Wishlist still device-local

### Checkout / pay — Partial
- **Today:** Authenticated checkout; Razorpay Test Mode Checkout + `pay/confirm`; GST stub invoice PDF; webhook; rate lock TTL
- **Next:** Live Mode go-live; e-invoice IRN

### SIP purchase — Partial
- **Today:** Enroll (gold or silver) + monthly debit day → **compulsory first Razorpay installment**; UPI Autopay later; admin pause/resume/cancel; due desk
- **Today:** One-time gold/silver buy → metal wallet grams
- **Next:** Live SMS due/missed; KYC gate; redeem wallet against jewellery

### Unavailable tenant — Done

Suspended / unknown host → unavailable state (not a raw 500).

---

## Commodity / live rate

**Status: Partial** — live feed + margins + stale + product live pricing + rate lock TTL on pay + **one-time metal wallet buy**.

Details: [RATES_SIP_PAYMENTS.md](./RATES_SIP_PAYMENTS.md).

---

## Notifications (v1 scope)

- OTP SMS — **mock/log in non-prod**; live provider TBD (MSG91 recommended)
- Order placed / shipped — pending
- SIP due / missed — dashboard due flag shipped; SMS pending

No WhatsApp inbox. No platform-wide notification center required for v1.

---

## Native app (white-label)

**Status: Partial — Expo app shipped; Play Store packaging pending.**

Customer mobile is **one app per jeweler**, released under that jeweler’s brand. There is **no** shared platform customer app and **no** in-app store switch.

| Rule | Detail |
|------|--------|
| Build | Bake `EXPO_PUBLIC_TENANT_CODE` / `HOST` / `NAME` (+ icon/splash at release time) |
| Tenancy | Public APIs + `X-Tenant-Host`; never client `tenant_id` |
| Journeys | Browse, cart, OTP, Razorpay pay, SIP enroll/installment pay |
| Identity | Same phone on two apps = two customers |
| Admin | Dual: Expo phone ops + Next.js dense ERP |

Changing store means installing a **different** app, not a setting. Same FastAPI; no second tenancy model.
