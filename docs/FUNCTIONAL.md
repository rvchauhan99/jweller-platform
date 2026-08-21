# Functional specification

**Last updated:** 2026-08-21  
**Status:** Journeys + implementation status. Code: `backend/`, `frontend/`. Checklist: [PROGRESS.md](./PROGRESS.md).

Identity and theming rules in [AUTH_IDENTITY.md](./AUTH_IDENTITY.md) and [THEMING.md](./THEMING.md) apply. Visual language: [FRONTEND.md](./FRONTEND.md).

---

## Actors

| Actor | App today | Target |
|-------|-----------|--------|
| Shopper | Expo white-label customer app | Same APIs; OTP + paid checkout next |
| Owner / staff | Interim Expo `/admin` + tenant_code | Next.js dense admin |
| Platform operator | Seed only | Console: create tenant, billing, impersonate |

---

## Platform operator

**Status: Not started** (demo tenants come from seed).

### Create tenant (target)

1. Enter business name, plan, tenant_code (or auto), subdomain.
2. Optional custom domain (queued as `pending_dns`).
3. **Theme panel:** preset, colors, fonts, layout, logo, homepage section order. Live preview.
4. Owner username + temp password.
5. Submit → `provisioning` → poll until `active`.
6. Operator copies admin URL + tenant_code to the jeweler.

### Operate platform (target)

- List tenants, filter by status/plan.
- Suspend (storefront unavailable page; admin read-only + export still allowed).
- View provisioning jobs and retry.
- Impersonate with mandatory reason (audit).
- SaaS billing status (software subscription), not gold settlements.

---

## Jeweler admin

**Status: Partial** — interim Expo admin (`/admin/*`). Target: Next.js at `admin.yourplatform.in`.

Login: tenant_code + username + password → JWT.

| Area | Shipped (Expo) | Still pending |
|------|----------------|---------------|
| Dashboard | Pending orders, SIP due, low stock, rate health, recent reservations | Full sales split online/offline |
| Inventory | Products + categories CRUD | R2 images, HUID UX polish, branches UI |
| Online orders | List + status advance | Refunds via gateway |
| SIP | Enrollments list | Plan builder, liability report, mandates |
| Branding / CMS | Theme + CMS editors | Domain list UI |
| Settings | Business + rate margins | Gateway keys, staff CRUD, GST full |
| POS / purchases / reports | — | Not started |

---

## Shopper (customer app)

**Status: Partial** — Expo white-label. Tenant from baked `X-Tenant-Host`. Theme + CMS from bootstrap.

### Browse — Done

- Home sections from theme + CMS (hero, rate ticker, categories, featured, about)
- Catalog by category; filters: purity, price
- Product detail with **live_price** when rates available

### Account — Partial

- **Today:** guest device id; wishlist local; order + SIP lists by guest
- **Next:** OTP with phone on **this** tenant only; same phone on another jeweler’s app = different account

### One-time purchase — Partial

- **Today:** Cart → contact/address → **reserve** order (no payment)
- **Next:** Pay on **this jeweler’s** Razorpay; commodity lock at place + re-validate if pay delayed ([RATES_SIP_PAYMENTS.md](./RATES_SIP_PAYMENTS.md))

### SIP purchase — Partial

- **Today:** Choose plan → guest enroll → mock installment pay (rate lock)
- **Next:** Mandate on jeweler’s gateway; OTP-backed enrollment; SMS due/missed

### Unavailable tenant — Done

Suspended / unknown host → unavailable state (not a raw 500).

---

## Commodity / live rate

**Status: Partial** — live feed + margins + stale + product live pricing shipped. Full commodity checkout / lock TTL with gateway still pending.

Details: [RATES_SIP_PAYMENTS.md](./RATES_SIP_PAYMENTS.md).

---

## Notifications (v1 scope)

- OTP SMS — **pending** (needed with auth)
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
| Journeys | Browse, cart, reserve, guest SIP — OTP/pay next |
| Identity | Same phone on two apps = two customers after OTP exists |
| Admin | Target = shared **web** admin; Expo `/admin` is interim |

Changing store means installing a **different** app, not a setting. Same FastAPI; no second tenancy model.
