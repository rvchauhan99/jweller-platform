# PRD — LuxeJewel (White-label Jeweler Storefront)

## Original problem statement
Build a mobile app for a multi-tenant jeweler platform. A jeweler's customers open a branded
luxury storefront (their logo, colors, fonts, products) and browse/shop. Adapted from a 13-doc
spec (storefront + admin + multi-tenant backend). Customer mobile app is **white-label: one app
per jeweler**, released separately per brand — no in-app store switcher. Same public APIs; the
tenant's primary hostname is baked into the build and sent as X-Tenant-Host.

## Architecture
- **Frontend:** Expo (React Native) + expo-router. Runtime theme system (StoreProvider) — every
  color/font flows from the per-tenant `/api/public/bootstrap` theme object; ZERO hardcoded brand
  colors. Whitelisted fonts loaded from CDN. Tenant baked via `EXPO_PUBLIC_TENANT_CODE` /
  `EXPO_PUBLIC_TENANT_HOST`. Bottom tabs: Home / Collections / Gold SIP / Account.
- **Backend:** FastAPI + Motor, database-per-tenant on one Mongo cluster. Registry DB
  `platform_registry` (tenants, tenant_sites, theme_public_snapshots, rates). Per-tenant DBs
  `tenant_<code>` (categories, products, site_theme, site_cms, sip_plans, sip_enrollments, orders).
  Tenant resolved strictly from Host / X-Tenant-Host (never client tenant_id); reserved-host guard.
- **Live rates:** background poller fetches gold/silver (api.gold-api.com) + USD/INR
  (frankfurter.dev), keyless; per-tenant margin applied server-side; stale after 15 min; graceful
  last-known fallback.

## User personas
- **Shopper (guest):** browses catalog, saves favourites, reserves pieces, joins a gold SIP.
- **Jeweler owner/staff:** (future) manage catalog/theme via shared web admin — not in this app.

## Core requirements (static)
- Luxury, theme-token-driven storefront, phone-first.
- White-label single tenant per build; strict tenant isolation.
- Guest-only this phase (no auth, no online payment).

## Implemented (2026-08-21)
- Multi-tenant backend + idempotent seed of 2 demo tenants (AURELIA classic-gold, NOIR dark-royal).
- Storefront: Home (hero, live rate ticker, categories, featured, about), Collections, Category
  catalog (filter chips: purity/price), Product detail. Loading/empty/error/unavailable states.
- White-label refactor: removed store switcher; tenant baked in; Account tab.
- Live gold/silver rate feed (real, keyless) with per-tenant margin + staleness.
- Gold SIP: plans, guest enroll, dashboard (progress, grams accrued, current value), mock
  pay-installment locking live rate, maturity.
- Cart → Checkout (no-payment "reserve" order) + order history.
- Wishlist (local device storage) with hearts on cards/product + Account link.
- Backend tested: 29/29 pass, tenant isolation + guest scoping verified.

## Backlog / remaining (prioritized)
- **P0:** Account/OTP auth (phone SMS or Emergent email) — needed to persist across devices &
  gate checkout; then payment gateway (Razorpay/Cashfree per jeweler) for real online purchase.
- **P1:** Product commodity pricing from live rate (weight × rate + making) on detail; SIP
  reminders; multiple product images/carousel; search.
- **P2:** Jeweler admin (web) — dashboard, theme editor, inventory CRUD, POS, reports, SIP mgmt.
- **P2:** Custom domains, KYC, staff roles, GST invoices (later phases from full spec).

## Next tasks
- Confirm auth provider + payment gateway keys, then build Account + real checkout.
- Wire per-build tenant assets (icon, name, package) for actual white-label store releases.
