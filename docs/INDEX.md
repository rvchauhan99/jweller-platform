# Documentation index

**Last updated:** 2026-08-21  
**Status:** Monorepo — docs + `backend/` + `frontend/` in [jweller-platform](https://github.com/rvchauhan99/jweller-platform). Progress: [PROGRESS.md](./PROGRESS.md).

Read these in order before changing code or docs.

| # | Doc | What it decides |
|---|-----|-----------------|
| 0 | [PROGRESS.md](./PROGRESS.md) | Done / partial / pending vs shipped Expo + FastAPI |
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Two-tier Mongo, apps (shipped vs target), request flows |
| 2 | [TENANT_SITES.md](./TENANT_SITES.md) | Site URL in Registry → tenant; Host routing; custom domains |
| 3 | [AUTH_IDENTITY.md](./AUTH_IDENTITY.md) | Same email/phone on different sites; JWT binding |
| 4 | [THEMING.md](./THEMING.md) | Theme tokens; seed today; wizard target |
| 5 | [FRONTEND.md](./FRONTEND.md) | Three visual languages; Expo customer vs Next admin target |
| 6 | [DATA_MODEL.md](./DATA_MODEL.md) | Registry + tenant collections, indexes, uniqueness |
| 7 | [FUNCTIONAL.md](./FUNCTIONAL.md) | Journeys + what is shipped |
| 8 | [API.md](./API.md) | Live routes + full contract |
| 9 | [RATES_SIP_PAYMENTS.md](./RATES_SIP_PAYMENTS.md) | Live rates, SIP engine, Model B gateways |
| 10 | [OPERATIONS.md](./OPERATIONS.md) | Provisioning, suspend, backup, GST, edge cases |
| 11 | [BUILD_ORDER.md](./BUILD_ORDER.md) | Phases with Done/Partial/Pending + backlog |
| — | [SOURCE.md](./SOURCE.md) | Map from drafts / prototype to these files |

## Locked enhancements (do not weaken)

1. **Customer Site URL lives in the tenant Registry.** Hostname is globally unique. Public traffic: `Host` / `X-Tenant-Host` → `tenant_sites` → tenant DB. Admin traffic: tenant_code login, not Host.
2. **Same email or phone may exist on many sites.** Uniqueness is `(tenant DB, phone)` and `(tenant DB, email)`, never global.
3. **Configurable theme** at tenant create (wizard target) or seed; storefront renders from tokens.
4. **Three frontends, three visual languages.** Customer = luxury (tenant tokens). Jeweler admin = dense ERP (platform tokens). Platform console = control plane. Expo `/admin` is interim only ([FRONTEND.md](./FRONTEND.md)).
5. **v1 is India only.** INR, GST invoices, IST, customer OTP on `+91` stored as E.164. No multi-currency.
6. **Platform console creates tenants.** No public jeweler self-serve signup in v1. (Today: seed; wizard pending.)
7. **Web apps (target):** same-origin `/api` → FastAPI. **Expo (shipped):** direct API + `X-Tenant-Host`.
8. **httpOnly cookies per web app origin** (target). No parent `.yourplatform.in` cookie.
9. **Local ops target:** Docker Mongo + Redis + MinIO. Shipped demo may use cloud Mongo without Compose.
10. **UI chrome is English.** Jewelers may type Gujarati/Hindi in CMS and product names.
11. **Stock is both unique tagged pieces and commodity/weight (grams).**
12. **Making charge is per product:** ₹ amount **or** % of metal value.
13. **HUID is optional** on jewellery SKUs.
14. **Razorpay first.** Cashfree schema-ready; do not wire Cashfree in v1. (Payments not live yet.)
15. **Branches: schema now, UI hidden** until needed.
16. **Customer native app is per-tenant white-label.** Expo bake shipped; no store switcher. Play Store packaging pending.

## Placeholders

| Item | Placeholder until brand exists |
|------|--------------------------------|
| Product name | Jewelers Platform / LuxeJewel (demo) |
| Apex / wildcard | `yourplatform.in` (demo hosts: `*.luxejewel.app`) |
| Admin | `admin.yourplatform.in` (target); Expo `/admin` interim |
| Platform admin | `console.yourplatform.in` |
| Customer subdomain | `{subdomain}.yourplatform.in` |
| Mongo Registry DB name | `platform_registry` |
| Tenant DB name | `tenant_{TENANT_CODE}` |
