# Tenant sites — customer URL decides the tenant

**Last updated:** 2026-08-17  
**Status:** Documentation. Not implemented.

This is a locked product rule. The customer website hostname is stored in the **Registry**, not guessed from a path, query param, or client-supplied `tenant_id`.

---

## Why a site table (not one `custom_domain` field)

A jeweler needs:

| Kind | Example | When |
|------|---------|------|
| `subdomain` | `rajjewellers.yourplatform.in` | Always created at provision. Fallback forever. |
| `custom` | `www.rajjewellers.com` | Optional. Phase 6 for SSL automation; schema exists from day one. |
| `preview` | `raj001-preview.yourplatform.in` | Optional. Theme/CMS preview without touching production Host. |

One tenant may have several hostnames. **Exactly one** `is_primary=true` is the canonical customer URL (used in emails, invoices, sitemap).

`hostname` is **globally unique**. Two tenants cannot claim `www.gold.com`.

---

## Registry fields

### `tenants` (site-related)

- `subdomain` — slug only, unique, e.g. `rajjewellers`. Used to build the free hostname.
- Do **not** treat a single `custom_domain` string as the routing table. Routing is `tenant_sites`.

### `tenant_sites` (lookup table)

| Field | Rule |
|-------|------|
| `hostname` | Lowercase, no port, no trailing dot. Unique index. |
| `tenant_id` | FK to `tenants` |
| `kind` | `subdomain` \| `custom` \| `preview` |
| `status` | `pending_dns` \| `verified` \| `active` \| `ssl_failed` \| `disabled` |
| `is_primary` | One true per tenant |
| `verification_token` | TXT record for custom domains |
| `created_at` / `updated_at` | |

Normalize before write and before lookup:

- lowercase
- strip port (`rajjewellers.yourplatform.in:443` → host only)
- strip trailing `.`
- treat `www.` and apex as **two rows** if both must work; do not silently alias unless both are registered

Reserved hostnames (never insert as tenant sites):

- `admin.yourplatform.in`
- `console.yourplatform.in`
- `api.yourplatform.in`
- `www.yourplatform.in` (marketing)
- `yourplatform.in` (marketing)

---

## Resolution algorithm (public / storefront / customer API)

```
function resolve_public_tenant(request):
    host = normalize(request.headers["host"])
    if host in RESERVED:
        reject 404  # wrong app

    cached = redis.get("site:" + host)
    if cached:
        row = cached
    else:
        row = tenant_sites.find_one({ hostname: host })
        if not row:
            return unknown_site  # 404
        tenant = tenants.find_one({ _id: row.tenant_id })
        row = { ...row, mongo_db_name, tenant_status, r2_prefix, tenant_code }
        redis.setex("site:" + host, 60, row)  # short TTL; invalidate on site change

    if row.status != "active":
        return site_not_ready
    if row.tenant_status == "suspended":
        return tenant_unavailable_page
    if row.tenant_status != "active":
        return site_not_ready

    bind request to mongo_client[row.mongo_db_name]
    attach request.tenant_ctx
```

**Never** accept `tenant_id`, `tenant_code`, or `db_name` from query, body, or path on public routes.

Cache invalidation: on any `tenant_sites` or `tenants.status` write, `DEL site:{hostname}` for all hostnames of that tenant.

Edge (Cloudflare Worker / Next middleware) **may** cache the same map. Source of truth remains Registry. Edge must not invent tenants.

---

## Local development

Production Host routing does not work on `localhost`. Allowed **dev-only** overrides (disabled when `ENV=production`):

1. Header `X-Tenant-Host: rajjewellers.yourplatform.in`
2. Or env `DEV_DEFAULT_HOST` for a single seeded tenant

The override value is passed through the **same** `tenant_sites` lookup. There is no “pass tenant_id in the URL” shortcut.

---

## Admin and platform apps

| App | Host | Tenant resolution |
|-----|------|-------------------|
| Jeweler admin | `admin.yourplatform.in` | JWT `tenant_id` after tenant_code login |
| Platform console | `console.yourplatform.in` | Super-admin JWT; may **impersonate** with audit |
| API `/api/admin/*` | any | Admin JWT |
| API `/api/platform/*` | any | Super-admin JWT |
| API `/api/public/*` | customer Host | Site table only |

A jeweler must not open the storefront Host and reach admin APIs with a customer token.

---

## Custom domain onboarding (Phase 6; data model from day one)

1. Jeweler (or platform admin) adds hostname `www.rajjewellers.com`, `kind=custom`, `status=pending_dns`.
2. Platform shows:
   - CNAME `www` → `cname.yourplatform.in` (or Cloudflare for SaaS target)
   - TXT `_yourplatform-verify.www.rajjewellers.com` = `verification_token`
3. Worker polls DNS. On TXT match → `verified`.
4. SSL provisioned (Cloudflare for SaaS / Vercel domains — **not** hand-rolled ACME in v1).
5. On cert OK → `status=active`, Redis warmed, optional `is_primary=true`.

Reject activation if hostname is already owned by another tenant.

---

## Same site, same tenant — identity implication

Once Host maps to tenant A, **all** customer login, cart, and OTP state is tenant A. See [AUTH_IDENTITY.md](./AUTH_IDENTITY.md).

The site table does not store customers. It only answers “which database is this shop?”

---

## Failure modes

| Situation | User sees |
|-----------|-----------|
| Unknown Host | Generic 404 (do not leak other tenants) |
| Site `pending_dns` | “Domain not active yet” |
| Tenant `provisioning` | “Store is being set up” |
| Tenant `suspended` | Branded unavailable (theme snapshot OK to use) |
| Tenant `deleted` | Same as unknown |
| Redis down | Fall through to Mongo Registry (availability over cache) |
