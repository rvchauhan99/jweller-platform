# Demo device pay (5 minutes)

**When:** After API is on **Test Mode** (`MOCK_RAZORPAY=0` + Test keys).  
**Goal:** One paid order + one SIP installment via real Razorpay Checkout WebView.

## Start

```bash
# API
cd backend && set -a && source .env && set +a
export MOCK_RAZORPAY=0 ALLOW_PAY_DEV_CONFIRM=0 MOCK_R2=1
python3 -m uvicorn server:app --host 127.0.0.1 --port 8000

# Expo (AURELIA bake; EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000)
cd frontend && npx expo start
```

Optional: jeweler admin `http://127.0.0.1:3000` — login `AURELIA` / `owner` / `Aurelia@123`.

## Customer pay

1. Open Expo Go → storefront.  
2. Sign in → any valid `+91` mobile → OTP **`123456`**.  
3. Add a product → Checkout → Pay.  
4. Razorpay Test Checkout → card **`4111 1111 1111 1111`**, any future expiry, any CVV.  
5. Confirm success → Orders → download invoice PDF.  
6. SIP tab → enroll if needed → **Pay installment** → same Test card.

## Verify

- Expo: order / installment show paid.  
- Admin → Orders / Gold SIP / dashboard last paid updates.

## Known skips

- Live Mode money — deferred.  
- Dashboard ngrok webhook URL — optional once secret is set (local `.env` + Admin gateway already synced for signed smoke).
