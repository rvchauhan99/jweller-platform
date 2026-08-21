# Razorpay UPI Autopay (SIP) — Test Mode checklist

**Prerequisite:** AURELIA Test keys (`DEMO_RAZORPAY_*` or Admin gateway), `MOCK_RAZORPAY=0` for real Autopay Checkout; use `MOCK_RAZORPAY=1` + `mandate/dev-confirm` for local/pytest.

## Flow

1. Customer enrolls in SIP (OTP).
2. **Set up UPI Autopay** → `POST .../mandate/setup` creates Razorpay customer + mandate order.
3. Customer authorizes in Checkout (UPI).
4. App calls `POST .../mandate/confirm` → stores `token_id`, sets `mandate_status=active`, marks first installment paid.
5. Later dues: **Autopay** → `POST .../mandate/charge` (recurring debit) **or** keep **Pay installment** one-time Checkout.
6. Admin Gold SIP: Charge / Pause / Resume / Cancel mandate.

## Webhooks (Test Dashboard)

Subscribe (optional but recommended for Live):

- `payment.captured` (notes `kind`: `sip_mandate_auth` | `sip_recurring` | `sip_installment`)
- `token.confirmed` / `token.cancelled` / `token.paused` / `token.resumed`

Endpoint: `POST /api/public/webhooks/razorpay` (needs public URL + `DEMO_RAZORPAY_WEBHOOK_SECRET` or Admin webhook secret).

## Mock gate

```bash
MOCK_RAZORPAY=1 ALLOW_PAY_DEV_CONFIRM=1 MOCK_R2=1 python3 -m uvicorn server:app --host 127.0.0.1 --port 8000
pytest -q
```

`mandate/dev-confirm` activates Autopay without real UPI.

## Test Mode note (hardening)

Mandate order token uses `max_amount`, `frequency`, `expire_at` only (no `type: online` — that field caused Test API 400s).  
If a merchant still cannot create Autopay mandates, API returns **400** and SIP **Pay installment** Checkout remains the fallback.
