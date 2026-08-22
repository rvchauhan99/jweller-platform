"""
Multi-tenant luxury jeweler storefront — backend core (demo scope).

Architecture (locked by spec):
  - One MongoDB cluster, database-per-tenant.
  - Registry DB (platform_registry): tenants, tenant_sites, tenant_admins, theme_public_snapshots.
  - Per-tenant DB (tenant_{code}): categories, products, site_theme, site_cms.
  - Public tenancy resolved from the Host / X-Tenant-Host header — NEVER a client-supplied tenant_id.
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio

from seed_data import build_seed
from deps import (
    client,
    registry,
    JWT_SECRET,
    logger,
    hash_password,
    verify_password,
    _now_iso,
    _encrypt_secret,
    _spot,
    refresh_spot,
    _spot_poller,
)
from routers import platform as platform_routes
from routers import public_routes, admin_routes, webhooks

app = FastAPI(title="LuxeJewel Storefront API")
api_router = APIRouter(prefix="/api")

api_router.include_router(public_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(webhooks.router)

platform_routes.bind(
    registry=registry,
    client=client,
    jwt_secret=JWT_SECRET,
    hash_password=hash_password,
    verify_password=verify_password,
)
app.include_router(platform_routes.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Idempotent demo seed (replaces the platform console for the demo)
# ---------------------------------------------------------------------------
async def seed_demo():
    tenants, sites, snapshots, tenant_data = build_seed()

    for t in tenants:
        # Preserve payment_gateway / secrets set via Admin or DEMO_RAZORPAY_* 
        payload = {k: v for k, v in t.items() if k != "payment_gateway"}
        await registry.tenants.update_one({"_id": t["_id"]}, {"$set": payload}, upsert=True)
    for s in sites:
        await registry.tenant_sites.update_one({"hostname": s["hostname"]}, {"$set": s}, upsert=True)
    for snap in snapshots:
        await registry.theme_public_snapshots.update_one(
            {"tenant_id": snap["tenant_id"]}, {"$set": snap}, upsert=True
        )

    for code, data in tenant_data.items():
        tdb = client[f"tenant_{code.lower()}"]
        await tdb.site_theme.update_one({"_id": "theme"}, {"$set": data["site_theme"]}, upsert=True)
        await tdb.site_cms.update_one({"_id": "cms"}, {"$set": data["site_cms"]}, upsert=True)
        for c in data["categories"]:
            await tdb.categories.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        for p in data["products"]:
            await tdb.products.update_one({"id": p["id"]}, {"$set": p}, upsert=True)
        for plan in data["sip_plans"]:
            await tdb.sip_plans.update_one({"id": plan["id"]}, {"$set": plan}, upsert=True)

    logger.info("Demo seed complete: %s tenants", len(tenants))

    # Seed owner admins with hashed passwords (idempotent — never rehash on rerun).
    demo_admins = [
        ("AURELIA", "owner", "Aurelia@123", "+919876543210"),
        ("NOIR", "owner", "Noir@123", "+919876543211"),
    ]
    for code, uname, pw, phone in demo_admins:
        await registry.tenant_admins.update_one(
            {"tenant_code": code, "username": uname},
            {
                "$setOnInsert": {
                    "tenant_code": code,
                    "username": uname,
                    "role": "owner",
                    "password_hash": hash_password(pw),
                    "created_at": _now_iso(),
                },
                "$set": {
                    "phone": phone,
                    "two_fa_enabled": False,
                },
                "$unset": {"totp_secret": "", "totp_pending_secret": ""},
            },
            upsert=True,
        )

    await apply_demo_razorpay_keys()


async def apply_demo_razorpay_keys():
    """If DEMO_RAZORPAY_* env set, upsert AURELIA Model B Test gateway (local only)."""
    key_id = (os.environ.get("DEMO_RAZORPAY_KEY_ID") or "").strip()
    key_secret = (os.environ.get("DEMO_RAZORPAY_KEY_SECRET") or "").strip()
    if not key_id or not key_secret:
        return
    webhook = (os.environ.get("DEMO_RAZORPAY_WEBHOOK_SECRET") or "").strip()
    tenant = await registry.tenants.find_one({"_id": "AURELIA"})
    if not tenant:
        return
    existing = (tenant.get("payment_gateway") or {}).copy()
    gw = {
        "provider": "razorpay",
        "key_id": key_id,
        "key_secret_enc": _encrypt_secret(key_secret),
        "enabled": True,
    }
    if webhook:
        gw["webhook_secret_enc"] = _encrypt_secret(webhook)
    elif existing.get("webhook_secret_enc"):
        gw["webhook_secret_enc"] = existing["webhook_secret_enc"]
    await registry.tenants.update_one({"_id": "AURELIA"}, {"$set": {"payment_gateway": gw}})
    logger.info("AURELIA payment_gateway seeded from DEMO_RAZORPAY_* (key_id=%s…)", key_id[:12])


@app.on_event("startup")
async def startup_event():
    try:
        await seed_demo()
    except Exception as e:  # never block boot on seed
        logger.exception("Seed failed: %s", e)
    try:
        await platform_routes.seed_platform_super_admin(registry, hash_password)
    except Exception as e:
        logger.exception("Platform admin seed failed: %s", e)
    # Load durable last-known rate, then start the background poller.
    try:
        saved = await registry.rates.find_one({"_id": "spot_latest"})
        if saved:
            _spot.update(saved)
        await refresh_spot()
    except Exception as e:
        logger.warning("Initial rate load failed: %s", e)
    app.state.poll_task = asyncio.create_task(_spot_poller())


@app.on_event("shutdown")
async def shutdown_db_client():
    task = getattr(app.state, "poll_task", None)
    if task:
        task.cancel()
    client.close()
