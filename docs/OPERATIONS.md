# Operations

**Last updated:** 2026-08-17  
**Status:** Documentation. Runbooks for when the system exists. Nothing is deployed.

---

## Provisioning worker

Triggered by `POST /api/platform/tenants`. HTTP returns `{ tenant_id, status: "provisioning" }` immediately.

### Steps (idempotent)

1. **Validate** tenant still `provisioning`; job `idempotency_key = provision:{tenant_id}`.
2. **Seed tenant DB** — first write creates Mongo database `tenant_{CODE}`: categories, default SIP templates, `staff_profiles` for owner, `site_theme` from wizard, empty `site_cms` defaults, `rate_margins` zeros, `sequences`.
3. **R2** — no bucket create in v1; prefix `{tenant_code}/` is logical. Upload logo from wizard temp storage if any.
4. **Site row** — `tenant_sites` hostname `{subdomain}.yourplatform.in`, `kind=subdomain`, `status=active`, `is_primary=true` (or activate only when tenant activates — **decision: site row exists from insert; public resolver also requires tenant.status=active**).
5. **Snapshot** — `theme_public_snapshots` + Redis `theme:` and `site:`.
6. **Activate** — `tenants.status=active`.
7. **Notify** — email owner with tenant_code, admin URL, temp password handling.

On failure: `provisioning_jobs.status=failed`, `retry_count++`, exponential backoff, alert platform operators. Tenant remains non-public.

Re-run must not duplicate categories if seed docs use stable slugs (`gold`, `silver`, `diamond`).

---

## Local Phase 1 (locked)

Docker Compose: Mongo, Redis, MinIO, API, worker. Next apps use `/api` rewrite. Storefront tenancy: `Host` or `X-Tenant-Host` (non-production only). MinIO bucket stands in for R2; same key prefix rules.

## Wildcard DNS (after local Phase 1)

- `*.yourplatform.in` → storefront (Cloudflare).
- `admin`, `console`, `api` as separate records to the right apps (`api` for webhooks/workers; browsers still use same-origin `/api`).

Custom domains: Phase 6 ([TENANT_SITES.md](./TENANT_SITES.md)).

---

## Tenant suspend (SaaS non-payment or abuse)

- `tenants.status=suspended`.
- Public Host: unavailable page (may still use theme snapshot).
- Admin: **read-only** + export; no new orders, no POS, no SIP enroll.
- Redis site cache invalidated.

---

## Offboarding / export

Trust feature, not an afterthought.

- Export tenant Mongo (mongodump that DB) + R2 prefix zip (exclude nothing the jeweler legally owns; signed URL for KYC).
- After confirmed offboard: `status=deleted`, disable sites, optional drop DB after retention window.

---

## Backup and restore

- Cluster snapshots cover Registry + all tenant DBs.
- **Single-tenant restore:** restore one database name onto a staging cluster, or mongodump/mongorestore `tenant_RAJ001` only. Test this before the first real incident.
- Registry `tenant_sites` must stay consistent with restored DB (same `tenant_id`).

---

## Schema / backfill at scale

Mongo will not fail if a new field is missing. When old documents **must** be rewritten (e.g. rename, split collection):

- Worker loops `tenants` where `status in (active, suspended)`.
- Per-tenant backfill status in Registry (`schema_jobs`).
- Default in Beanie for missing fields in the meantime.

---

## Observability

- Structured logs: `tenant_id`, `hostname`, `request_id`. Never log OTP or gateway secrets.
- Metrics: provision success, OTP send, checkout, webhook verify fail, rate fetch age.
- Alert: rate feed stale, provision stuck, webhook error rate.

---

## Edge cases (decided)

| Topic | Decision |
|-------|----------|
| Multi-branch | `branches` in tenant schema from v1; **UI hidden** until a jeweler needs it |
| Inventory | Unique tagged jewellery **and** commodity/weight stock |
| Making | Per product `amount` (₹) or `percent` of metal |
| HUID | Optional on jewellery; not required to save or list online |
| Checkout gateway | Razorpay only in v1 |
| Rate-lock race | Mongo transaction on stock + order insert |
| Feed down | Last-known + stale flag; default block commodity checkout |
| Invoice numbers | Per-tenant, per FY sequence |
| KYC for SIP | Configurable threshold; documents private R2 |
| Admin on customer Host | Not supported; reserved hosts |
| Localhost | `X-Tenant-Host` in non-production only |
| Cross-tenant analytics | Batch job over tenant DBs; not a live join |

---

## Secrets

Never in git. When code exists: `.env` / secret manager for `MONGO_URI`, Redis, R2, JWT keys, SMS, rate-provider API, platform admin bootstrap.

Tenant gateway keys: encrypted with a platform KEK in env, ciphertext in tenant DB.

---

## MealHQ isolation

Separate Mongo cluster (or at least separate Registry DB and never `tenant_*` name collisions with MealHQ). Separate Cloudflare account/bucket. Separate JWT secrets. No shared Firebase.
