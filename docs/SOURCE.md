# Source of this spec

Untitled-1 (Multi-Tenant Jewelers Platform blueprint) plus locked enhancements, then the Expo/FastAPI prototype:

1. Customer site URL in the Registry (`tenant_sites`); Host / `X-Tenant-Host` decides tenant.
2. Same email/phone on different sites (per-tenant-DB identity).
3. Theme panel at tenant creation (wizard target; seed + admin editor shipped).
4. Customer native app: per-tenant white-label Play Store release (no store switcher) — **Expo bake shipped**.
5. This monorepo: [rvchauhan99/jweller-platform](https://github.com/rvchauhan99/jweller-platform) (docs + `backend/` + `frontend/`). Progress: [PROGRESS.md](./PROGRESS.md).

| Source | Where it lives now |
|--------|-------------------|
| §0–1 DB-per-tenant, Registry | [ARCHITECTURE.md](./ARCHITECTURE.md), [DATA_MODEL.md](./DATA_MODEL.md) |
| `domain_routing` | [TENANT_SITES.md](./TENANT_SITES.md) |
| §2 Provisioning | [OPERATIONS.md](./OPERATIONS.md) — seed today; worker target |
| §4 Motor client | [ARCHITECTURE.md](./ARCHITECTURE.md) — Motor shipped; Beanie optional |
| §5 R2 | [ARCHITECTURE.md](./ARCHITECTURE.md) — pending; CDN URLs in seed |
| §6 Auth | [AUTH_IDENTITY.md](./AUTH_IDENTITY.md) — admin JWT shipped; OTP pending |
| §7 Modules | [FUNCTIONAL.md](./FUNCTIONAL.md), [RATES_SIP_PAYMENTS.md](./RATES_SIP_PAYMENTS.md) |
| §8 NestJS/Postgres | **Rejected.** FastAPI + Mongo |
| §10 Phases | [BUILD_ORDER.md](./BUILD_ORDER.md) — actual order: Expo + rates + SIP early |
| Theme / CMS | [THEMING.md](./THEMING.md) |
| Frontend visual law | [FRONTEND.md](./FRONTEND.md) |
| Native white-label | [FUNCTIONAL.md](./FUNCTIONAL.md), [`frontend/src/config/tenant.ts`](../frontend/src/config/tenant.ts) |
| API shape | [API.md](./API.md) — live inventory + full contract |
| Progress vs code | [PROGRESS.md](./PROGRESS.md) |
| Prototype PRD | [`memory/PRD.md`](../memory/PRD.md) |
