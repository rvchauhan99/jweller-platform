# API contract (documentation)

**Last updated:** 2026-08-21  
**Status:** Contract + **implemented inventory**. Server: [`backend/server.py`](../backend/server.py). See [PROGRESS.md](./PROGRESS.md).

Base path: `/api`. JSON. Admin auth: `Authorization: Bearer <jwt>` unless marked public.

---

## Implemented now

Public tenant from `X-Tenant-Host` (or Host). Admin from JWT.

### Public (live)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/public/bootstrap` | Theme snapshot + business |
| GET | `/api/public/cms` | |
| GET | `/api/public/categories` | |
| GET | `/api/public/products` | Optional `category`, `featured`, `q`, `purity`, `min_price`, `max_price`, `sort` |
| GET | `/api/public/products/{id}` | Includes `live_price` / `pricing` when rates up |
| GET | `/api/public/rates` | Feed + tenant margin + stale |
| POST | `/api/public/auth/otp/request` | `{ phone }` +91; rate-limited |
| POST | `/api/public/auth/otp/verify` | `{ phone, code }` → customer JWT |
| GET | `/api/public/me` | Customer JWT |
| PATCH | `/api/public/me` | Customer JWT — name/email |
| GET | `/api/public/sip/plans` | |
| POST | `/api/public/sip/enroll` | Customer JWT |
| GET | `/api/public/sip/enrollments` | Customer JWT |
| POST | `/api/public/sip/enrollments/{id}/pay` | Create Razorpay order (mock/live) |
| POST | `/api/public/sip/enrollments/{id}/pay/dev-confirm` | Local mock only (`ALLOW_PAY_DEV_CONFIRM=1`) |
| POST | `/api/public/sip/enrollments/{id}/pay/confirm` | Checkout HMAC verify → mark installment paid |
| POST | `/api/public/orders` | Customer JWT |
| GET | `/api/public/orders` | Customer JWT |
| GET | `/api/public/orders/{id}` | Customer JWT |
| POST | `/api/public/orders/{id}/pay` | Create Razorpay order + rate lock TTL |
| POST | `/api/public/orders/{id}/pay/dev-confirm` | Local mock only |
| POST | `/api/public/orders/{id}/pay/confirm` | Checkout HMAC verify → mark paid |
| GET | `/api/public/orders/{id}/invoice` | Jeweler tax invoice PDF (paid only; no IRN) |
| POST | `/api/public/webhooks/razorpay` | Signature + tenant notes; no Host |

### Admin (live)

| Method | Path |
|--------|------|
| POST | `/api/admin/auth/login` |
| GET | `/api/admin/me` |
| GET | `/api/admin/dashboard` |
| GET/POST/PUT/DELETE | `/api/admin/products`, `/api/admin/products/{id}` |
| GET/POST/PUT/DELETE | `/api/admin/categories`, `/api/admin/categories/{id}` |
| GET | `/api/admin/orders` |
| PUT | `/api/admin/orders/{id}/status` |
| POST | `/api/admin/uploads` | Multipart `file` → R2 product image; returns `{ key, url }` |
| GET | `/api/admin/storage/status` | R2 configured / mock flag |
| GET | `/api/public/media/{path}` | Serve MOCK_R2 objects only |
| POST | `/api/public/sip/enrollments/{id}/mandate/setup` | Start UPI Autopay auth order |
| POST | `/api/public/sip/enrollments/{id}/mandate/confirm` | Store token; first installment paid |
| POST | `/api/public/sip/enrollments/{id}/mandate/dev-confirm` | Mock only |
| POST | `/api/public/sip/enrollments/{id}/mandate/charge` | Recurring debit via token |
| POST | `/api/admin/sip/enrollments/{id}/mandate/pause\|resume\|cancel\|charge` | Admin mandate ops |
| GET/POST/PUT/DELETE | `/api/admin/sip/plans` |
| GET/PUT | `/api/admin/theme` |
| GET/PUT | `/api/admin/cms` |
| GET/PUT | `/api/admin/settings` |
| GET | `/api/admin/customers`, `/api/admin/customers/{id}` |
| POST | `/api/admin/customers` |
| GET/POST/PUT/DELETE | `/api/admin/staff` |
| GET/PUT | `/api/admin/gateway` |
| POST | `/api/admin/pos/sale` |
| GET/POST | `/api/admin/purchases` |
| GET | `/api/admin/reports/sales`, `/stock`, `/sip-liability` |

**Not live yet:** Redis-backed bootstrap, live SMS, DNS verify, Play packaging.

Clients: Expo `frontend/app/admin` (Bearer), Next.js `admin/` (cookie BFF → Bearer), Next.js `platform-admin/` (cookie BFF → `/api/platform`).

---

## Tenancy by prefix

| Prefix | Who | Tenant from |
|--------|-----|-------------|
| `/api/public/*` | Shopper, Expo / web storefront | **Host** or `X-Tenant-Host` via `tenant_sites` |
| `/api/admin/*` | Jeweler staff | Admin JWT `tenant_id` |
| `/api/platform/*` | Super-admin | Platform JWT (**not implemented**) |
| `/api/health` | Probe | None |

Rules:

- Public handlers **must not** read `tenant_id` from body/query/path.
- Admin handlers **must not** use Host to pick a tenant.
- **Expo (shipped):** calls FastAPI directly with `X-Tenant-Host`.
- **Target Next apps:** same-origin `/api` rewrite. Webhooks POST to the API host.

---

## Public (Host-scoped)

### Bootstrap and catalog

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/public/bootstrap` | no | Theme snapshot, business name, primary host, tenant status |
| GET | `/api/public/cms` | no | CMS |
| GET | `/api/public/categories` | no | |
| GET | `/api/public/products` | no | Listed online only; pagination, filters |
| GET | `/api/public/products/{id}` | no | |
| GET | `/api/public/rates` | no | Intl spot INR + tenant % + ₹/g premium + `fetched_at` |

### Auth

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/public/auth/otp/request` | no | `{ phone }` — keyed by tenant+phone |
| POST | `/api/public/auth/otp/verify` | no | find_or_create customer in **this** DB; JWT |
| GET | `/api/public/me` | customer JWT | Profile |
| PATCH | `/api/public/me` | customer JWT | Name, email (unique in this DB), addresses |

JWT must match Host tenant ([AUTH_IDENTITY.md](./AUTH_IDENTITY.md)).

### Cart / checkout / SIP (shopper)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/public/orders` | customer |
| GET | `/api/public/orders` | customer |
| GET | `/api/public/orders/{id}` | customer |
| POST | `/api/public/orders/{id}/pay` | customer | Create gateway order on **tenant** keys |
| POST | `/api/public/webhooks/{provider}` | signature | Tenant resolved by gateway account / metadata `tenant_id` stored at pay time — **not** Host (webhooks have no customer Host). Validate signature with **that** tenant’s webhook secret. |
| GET | `/api/public/sip/plans` | no | Active templates |
| POST | `/api/public/sip/enroll` | customer |
| GET | `/api/public/sip/mine` | customer |

Webhook exception: no Host. `tenant_id` in metadata is allowed **only** after signature verification and lookup of that tenant’s secret. Never trust unsigned metadata.

---

## Admin (JWT `aud=admin`)

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/auth/login` | `{ tenant_code, username, password }` |
| POST | `/api/admin/auth/logout` | optional |
| GET | `/api/admin/me` | |

### Operations (illustrative)

All scoped to JWT tenant DB.

| Area | Paths |
|------|--------|
| Dashboard | `GET /api/admin/dashboard` |
| Categories / products | CRUD `/api/admin/categories`, `/api/admin/products` |
| Purchases | `/api/admin/purchases` |
| Orders | list, status, refund `/api/admin/orders` |
| Customers | CRUD, KYC `/api/admin/customers` |
| SIP | templates, enrollments, installments, liability `/api/admin/sip/*` |
| Reports | `/api/admin/reports/*` + CSV |
| Theme | `GET/PUT /api/admin/theme` |
| CMS | `GET/PUT /api/admin/cms` |
| Sites | `GET/POST /api/admin/sites`, set primary, DNS status |
| Gateways | `GET/PUT /api/admin/gateways` owner only |
| Rate margins | `GET/PUT /api/admin/rate-margins` |
| Staff | `/api/admin/staff` owner |
| Uploads | `POST /api/admin/uploads` multipart → R2 PutObject (QuickerPay-style `BUCKET_*`); returns public `url` |

---

## Platform (JWT `aud=platform`) — **shipped**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/platform/auth/login` | Super-admin |
| GET | `/api/platform/me` | Session |
| GET | `/api/platform/tenants` | List |
| POST | `/api/platform/tenants` | Create (in-process provision; no Redis) |
| GET | `/api/platform/tenants/{id}` | Detail + sites + job |
| POST | `/api/platform/tenants/{id}/suspend` | |
| POST | `/api/platform/tenants/{id}/activate` | |
| GET | `/api/platform/tenants/{id}/jobs` | Provisioning job status |
| GET/POST | `/api/platform/tenants/{id}/sites` | Domain list / add (`pending_dns` for custom) |

**Not this wave:** impersonate, DNS verify, Redis cache.

Create-tenant body includes theme `{ preset_id, colors? }` ([THEMING.md](./THEMING.md)).

---

## Errors

Use consistent JSON: `{ "detail": "...", "code": "SITE_NOT_FOUND" | "TENANT_SUSPENDED" | "OTP_INVALID" | "THEME_PLAN_FORBIDDEN" | ... }`.

HTTP: 401 auth, 403 role, 404 unknown site (do not leak), 409 unique phone/email **in this tenant**, 422 validation, 429 OTP/login limits, 503 rate feed down if checkout blocked.

---

## Idempotency

- Provisioning: `idempotency_key` on job.
- Payments: gateway payment ids unique per tenant.
- OTP verify: one-time code.

---

## Versioning

v1: no `/v1` prefix until a breaking change. Document breaks in this file when implementation starts.
