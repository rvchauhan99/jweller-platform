# Razorpay Test Mode runbook (AURELIA)

**Audience:** local demo / jeweler Test Mode cycle.  
**Do not commit** Key Secret / webhook secret.

## Prerequisites

- Mongo running; API: `cd backend && set -a && source .env && set +a && python3 -m uvicorn server:app --host 127.0.0.1 --port 8000`
- `backend/.env`: `MOCK_RAZORPAY=0`, `OTP_DEV_CODE=123456`, optional `DEMO_RAZORPAY_KEY_ID` / `_SECRET` (seeds AURELIA on startup)
- Expo: `EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000`, tenant AURELIA bake

## Customer OTP (testing app)

1. Open Expo → Sign in → enter any valid Indian mobile (starts 6–9).
2. After Send OTP, screen shows: **This is a testing app** and OTP **`123456`** (from API `dev_otp` when non-prod).
3. Tap Verify → customer JWT created (find-or-create in tenant DB).

Production must set `APP_ENV=production` so fixed OTP and `dev_otp` are never returned.

## Pay an order (Test Mode)

1. Add product → Checkout → Pay.
2. Razorpay Checkout opens (WebView). Use test card e.g. `4111 1111 1111 1111`.
3. App calls `POST /api/public/orders/{id}/pay/confirm` (HMAC). Order becomes `payment_status=paid`.
4. Orders → **Download invoice** (jeweler tax invoice PDF).

## SIP installment

1. SIP tab → enrol (auth required) → Pay due installment → same Checkout → confirm.
2. Admin → Gold SIP / dashboard SIP due counts update.

## Webhook (optional backup)

- Endpoint: `POST /api/public/webhooks/razorpay`
- Local: expose API with ngrok; in Razorpay Dashboard (Test) → Webhooks → `payment.captured` + webhook secret on Admin → Settings → Gateway.
- Checkout `pay/confirm` works without a public webhook.

## Admin payment health

Dashboard shows gateway enabled, mock vs live/Test API, masked key id, last paid order.

## Pytest gate (mocks)

HTTP suites need the **API process** on mocks (conftest alone is not enough):

```bash
cd backend
MOCK_RAZORPAY=1 ALLOW_PAY_DEV_CONFIRM=1 python3 -m uvicorn server:app --host 127.0.0.1 --port 8000
# other terminal
pytest -q
```

See [TESTING.md](./TESTING.md). MCP agent setup: [RAZORPAY_MCP.md](./RAZORPAY_MCP.md). SIP Autopay: [RAZORPAY_AUTOPAY.md](./RAZORPAY_AUTOPAY.md).

## Security

- Rotate Test keys if they were pasted into chat.
- Never commit `.env` or merchant tokens.
