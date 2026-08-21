# Expo / Maestro hardening notes

## Primary (required for pay)

Use Expo Go / simulator with AURELIA bake and API in **Test Mode** (`MOCK_RAZORPAY=0`).

Follow the device checklist in [docs/HARDENING_CHECKLIST.md](../../docs/HARDENING_CHECKLIST.md) Layer 3 — especially Checkout Test card `4111 1111 1111 1111`.

## Optional Maestro (nav only)

```bash
# With Expo Go open on a device/simulator
maestro test frontend/maestro/nav_storefront.yaml
```

Do **not** put Razorpay WebView card entry into Maestro CI — brittle and out of scope for demo hardening.
