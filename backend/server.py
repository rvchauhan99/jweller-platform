"""
Multi-tenant luxury jeweler storefront — backend core (demo scope).

Architecture (locked by spec):
  - One MongoDB cluster, database-per-tenant.
  - Registry DB (platform_registry): tenants, tenant_sites, tenant_admins, theme_public_snapshots.
  - Per-tenant DB (tenant_{code}): categories, products, site_theme, site_cms.
  - Public tenancy resolved from the Host / X-Tenant-Host header — NEVER a client-supplied tenant_id.
"""
from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP

import httpx

from seed_data import build_seed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
registry = client[os.environ["REGISTRY_DB"]]

# Hostnames that must never resolve to a tenant storefront.
RESERVED_HOSTS = {
    "admin.luxejewel.app",
    "www.luxejewel.app",
    "luxejewel.app",
    "api.luxejewel.app",
    "localhost",
}

app = FastAPI(title="LuxeJewel Storefront API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _clean(doc: dict) -> dict:
    """Strip Mongo's _id so documents are JSON-serializable and leak-free."""
    if doc is None:
        return doc
    doc.pop("_id", None)
    return doc


def normalize_host(host: Optional[str]) -> str:
    if not host:
        return ""
    host = host.strip().lower()
    # drop scheme + port if present
    host = host.replace("https://", "").replace("http://", "")
    host = host.split("/")[0].split(":")[0]
    return host


async def resolve_public_tenant(request: Request):
    """Dependency: resolve the tenant strictly from the Host / X-Tenant-Host header."""
    host = normalize_host(request.headers.get("x-tenant-host") or request.headers.get("host"))
    if not host or host in RESERVED_HOSTS:
        raise HTTPException(status_code=404, detail="Unknown store")

    site = await registry.tenant_sites.find_one({"hostname": host})
    if not site:
        raise HTTPException(status_code=404, detail="Unknown store")

    tenant = await registry.tenants.find_one({"_id": site["tenant_id"]})
    if not tenant:
        raise HTTPException(status_code=404, detail="Unknown store")
    if tenant.get("status") != "active":
        raise HTTPException(status_code=503, detail="Store temporarily unavailable")

    tdb = client[tenant["mongo_db_name"]]
    return {"tenant_id": tenant["_id"], "tenant_code": tenant["tenant_code"], "db": tdb, "tenant": tenant}


# ---------------------------------------------------------------------------
# Public storefront endpoints
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"service": "LuxeJewel Storefront API", "status": "ok"}


@api_router.get("/public/bootstrap")
async def public_bootstrap(ctx: dict = Depends(resolve_public_tenant)):
    """Theme snapshot + business identity + homepage section order."""
    snapshot = await registry.theme_public_snapshots.find_one({"tenant_id": ctx["tenant_id"]})
    tenant = ctx["tenant"]
    payload = _clean(snapshot).get("payload", {}) if snapshot else {}
    return {
        "business_name": tenant["business_name"],
        "tenant_code": tenant["tenant_code"],
        "subdomain": tenant.get("subdomain"),
        "status": tenant.get("status"),
        "logo_url": payload.get("logo_url"),
        "tagline": payload.get("tagline"),
        "theme": payload.get("theme", {}),
        "homepage_sections": payload.get("homepage_sections", []),
    }


@api_router.get("/public/cms")
async def public_cms(ctx: dict = Depends(resolve_public_tenant)):
    cms = await ctx["db"].site_cms.find_one({"_id": "cms"})
    if not cms:
        return {}
    return _clean(cms)


@api_router.get("/public/categories")
async def public_categories(ctx: dict = Depends(resolve_public_tenant)):
    cats = await ctx["db"].categories.find({"active": True}).sort("sort_order", 1).to_list(100)
    return [_clean(c) for c in cats]


@api_router.get("/public/products")
async def public_products(
    ctx: dict = Depends(resolve_public_tenant),
    category: Optional[str] = Query(None, description="category slug"),
    featured: Optional[bool] = Query(None),
):
    """Listed-online products only. Optional category-slug filter."""
    q: dict = {"active": True, "listed_online": True}
    if category:
        cat = await ctx["db"].categories.find_one({"slug": category})
        if not cat:
            return []
        q["category_id"] = cat["id"]
    if featured:
        q["featured"] = True
    prods = await ctx["db"].products.find(q).sort("sort_order", 1).to_list(200)
    return [_enrich_product_price(_clean(p), ctx) for p in prods]


@api_router.get("/public/products/{product_id}")
async def public_product_detail(product_id: str, ctx: dict = Depends(resolve_public_tenant)):
    prod = await ctx["db"].products.find_one(
        {"id": product_id, "active": True, "listed_online": True}
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod = _clean(prod)
    cat = await ctx["db"].categories.find_one({"id": prod.get("category_id")})
    prod["category_name"] = cat["name"] if cat else None
    return _enrich_product_price(prod, ctx)


# ---------------------------------------------------------------------------
# Live gold/silver rate engine (keyless feeds, server-side margin, graceful stale)
# ---------------------------------------------------------------------------
GRAMS_PER_TROY_OZ = Decimal("31.1034768")
STALE_AFTER_SECONDS = 900  # 15 minutes
POLL_SECONDS = 300  # 5 minutes
METAL_URL = "https://api.gold-api.com/price/{}"
FX_URL = "https://api.frankfurter.dev/v2/rate/USD/INR"

# Fast in-memory copy; registry.rates holds the durable last-known snapshot.
_spot: dict = {}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _is_stale(fetched_at: Optional[str]) -> bool:
    if not fetched_at:
        return True
    try:
        dt = datetime.fromisoformat(fetched_at)
    except Exception:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).total_seconds() > STALE_AFTER_SECONDS


async def _fetch_json(client: httpx.AsyncClient, url: str):
    r = await client.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


async def refresh_spot():
    """Fetch metals + FX and commit only after a fully successful round."""
    try:
        async with httpx.AsyncClient(headers={"User-Agent": "luxejewel-rates/1.0"}) as c:
            xau, xag, fx = await asyncio.gather(
                _fetch_json(c, METAL_URL.format("XAU")),
                _fetch_json(c, METAL_URL.format("XAG")),
                _fetch_json(c, FX_URL),
            )
        xau_usd = Decimal(str(xau["price"]))
        xag_usd = Decimal(str(xag["price"]))
        usd_inr = Decimal(str(fx["rate"]))
        if xau_usd <= 0 or xag_usd <= 0 or usd_inr <= 0:
            raise ValueError("Non-positive value in feed")
        doc = {
            "_id": "spot_latest",
            "xau_usd_oz": str(xau_usd),
            "xag_usd_oz": str(xag_usd),
            "usd_inr": str(usd_inr),
            "fetched_at": _now_iso(),
            "fx_date": fx.get("date"),
        }
        _spot.clear()
        _spot.update(doc)
        await registry.rates.replace_one({"_id": "spot_latest"}, doc, upsert=True)
        logger.info("Spot refreshed: gold %s USD/oz, USD/INR %s", xau_usd, usd_inr)
    except Exception as e:
        logger.warning("Spot refresh failed, keeping last-known: %s", e)


async def _spot_poller():
    while True:
        await refresh_spot()
        await asyncio.sleep(POLL_SECONDS)


def _inr_per_gram(usd_oz: str, usd_inr: str, margin_pct: Decimal) -> float:
    base = Decimal(usd_oz) * Decimal(usd_inr) / GRAMS_PER_TROY_OZ
    val = base * (Decimal("1") + margin_pct / Decimal("100"))
    return float(val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _rates_payload(ctx: dict) -> dict:
    if not _spot:
        raise HTTPException(status_code=503, detail="Rate feed temporarily unavailable")
    margins = (ctx["tenant"].get("rate_margins") or {}) if ctx else {}
    gold_m = Decimal(str(margins.get("gold_pct", 0)))
    silver_m = Decimal(str(margins.get("silver_pct", 0)))
    fetched_at = _spot["fetched_at"]
    return {
        "gold": {
            "metal": "Gold",
            "inr_per_gram": _inr_per_gram(_spot["xau_usd_oz"], _spot["usd_inr"], gold_m),
            "margin_pct": float(gold_m),
        },
        "silver": {
            "metal": "Silver",
            "inr_per_gram": _inr_per_gram(_spot["xag_usd_oz"], _spot["usd_inr"], silver_m),
            "margin_pct": float(silver_m),
        },
        "usd_inr": float(Decimal(_spot["usd_inr"])),
        "fetched_at": fetched_at,
        "stale": _is_stale(fetched_at),
        "currency": "₹",
    }


@api_router.get("/public/rates")
async def public_rates(ctx: dict = Depends(resolve_public_tenant)):
    return _rates_payload(ctx)


# Gold purity -> fraction of pure (24K) metal.
PURITY_FACTORS = {
    "24K": 1.0,
    "23K": 0.958,
    "22K": 0.916,
    "20K": 0.833,
    "18K": 0.75,
    "14K": 0.585,
    "9K": 0.375,
}


def _enrich_product_price(prod: dict, ctx: dict) -> dict:
    """Compute a live piece price = weight × today's rate × purity + making charge."""
    try:
        rates = _rates_payload(ctx)
    except HTTPException:
        rates = None
    if not rates:
        prod["live_price"] = prod.get("price")
        prod["pricing"] = None
        return prod
    metal = prod.get("metal", "gold")
    rate = rates["silver" if metal == "silver" else "gold"]["inr_per_gram"]
    factor = PURITY_FACTORS.get(str(prod.get("purity", "")).upper(), 1.0)
    weight = float(prod.get("weight_grams", 0) or 0)
    metal_value = weight * rate * factor
    mc = float(prod.get("making_charge", 0) or 0)
    if prod.get("making_charge_type") == "percent":
        making = metal_value * mc / 100.0
    else:
        making = mc
    live = round(metal_value + making)
    prod["live_price"] = live
    prod["pricing"] = {
        "metal": metal,
        "rate_per_gram": rate,
        "purity": prod.get("purity"),
        "purity_factor": factor,
        "weight_grams": weight,
        "metal_value": round(metal_value),
        "making": round(making),
        "making_charge_type": prod.get("making_charge_type"),
        "live_price": live,
        "stale": rates["stale"],
        "fetched_at": rates["fetched_at"],
    }
    return prod


# ---------------------------------------------------------------------------
# SIP (gold savings plans) — guest, no auth, no payment gateway this pass
# ---------------------------------------------------------------------------
class SipEnrollIn(BaseModel):
    guest_id: str
    plan_id: str
    monthly_amount: Optional[float] = None
    name: str
    phone: str


def _gold_rate_now(ctx: dict) -> float:
    payload = _rates_payload(ctx)
    return payload["gold"]["inr_per_gram"]


def _rate_for_metal(ctx: dict, metal: str) -> float:
    payload = _rates_payload(ctx)
    return payload["silver" if metal == "silver" else "gold"]["inr_per_gram"]


@api_router.get("/public/sip/plans")
async def sip_plans(ctx: dict = Depends(resolve_public_tenant)):
    plans = await ctx["db"].sip_plans.find({}).to_list(50)
    return [_clean(p) for p in plans]


@api_router.post("/public/sip/enroll")
async def sip_enroll(body: SipEnrollIn, ctx: dict = Depends(resolve_public_tenant)):
    plan = await ctx["db"].sip_plans.find_one({"id": body.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    amount = float(body.monthly_amount or plan["monthly_amount"])
    if amount < float(plan.get("min_amount", 0)):
        raise HTTPException(status_code=400, detail="Amount below plan minimum")

    start = datetime.now(timezone.utc)
    installments = []
    for i in range(plan["tenure_months"]):
        due = start + timedelta(days=30 * i)
        installments.append(
            {
                "index": i + 1,
                "amount": amount,
                "due_date": due.isoformat(),
                "status": "due" if i == 0 else "upcoming",
                "paid_at": None,
                "rate_locked": None,
                "grams": None,
            }
        )

    enrollment = {
        "id": str(uuid.uuid4()),
        "guest_id": body.guest_id,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "metal": plan.get("metal", "gold"),
        "monthly_amount": amount,
        "tenure_months": plan["tenure_months"],
        "bonus_months": plan.get("bonus_months", 0),
        "member_name": body.name,
        "member_phone": body.phone,
        "status": "active",
        "installments": installments,
        "created_at": _now_iso(),
    }
    await ctx["db"].sip_enrollments.insert_one(enrollment)
    return _clean(enrollment)


def _enrich_enrollment(e: dict, ctx: dict) -> dict:
    e = _clean(e)
    metal = e.get("metal", "gold")
    current_rate = None
    try:
        current_rate = _rate_for_metal(ctx, metal)
    except HTTPException:
        current_rate = None
    total_paid = 0.0
    total_grams = 0.0
    paid_count = 0
    for inst in e["installments"]:
        if inst["status"] == "paid":
            total_paid += inst["amount"]
            total_grams += inst.get("grams") or 0
            paid_count += 1
    e["summary"] = {
        "paid_installments": paid_count,
        "total_installments": e["tenure_months"],
        "total_paid": round(total_paid, 2),
        "grams_accrued": round(total_grams, 4),
        "current_rate": current_rate,
        "current_value": round(total_grams * current_rate, 2) if current_rate else None,
    }
    return e


@api_router.get("/public/sip/enrollments")
async def sip_enrollments(guest_id: str = Query(...), ctx: dict = Depends(resolve_public_tenant)):
    rows = await ctx["db"].sip_enrollments.find({"guest_id": guest_id}).sort("created_at", -1).to_list(100)
    return [_enrich_enrollment(r, ctx) for r in rows]


class SipPayIn(BaseModel):
    guest_id: str


@api_router.post("/public/sip/enrollments/{enrollment_id}/pay")
async def sip_pay(enrollment_id: str, body: SipPayIn, ctx: dict = Depends(resolve_public_tenant)):
    e = await ctx["db"].sip_enrollments.find_one({"id": enrollment_id, "guest_id": body.guest_id})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    metal = e.get("metal", "gold")
    rate = _rate_for_metal(ctx, metal)
    # find next payable installment
    target = next((i for i in e["installments"] if i["status"] in ("due", "upcoming")), None)
    if not target:
        raise HTTPException(status_code=400, detail="All installments paid")
    grams = round(target["amount"] / rate, 4)
    target["status"] = "paid"
    target["paid_at"] = _now_iso()
    target["rate_locked"] = rate
    target["grams"] = grams
    # promote the following installment to 'due'
    for i in e["installments"]:
        if i["status"] == "upcoming":
            i["status"] = "due"
            break
    all_paid = all(i["status"] == "paid" for i in e["installments"])
    if all_paid:
        e["status"] = "matured"
    await ctx["db"].sip_enrollments.replace_one({"id": enrollment_id}, e)
    return _enrich_enrollment(e, ctx)


# ---------------------------------------------------------------------------
# Orders — guest cart reservation (no payment gateway this pass)
# ---------------------------------------------------------------------------
class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    qty: int = 1
    image: Optional[str] = None


class Contact(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None


class Address(BaseModel):
    line1: str
    city: str
    state: Optional[str] = None
    pincode: str


class OrderIn(BaseModel):
    guest_id: str
    items: List[OrderItem]
    contact: Contact
    address: Address
    note: Optional[str] = None


@api_router.post("/public/orders")
async def create_order(body: OrderIn, ctx: dict = Depends(resolve_public_tenant)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    subtotal = sum(i.price * i.qty for i in body.items)
    order = {
        "id": str(uuid.uuid4()),
        "order_no": "RSV-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid.uuid4().hex[:5].upper(),
        "guest_id": body.guest_id,
        "items": [i.model_dump() for i in body.items],
        "subtotal": round(subtotal, 2),
        "currency": "₹",
        "contact": body.contact.model_dump(),
        "address": body.address.model_dump(),
        "note": body.note,
        "status": "reserved",
        "created_at": _now_iso(),
    }
    await ctx["db"].orders.insert_one(order)
    return _clean(order)


@api_router.get("/public/orders")
async def list_orders(guest_id: str = Query(...), ctx: dict = Depends(resolve_public_tenant)):
    rows = await ctx["db"].orders.find({"guest_id": guest_id}).sort("created_at", -1).to_list(100)
    return [_clean(r) for r in rows]


# ---------------------------------------------------------------------------
# Jeweler ADMIN — tenant_code + username + password -> JWT (aud: admin)
# ---------------------------------------------------------------------------
import base64 as _b64
import hashlib as _hashlib
import jwt as _pyjwt
import bcrypt as _bcrypt
from fastapi import Header

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_AUD = "admin"
JWT_EXPIRE_MIN = 60 * 12


def _bcrypt_input(password: str) -> bytes:
    return _b64.b64encode(_hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(p: str) -> str:
    return _bcrypt.hashpw(_bcrypt_input(p), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return _bcrypt.checkpw(_bcrypt_input(p), h.encode())
    except Exception:
        return False


def _issue_token(admin: dict) -> str:
    now = datetime.now(timezone.utc)
    return _pyjwt.encode(
        {
            "tenant_id": admin["tenant_code"],
            "tenant_code": admin["tenant_code"],
            "role": admin.get("role", "owner"),
            "aud": JWT_AUD,
            "iat": now,
            "exp": now + timedelta(minutes=JWT_EXPIRE_MIN),
        },
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


async def get_admin_ctx(authorization: Optional[str] = Header(None)):
    err = HTTPException(status_code=401, detail="Invalid or expired session")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise err
    token = authorization.split(" ", 1)[1]
    try:
        claims = _pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
            audience=JWT_AUD,
            options={"require": ["exp", "iat", "aud", "tenant_id", "tenant_code", "role"]},
        )
    except Exception:
        raise err
    if claims.get("aud") != JWT_AUD:
        raise err
    tenant = await registry.tenants.find_one({"_id": claims["tenant_id"]})
    if not tenant or tenant.get("status") != "active" or tenant.get("tenant_code") != claims["tenant_code"]:
        raise err
    return {
        "tenant_id": tenant["_id"],
        "tenant_code": tenant["tenant_code"],
        "role": claims["role"],
        "db": client[tenant["mongo_db_name"]],
        "tenant": tenant,
    }


class AdminLoginIn(BaseModel):
    tenant_code: str
    username: str
    password: str


@api_router.post("/admin/auth/login")
async def admin_login(body: AdminLoginIn):
    admin = await registry.tenant_admins.find_one(
        {"tenant_code": body.tenant_code.strip().upper(), "username": body.username.strip()}
    )
    valid = verify_password(body.password, admin["password_hash"]) if admin and admin.get("password_hash") else False
    if not admin or not valid:
        raise HTTPException(status_code=401, detail="Invalid tenant code, username, or password")
    tenant = await registry.tenants.find_one({"_id": admin["tenant_code"]})
    return {
        "access_token": _issue_token(admin),
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MIN * 60,
        "business_name": tenant["business_name"] if tenant else admin["tenant_code"],
        "tenant_code": admin["tenant_code"],
        "role": admin.get("role", "owner"),
        "username": admin["username"],
    }


@api_router.get("/admin/me")
async def admin_me(ctx=Depends(get_admin_ctx)):
    t = ctx["tenant"]
    return {"tenant_code": ctx["tenant_code"], "business_name": t["business_name"], "role": ctx["role"], "status": t["status"]}


def _installment_is_due(inst: dict) -> bool:
    if inst.get("status") != "due":
        return False
    try:
        return datetime.fromisoformat(inst.get("due_date")) <= datetime.now(timezone.utc)
    except Exception:
        return True


@api_router.get("/admin/dashboard")
async def admin_dashboard(ctx=Depends(get_admin_ctx)):
    db = ctx["db"]
    products = await db.products.find({}).to_list(2000)
    low_stock = [p for p in products if (p.get("stock_qty", 0) or 0) <= 2]
    orders = await db.orders.find({}).sort("created_at", -1).to_list(2000)
    pending = [o for o in orders if o.get("status") in ("reserved", "confirmed", "packed")]
    enrollments = await db.sip_enrollments.find({}).to_list(2000)
    sip_active = [e for e in enrollments if e.get("status") == "active"]
    sip_due = 0
    for e in sip_active:
        inst = next((i for i in e.get("installments", []) if i.get("status") == "due"), None)
        if inst and _installment_is_due(inst):
            sip_due += 1
    try:
        rates = _rates_payload(ctx)
        rate = rates["gold"]
        rate_stale = rates["stale"]
    except Exception:
        rate, rate_stale = None, True
    return {
        "product_count": len(products),
        "listed_count": len([p for p in products if p.get("listed_online")]),
        "low_stock_count": len(low_stock),
        "low_stock": [{"id": p["id"], "name": p["name"], "stock_qty": p.get("stock_qty", 0)} for p in low_stock[:8]],
        "pending_orders": len(pending),
        "total_orders": len(orders),
        "reserved_value": round(sum(o.get("subtotal", 0) for o in orders), 2),
        "sip_active": len(sip_active),
        "sip_due": sip_due,
        "today_rate": rate,
        "rate_stale": rate_stale,
        "recent_orders": [_clean(o) for o in orders[:6]],
    }


class ProductIn(BaseModel):
    name: str
    category_id: str
    weight_grams: float = 0
    purity: str = "22K"
    making_charge: float = 0
    making_charge_type: str = "flat"
    price: float = 0
    stock_qty: int = 0
    active: bool = True
    listed_online: bool = True
    featured: bool = False
    images: List[str] = []
    description: str = ""
    sku: Optional[str] = None
    metal: str = "gold"


@api_router.get("/admin/products")
async def admin_products(ctx=Depends(get_admin_ctx)):
    rows = await ctx["db"].products.find({}).sort("sort_order", 1).to_list(2000)
    return [_enrich_product_price(_clean(r), ctx) for r in rows]


@api_router.post("/admin/products")
async def admin_create_product(body: ProductIn, ctx=Depends(get_admin_ctx)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["sku"] = doc.get("sku") or ("SKU-" + uuid.uuid4().hex[:6].upper())
    doc["kind"] = "jewellery"
    doc["currency"] = "₹"
    doc["sort_order"] = await ctx["db"].products.count_documents({})
    doc["created_at"] = _now_iso()
    await ctx["db"].products.insert_one(doc)
    return _clean(doc)


@api_router.put("/admin/products/{pid}")
async def admin_update_product(pid: str, body: ProductIn, ctx=Depends(get_admin_ctx)):
    res = await ctx["db"].products.update_one({"id": pid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return _clean(await ctx["db"].products.find_one({"id": pid}))


@api_router.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, ctx=Depends(get_admin_ctx)):
    await ctx["db"].products.delete_one({"id": pid})
    return {"ok": True}


class CategoryIn(BaseModel):
    name: str
    slug: str
    image: Optional[str] = None
    active: bool = True


@api_router.get("/admin/categories")
async def admin_categories(ctx=Depends(get_admin_ctx)):
    return [_clean(c) for c in await ctx["db"].categories.find({}).sort("sort_order", 1).to_list(200)]


@api_router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, ctx=Depends(get_admin_ctx)):
    doc = body.model_dump()
    doc["id"] = body.slug.strip().lower()
    doc["slug"] = doc["id"]
    doc["sort_order"] = await ctx["db"].categories.count_documents({})
    await ctx["db"].categories.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    return _clean(doc)


@api_router.put("/admin/categories/{cid}")
async def admin_update_category(cid: str, body: CategoryIn, ctx=Depends(get_admin_ctx)):
    await ctx["db"].categories.update_one({"id": cid}, {"$set": {"name": body.name, "image": body.image, "active": body.active}})
    return _clean(await ctx["db"].categories.find_one({"id": cid}))


@api_router.delete("/admin/categories/{cid}")
async def admin_delete_category(cid: str, ctx=Depends(get_admin_ctx)):
    await ctx["db"].categories.delete_one({"id": cid})
    return {"ok": True}


ORDER_FLOW = ["reserved", "confirmed", "packed", "shipped", "delivered", "cancelled"]


class StatusIn(BaseModel):
    status: str


@api_router.get("/admin/orders")
async def admin_orders(ctx=Depends(get_admin_ctx)):
    return [_clean(o) for o in await ctx["db"].orders.find({}).sort("created_at", -1).to_list(2000)]


@api_router.put("/admin/orders/{oid}/status")
async def admin_order_status(oid: str, body: StatusIn, ctx=Depends(get_admin_ctx)):
    if body.status not in ORDER_FLOW:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await ctx["db"].orders.update_one({"id": oid}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return _clean(await ctx["db"].orders.find_one({"id": oid}))


@api_router.get("/admin/sip/enrollments")
async def admin_sip_enrollments(ctx=Depends(get_admin_ctx)):
    rows = await ctx["db"].sip_enrollments.find({}).sort("created_at", -1).to_list(2000)
    out = []
    for r in rows:
        e = _enrich_enrollment(r, ctx)
        nxt = next((i for i in e["installments"] if i.get("status") == "due"), None)
        e["next_due_date"] = nxt.get("due_date") if nxt else None
        e["is_due_now"] = bool(nxt and _installment_is_due(nxt))
        out.append(e)
    return out


@api_router.get("/admin/theme")
async def admin_get_theme(ctx=Depends(get_admin_ctx)):
    t = await ctx["db"].site_theme.find_one({"_id": "theme"})
    return _clean(t) if t else {}


class ThemeIn(BaseModel):
    preset_id: Optional[str] = None
    mode: Optional[str] = None
    colors: dict
    fonts: dict


@api_router.put("/admin/theme")
async def admin_put_theme(body: ThemeIn, ctx=Depends(get_admin_ctx)):
    update = {"colors": body.colors, "fonts": body.fonts}
    if body.preset_id is not None:
        update["preset_id"] = body.preset_id
    if body.mode is not None:
        update["mode"] = body.mode
    await ctx["db"].site_theme.update_one({"_id": "theme"}, {"$set": update}, upsert=True)
    t = await ctx["db"].site_theme.find_one({"_id": "theme"})
    snap = await registry.theme_public_snapshots.find_one({"tenant_id": ctx["tenant_id"]})
    payload = (snap or {}).get("payload", {}) if snap else {}
    payload["theme"] = {
        "preset_id": t.get("preset_id"),
        "mode": t.get("mode"),
        "colors": t.get("colors"),
        "fonts": t.get("fonts"),
    }
    await registry.theme_public_snapshots.update_one(
        {"tenant_id": ctx["tenant_id"]}, {"$set": {"payload": payload, "updated_at": _now_iso()}}, upsert=True
    )
    return {"ok": True}


@api_router.get("/admin/cms")
async def admin_get_cms(ctx=Depends(get_admin_ctx)):
    c = await ctx["db"].site_cms.find_one({"_id": "cms"})
    return _clean(c) if c else {}


class CmsIn(BaseModel):
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_image: Optional[str] = None
    about_title: Optional[str] = None
    about_text: Optional[str] = None


@api_router.put("/admin/cms")
async def admin_put_cms(body: CmsIn, ctx=Depends(get_admin_ctx)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await ctx["db"].site_cms.update_one({"_id": "cms"}, {"$set": update}, upsert=True)
    return {"ok": True}


@api_router.get("/admin/settings")
async def admin_get_settings(ctx=Depends(get_admin_ctx)):
    t = ctx["tenant"]
    return {
        "business_name": t["business_name"],
        "tenant_code": t["tenant_code"],
        "subdomain": t.get("subdomain"),
        "rate_margins": t.get("rate_margins", {"gold_pct": 0, "silver_pct": 0}),
        "gstin": t.get("gstin"),
        "invoice_prefix": t.get("invoice_prefix"),
    }


class SettingsIn(BaseModel):
    business_name: Optional[str] = None
    gstin: Optional[str] = None
    invoice_prefix: Optional[str] = None
    rate_margins: Optional[dict] = None


@api_router.put("/admin/settings")
async def admin_put_settings(body: SettingsIn, ctx=Depends(get_admin_ctx)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await registry.tenants.update_one({"_id": ctx["tenant_id"]}, {"$set": update})
    return {"ok": True}






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
        await registry.tenants.update_one({"_id": t["_id"]}, {"$set": t}, upsert=True)
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
    demo_admins = [("AURELIA", "owner", "Aurelia@123"), ("NOIR", "owner", "Noir@123")]
    for code, uname, pw in demo_admins:
        await registry.tenant_admins.update_one(
            {"tenant_code": code, "username": uname},
            {"$setOnInsert": {
                "tenant_code": code,
                "username": uname,
                "role": "owner",
                "password_hash": hash_password(pw),
                "created_at": _now_iso(),
            }},
            upsert=True,
        )


@app.on_event("startup")
async def startup_event():
    try:
        await seed_demo()
    except Exception as e:  # never block boot on seed
        logger.exception("Seed failed: %s", e)
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
