# Data model

**Last updated:** 2026-08-17  
**Status:** Documentation. Beanie-shaped schemas for implementers. Not applied to any database yet.

Convention: Pydantic/Beanie field names. Mongo `_id` omitted. Timestamps `created_at` / `updated_at` on all documents unless noted.

Database names:

- Registry: `platform_registry`
- Tenant: `tenant_{TENANT_CODE}` e.g. `tenant_RAJ001`

---

## Registry collections

### `tenants`

| Field | Type | Notes |
|-------|------|--------|
| `tenant_code` | str | Unique. Login id. `[A-Z0-9]{3,12}` |
| `business_name` | str | |
| `mongo_db_name` | str | Unique. Default `tenant_{tenant_code}` |
| `r2_bucket_name` | str | Shared bucket name in v1 |
| `r2_prefix` | str | Usually `tenant_code` |
| `subdomain` | str | Unique slug |
| `status` | enum | `provisioning` \| `active` \| `suspended` \| `deleted` |
| `plan` | enum | `basic` \| `pro` \| `enterprise` |
| `storage_used_bytes` | int | |
| `storage_quota_bytes` | int | From plan |
| `suspended_reason` | str \| null | |
| `created_at` / `updated_at` | datetime | |

Indexes: unique `tenant_code`, unique `subdomain`, unique `mongo_db_name`, `status`.

### `tenant_sites`

See [TENANT_SITES.md](./TENANT_SITES.md).

| Field | Type |
|-------|------|
| `tenant_id` | ObjectId |
| `hostname` | str unique |
| `kind` | `subdomain` \| `custom` \| `preview` |
| `status` | `pending_dns` \| `verified` \| `active` \| `ssl_failed` \| `disabled` |
| `is_primary` | bool |
| `verification_token` | str \| null |

Indexes: unique `hostname`; `{ tenant_id: 1, is_primary: 1 }`.

Application rule: at most one `is_primary: true` per `tenant_id`.

### `tenant_admins`

Thin auth. Full profile in tenant DB.

| Field | Type |
|-------|------|
| `tenant_code` | str |
| `tenant_id` | ObjectId |
| `username` | str | email or E.164 phone, lowercase |
| `password_hash` | str |
| `role` | `owner` \| `manager` \| `sales_staff` \| `accountant` |
| `disabled` | bool |

Indexes: unique `{ tenant_code: 1, username: 1 }`.

Same username **may** exist under another `tenant_code`.

### `platform_super_admins`

| Field | Type |
|-------|------|
| `email` | str unique |
| `password_hash` | str |
| `name` | str |
| `disabled` | bool |

### `provisioning_jobs`

| Field | Type |
|-------|------|
| `tenant_id` | ObjectId |
| `step` | str | e.g. `seed_db`, `seed_theme`, `register_site`, `activate` |
| `status` | `pending` \| `running` \| `failed` \| `done` |
| `error_log` | str \| null |
| `retry_count` | int |
| `idempotency_key` | str unique | `provision:{tenant_id}` |

### `theme_public_snapshots`

| Field | Type |
|-------|------|
| `tenant_id` | ObjectId unique |
| `payload` | dict | Safe theme + display name |
| `updated_at` | datetime |

### `billing_subscriptions`

Platform SaaS fee (software), **not** customer gold payments.

| Field | Type |
|-------|------|
| `tenant_id` | ObjectId unique |
| `plan` | str |
| `status` | `trialing` \| `active` \| `past_due` \| `cancelled` |
| `current_period_end` | datetime \| null |
| `external_id` | str \| null | Stripe etc. later |

### `impersonation_audit`

| Field | Type |
|-------|------|
| `actor_admin_id` | ObjectId |
| `tenant_id` | ObjectId |
| `reason` | str |
| `started_at` / `ended_at` | datetime |

### `platform_gold_rates`

Shared feed cache (also in Redis). Optional durable last-known.

| Field | Type |
|-------|------|
| `metal` | `gold` \| `silver` |
| `purity` | str | e.g. `24K`, `22K`, `999` |
| `rate_per_gram` | Decimal as str or Decimal128 |
| `source` | str |
| `fetched_at` | datetime |
| `stale` | bool |

---

## Tenant collections

All queries in a tenant DB are implicitly scoped — there is no `tenant_id` column required. Still store `tenant_id` on documents **if** you ever restore a dump into the wrong DB (defence in depth). Recommended: include `tenant_id` on every tenant document matching Registry id.

### `categories`

Seed: Gold, Silver, Diamond (editable).

| Field | Type |
|-------|------|
| `name` | str |
| `slug` | str unique |
| `sort_order` | int |
| `active` | bool |

### `products`

Two modes on one collection: `jewellery` (tagged pieces / countable SKUs; optional barcode and HUID) and `commodity` (weight in grams; no HUID).

| Field | Type |
|-------|------|
| `sku` | str unique |
| `name` | str |
| `category_id` | ObjectId |
| `kind` | `jewellery` \| `commodity` |
| `weight_grams` | decimal |
| `purity` | str |
| `making_charge` | decimal |
| `making_charge_type` | `amount` \| `percent` | ₹ or % of metal value |
| `wastage_percent` | decimal |
| `barcode` | str \| null | piece / SKU scan |
| `huid` | str \| null | optional BIS HUID; not required to save or list online |
| `images` | list of r2 keys |
| `stock_qty` | decimal | 0 for made-to-order |
| `active` | bool |
| `listed_online` | bool |

### `branches` (schema now, admin UI hidden in v1)

| Field | Type |
|-------|------|
| `name` | str |
| `address` | str |
| `is_default` | bool |

Stock by location can reference `branch_id`. If unused, all stock is default branch.

### `purchases`

Supplier buy; updates weighted average cost.

| Field | Type |
|-------|------|
| `supplier_name` | str |
| `lines[]` | product/commodity, purity, weight, cost |
| `purchased_at` | datetime |

### `average_costs`

| Field | Type |
|-------|------|
| `product_id` or commodity key | |
| `avg_cost_per_gram` or per unit | decimal |
| `updated_at` | datetime |

### `customers`

| Field | Type |
|-------|------|
| `phone` | str | E.164, unique in this DB |
| `email` | str \| null | unique sparse |
| `name` | str \| null |
| `addresses[]` | |
| `kyc_status` | `none` \| `pending` \| `verified` |
| `credit_balance` | decimal |
| `notes` | str | staff only |

Indexes: unique `phone`; unique sparse `email`.

**Same phone in another tenant DB is allowed.**

### `kyc_documents`

| Field | Type |
|-------|------|
| `customer_id` | ObjectId |
| `r2_key` | str | private |
| `doc_type` | `pan` \| `aadhaar` \| `other` |

### `orders` (online)

| Field | Type |
|-------|------|
| `order_no` | str unique | per-tenant sequence |
| `customer_id` | ObjectId |
| `channel` | `online` |
| `status` | `placed` \| `confirmed` \| `packed` \| `shipped` \| `delivered` \| `cancelled` |
| `payment_status` | `pending` \| `paid` \| `refunded` \| `failed` |
| `lines[]` | product snapshot, weight, making, **locked_rate**, line total |
| `totals` | |
| `gateway` | `razorpay` \| `cashfree` \| … |
| `gateway_payment_id` | str \| null |
| `invoice_r2_key` | str \| null |

Rate lock: each commodity line stores `metal`, `purity`, `rate_per_gram`, `locked_at`. Never recompute historical lines from today’s feed.

### `offline_sales`

Walk-in bills. Same line snapshot rules as orders. `channel: offline`. May live in `orders` with `channel` discriminator **or** separate collection. **Decision: one `orders` collection with `channel`.**

### `invoices`

GST invoice numbering per tenant (and per year). Sequence in `invoice_sequences`.

### `site_theme`

Singleton. See [THEMING.md](./THEMING.md).

### `site_cms`

| Field | Type |
|-------|------|
| `hero_title` / `hero_subtitle` | |
| `hero_image_r2_key` | |
| `about_html` | sanitized |
| `contact` | phone, address, map |
| `banners[]` | image, link, active |
| `featured_product_ids[]` | |

### `rate_margins`

| Field | Type |
|-------|------|
| `metal` | |
| `purity` | |
| `margin_per_gram` | decimal | or percent — pick one; **decision: absolute ₹/g markup** plus optional `margin_percent` |
| `active` | bool |

Sell rate = platform feed + tenant margin. Locked on the order line at confirm.

### `payment_gateway_settings`

| Field | Type |
|-------|------|
| `provider` | `razorpay` \| `cashfree` | **v1 checkout: Razorpay only.** Cashfree may be stored later; do not wire. |
| `key_id` | str |
| `key_secret_encrypted` | str |
| `webhook_secret_encrypted` | str |
| `enabled` | bool |

Owner-only read of secrets. Never sent to storefront.

### `sip_plan_templates`

| Field | Type |
|-------|------|
| `name` | str |
| `installment_amount_min` / `max` | |
| `duration_months` | int |
| `rate_mode` | `per_installment` \| `at_maturity` |
| `redemption` | `product` \| `cash` \| `either` |
| `active` | bool |

### `sip_enrollments`

| Field | Type |
|-------|------|
| `customer_id` | |
| `plan_id` | |
| `status` | `active` \| `missed` \| `matured` \| `cancelled` |
| `mandate_ref` | str \| null |
| `start_at` / `maturity_at` | |
| `accumulated_value` / `accumulated_gold_grams` | as required by `rate_mode` |

### `sip_installments`

| Field | Type |
|-------|------|
| `enrollment_id` | |
| `due_at` | |
| `amount` | |
| `status` | `pending` \| `paid` \| `failed` \| `waived` |
| `paid_at` | |
| `locked_rate` | if per-installment mode |

### `staff_profiles`

| Field | Type |
|-------|------|
| `tenant_admin_id` | ObjectId | Registry id |
| `display_name` | |
| `permissions` | dict optional overrides |

### `activity_log`

Staff actions for jeweler-facing audit (sales voids, KYC view).

---

## Sequences

Per-tenant counters collection `sequences`: `{ name: "order", value: n }`, `{ name: "invoice_fy2026", value: n }`. Atomic `findOneAndUpdate` `$inc`.

---

## What is not in Registry

- Customer emails/phones (except staff usernames)
- Orders, SIP, inventory
- Gateway secrets (tenant DB)

## What is not in tenant DB

- Hostname routing
- Super-admins
- Other tenants’ data
- Platform gold **base** feed (shared); margins stay in tenant DB
