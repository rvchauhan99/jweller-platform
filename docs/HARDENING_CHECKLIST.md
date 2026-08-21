# Hardening checklist (demo → pre-prod)

**Status: Demo stack CLEAR (Test Mode)** — 2026-08-21  
**Primary verification profile:** `MOCK_RAZORPAY=0` (real Razorpay Test API).  
**Mock profile** is only for the CI/pytest gate (`MOCK_RAZORPAY=1` on the command line).

## Verdict

Test Mode smokes are **green** for orders, SIP Autopay mandate **create**, SIP installment fallback, platform, admin BFF, webhooks (signed + reject), and tenancy.  

**Human residual:** Expo WebView Test-card confirm once — [DEMO_DEVICE_PAY.md](./DEMO_DEVICE_PAY.md).

## Gaps filled this pass

| Gap | Fix |
|-----|-----|
| Autopay `type: online` rejected | Removed invalid `token.type`; Razorpay docs use `max_amount` + `frequency` + `expire_at` only |
| Webhook secret missing | Generated `DEMO_RAZORPAY_WEBHOOK_SECRET` in local `.env` (gitignored); synced to AURELIA gateway |
| Signed webhook | **PASS** — valid HMAC accepted (`order_missing` body OK for smoke) |

## Layer results (Test Mode re-run)

| Layer | Result |
|-------|--------|
| L1 API (orders, SIP mandate setup, platform) | **21/21 PASS** (mandate order `order_TSW…`) |
| L2 admin + platform BFF | **17/17 PASS** |
| L3 Expo contract | **15/15 PASS** (WebView confirm still **HUMAN**) |
| L4 webhooks | **PASS** bad sig + signed accept |
| L5 security | **5/5 PASS** |

## Still human / optional

1. Expo Go Test card pay — [DEMO_DEVICE_PAY.md](./DEMO_DEVICE_PAY.md)  
2. ngrok + Razorpay Dashboard webhook URL (secret already on gateway when seeded from `.env`)  
3. Live Mode — deferred  

## How to run Test Mode hardening

```bash
cd backend
set -a && source .env && set +a
export MOCK_RAZORPAY=0 ALLOW_PAY_DEV_CONFIRM=0 MOCK_R2=1
python3 -m uvicorn server:app --host 127.0.0.1 --port 8000

python3 scripts/hardening_l1_smoke.py
python3 scripts/hardening_l3_expo_contract.py
python3 scripts/hardening_l4_webhook.py
python3 scripts/hardening_l5_security.py
# with admin:3000 + platform-admin:3002
python3 scripts/hardening_l2_web_bff.py
```

## Pytest gate (mock — separate process)

```bash
MOCK_RAZORPAY=1 ALLOW_PAY_DEV_CONFIRM=1 MOCK_R2=1 python3 -m uvicorn server:app --host 127.0.0.1 --port 8000
pytest -q
```
