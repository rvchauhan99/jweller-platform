# Rates, SIP, and payments

**Last updated:** 2026-08-22  
**Status:** Partially implemented (rates API, SIP enroll/pay/Autopay, one-time metal buy + wallet). Spec below remains the north star.

---

## Live metal rates (shared platform service)

One fetcher for the whole platform. Tenants do not each call MCX/IBJA/GoldAPI per request.

### Provider (implemented)

- **Metals:** [gold-api.com](https://api.gold-api.com) — XAU/XAG USD per troy oz (keyless).
- **FX:** [frankfurter.dev](https://api.frankfurter.dev) — USD→INR (keyless).
- **Not used:** GoldAPI.io / IBJA — optional later; GoldAPI INR is still international spot (same market family), not city retail boards.

Poll every 5 minutes; stale after 15 minutes; last-known snapshot in Registry `rates` (`spot_latest`).

### Sell rate (Indian jeweler shop board)

```
base_inr_g = (USD_oz × USD/INR) / 31.1034768
sell_inr_g = base_inr_g × (1 + margin_pct/100) + margin_inr_per_g
```

- `margin_pct` — optional percent over international base.
- `margin_inr_per_g` — **absolute ₹/g city/shop premium** (how jewelers match Hyderabad/Mumbai boards).
- Optional tenant labels: `rate_city`, `rate_state` (display only).

Admin settings show live **base → sell preview** so the jeweler can dial premiums without guessing.

### Behaviour

1. Worker polls provider on an interval (e.g. 1–5 minutes).
2. Persist last-known in Registry `rates` (`spot_latest`).
3. Tenant sell rate = formula above from `rate_margins`.
4. Storefront `GET /api/public/rates` returns sell + `base_inr_per_gram` + margins + `fetched_at` + `stale`.

### Stale feed

| Tenant setting | Default |
|----------------|---------|
| `commodity_max_staleness_seconds` | 900 (15 min) |
| `on_stale` | `block_checkout` \| `allow_with_warning` — default **block** |

Jewellery (fixed making + listed price) can still check out when commodity is blocked.

### Rate lock

- Displayed rate is indicative until lock.
- **Lock at order placement** on each commodity line (`rate_per_gram`, `metal`, `purity`, `locked_at`, `feed_id`).
- If payment is not completed within `lock_ttl_seconds` (default 300), order payment fails and a **new** lock is required.
- Offline POS: lock at bill save.
- **Never** reprice a paid/confirmed line when the feed moves.

Concurrency: inventory decrement and rate lock in one tenant-DB transaction (Mongo session) for stock-linked SKUs.

---

## Payments — Model B (locked)

**The jeweler is the merchant.** Customer money goes to the jeweler’s Razorpay/Cashfree account. The platform does not settle gold proceeds and does not hold SIP corpuses.

Why: gold SIP-like products sit near Indian regulatory attention. The product is **software**, not a money handler.

### Store

Encrypted keys on tenant `payment_gateway_settings`. Owner-only. Storefront only receives a **gateway order id** created server-side with those keys.

**v1 provider: Razorpay.** Schema may list `cashfree`; do not implement Cashfree order/webhook in v1.

### Webhooks

Gateway calls `POST /api/public/webhooks/{provider}`. No Host header tenancy.

1. Identify tenant from signed payload (account id map in Registry **or** `tenant_id` in order notes created by us).
2. Verify signature with **that** tenant’s webhook secret.
3. Update **that** tenant’s order. Ignore if tenant_id mismatch.

### Platform SaaS billing

Separate from jewellery checkout. Registry `billing_subscriptions` (trial / invoice / Stripe later). Non-payment → tenant `suspended` ([OPERATIONS.md](./OPERATIONS.md)).

### Model A (platform-collects)

Out of v1. Do not implement split payouts or platform merchant accounts for jewellery.

---

## SIP engine

SIP is **not** a normal order with a cron. It is its own subsystem.

### Plan template (jeweler)

- Name, min/max installment, duration (months)
- `rate_mode`: `per_installment` (each debit locks gold grams at that day’s sell rate) or `at_maturity` (cash accumulated, conversion at end)
- Redemption: product, cash, or either
- Grace days and penalty (optional, tenant-configurable)

### Enrollment

- Customer on **this site** only (tenant DB).
- Recurring mandate via **tenant** gateway (UPI Autopay / eNACH / saved card as the gateway allows).
- Missed installment → `missed`; jeweler dashboard alert; optional SMS.

### Maturity

- Compute owed grams or cash per `rate_mode`.
- Jeweler completes redemption (order for jewellery or cash payout **from jeweler**, not from platform).
- Enrollment `matured`.

### Liability report

Sum of outstanding obligation (gold grams and/or INR) for `active` + `missed` enrollments. This is a **risk view for the jeweler**, not a platform balance sheet.

### KYC gate

Configurable: require PAN/KYC above installment or corpus threshold (tenant setting). Default: warn, do not hardcode a legal number in code without jeweler confirmation.

---

## India GST (invoices)

Per tenant:

- GSTIN on profile
- Invoice sequence per financial year
- HSN on product/commodity
- Tax breakup on invoice PDF (R2 private)

Wrong GST is a jeweler compliance issue; the software must still produce consistent sequences and snapshots.
