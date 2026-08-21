# Platform console (Next.js)

Operator UI for create-tenant, suspend/activate, and domain list.

```bash
cd platform-admin
npm install
BACKEND_URL=http://127.0.0.1:8000 npm run dev -- -p 3002
```

Default operator (seeded on API boot): `ops@luxejewel.app` / `Platform@123` (override with `PLATFORM_ADMIN_*`).

Cookie BFF → `/api/platform/*`. No Redis. No live SMS.
