# Testing

**Last updated:** 2026-08-21  
**Status:** Process lock for this monorepo.

## Hard rule

**After every successful development integration, a mock test run is mandatory before the slice can be marked Done.**

| Gate | Requirement |
|------|-------------|
| After each feature slice | `cd backend && pytest -q` must pass (all suites) |
| New feature | Tests in `backend/tests/` covering happy path, failure, and tenant isolation |
| External deps (SMS, Razorpay) | **Mocked** — no live SMS/Razorpay keys required for the gate |
| Docs | Update [PROGRESS.md](./PROGRESS.md) only after the gate is green |

**No Done without green mock pytest.**

## How to run

```bash
# From repo root — API must be reachable OR use TestClient suites (see conftest)
cd backend
pytest -q
```

`pytest.ini` already sets `pytest-xdist` (`-n 2 --dist loadscope`). Do not change `addopts`.

## Mock / local env (no paid keys)

| Variable | Purpose |
|----------|---------|
| `MONGO_URL` | Local Mongo (required for API) |
| `REGISTRY_DB` | e.g. `platform_registry` |
| `JWT_SECRET` | Shared signing secret |
| `APP_ENV` | `development` / `test` / `production` |
| `OTP_DEV_CODE` | Fixed OTP when `APP_ENV!=production` (e.g. `123456`) |
| `ALLOW_PAY_DEV_CONFIRM` | `1` enables `POST .../pay/dev-confirm` (mock/local only) |
| `MOCK_RAZORPAY` | `1` = in-process mock client (required for pytest gate). `0` = real Razorpay Test/Live API |
| `MOCK_R2` | `1` = local filesystem mock for product image uploads (pytest). Real Cloudflare: set `BUCKET_*` + `BUCKET_PUBLIC_BASE_URL` |
| `DEMO_RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | Optional: seed AURELIA gateway on startup (gitignored `.env` only) |
| `EXPO_PUBLIC_BACKEND_URL` | Base URL for HTTP integration tests (frontend `.env`) |
| `REDIS_URL` | Optional; OTP falls back to in-memory TTL store |

### Pytest vs Test Mode demo

HTTP suites hit a **running** API. The API process must use mocks for the gate:

```bash
cd backend
# Stop any Test Mode uvicorn, then:
MOCK_RAZORPAY=1 ALLOW_PAY_DEV_CONFIRM=1 MOCK_R2=1 python3 -m uvicorn server:app --host 127.0.0.1 --port 8000
# other terminal:
pytest -q
```

For **manual Test Mode** (real sandbox Checkout): set `MOCK_RAZORPAY=0` and `DEMO_RAZORPAY_*` in `backend/.env`, restart API, pay via Expo Checkout → `pay/confirm`. Runbook: [RAZORPAY_TEST_RUNBOOK.md](./RAZORPAY_TEST_RUNBOOK.md). MCP: [RAZORPAY_MCP.md](./RAZORPAY_MCP.md).

## Test Mode hardening (pre-prod)

After the mock gate is green, run the **Test Mode** profile and hardening smokes. Results live in [HARDENING_CHECKLIST.md](./HARDENING_CHECKLIST.md).

```bash
# Terminal A — Test Mode API
cd backend
set -a && source .env && set +a
export MOCK_RAZORPAY=0 ALLOW_PAY_DEV_CONFIRM=0 MOCK_R2=1
python3 -m uvicorn server:app --host 127.0.0.1 --port 8000

# Terminal B — smokes
python3 scripts/hardening_l1_smoke.py
python3 scripts/hardening_l3_expo_contract.py
python3 scripts/hardening_l5_security.py
python3 scripts/hardening_l4_webhook.py

# Optional web BFFs (admin :3000, platform-admin :3002)
python3 scripts/hardening_l2_web_bff.py
```

**Never** require live Razorpay keys for the Done/pytest gate. Device WebView card confirm: [DEMO_DEVICE_PAY.md](./DEMO_DEVICE_PAY.md). Full results: [HARDENING_CHECKLIST.md](./HARDENING_CHECKLIST.md) (**Demo stack CLEAR**).

SMS uses `LogSmsProvider` unless a real provider is configured later (MSG91 recommended for India). Live Razorpay keys are **not** required for pytest. Non-prod OTP request returns `dev_otp` for the Expo testing banner.

## Fixtures

See `backend/tests/conftest.py` for tenant headers, OTP helpers, and mock Razorpay utilities.
