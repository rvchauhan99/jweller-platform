"""Shared FastAPI dependencies, Mongo clients, auth, rates, and payment helpers."""
from __future__ import annotations

from fastapi import Request, HTTPException, Header
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
import calendar

import httpx
import base64 as _b64
import hashlib as _hashlib
import jwt as _pyjwt
import bcrypt as _bcrypt

import payments_razorpay as rzp

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
registry = client[os.environ["REGISTRY_DB"]]
JWT_SECRET = os.environ["JWT_SECRET"]
APP_ENV = os.environ.get("APP_ENV", "development")

# Hostnames that must never resolve to a tenant storefront.
RESERVED_HOSTS = {
    "admin.luxejewel.app",
    "www.luxejewel.app",
    "luxejewel.app",
    "api.luxejewel.app",
    "localhost",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("server")


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


async def _fetch_json(http_client: httpx.AsyncClient, url: str):
    r = await http_client.get(url, timeout=10)
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


def _base_inr_per_gram(usd_oz: str, usd_inr: str) -> Decimal:
    return (Decimal(usd_oz) * Decimal(usd_inr) / GRAMS_PER_TROY_OZ).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _margin_parts(margins: dict, metal: str) -> tuple[Decimal, Decimal]:
    """Return (percent, absolute ₹/g) for gold|silver. Absolute = local/city premium."""
    margins = margins or {}
    pct = Decimal(str(margins.get(f"{metal}_pct", 0) or 0))
    abs_inr = Decimal(str(margins.get(f"{metal}_inr_per_g", 0) or 0))
    return pct, abs_inr


def _sell_inr_per_gram(base: Decimal, margin_pct: Decimal, margin_inr: Decimal) -> float:
    """Sell = international base × (1 + %) + absolute ₹/g city premium."""
    val = base * (Decimal("1") + margin_pct / Decimal("100")) + margin_inr
    return float(val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _rates_payload(ctx: dict) -> dict:
    if not _spot:
        raise HTTPException(status_code=503, detail="Rate feed temporarily unavailable")
    tenant = (ctx.get("tenant") or {}) if ctx else {}
    margins = tenant.get("rate_margins") or {}
    gold_base = _base_inr_per_gram(_spot["xau_usd_oz"], _spot["usd_inr"])
    silver_base = _base_inr_per_gram(_spot["xag_usd_oz"], _spot["usd_inr"])
    gold_pct, gold_abs = _margin_parts(margins, "gold")
    silver_pct, silver_abs = _margin_parts(margins, "silver")
    fetched_at = _spot["fetched_at"]
    return {
        "gold": {
            "metal": "Gold",
            "inr_per_gram": _sell_inr_per_gram(gold_base, gold_pct, gold_abs),
            "base_inr_per_gram": float(gold_base),
            "margin_pct": float(gold_pct),
            "margin_inr_per_g": float(gold_abs),
        },
        "silver": {
            "metal": "Silver",
            "inr_per_gram": _sell_inr_per_gram(silver_base, silver_pct, silver_abs),
            "base_inr_per_gram": float(silver_base),
            "margin_pct": float(silver_pct),
            "margin_inr_per_g": float(silver_abs),
        },
        "usd_inr": float(Decimal(_spot["usd_inr"])),
        "rate_city": tenant.get("rate_city"),
        "rate_state": tenant.get("rate_state"),
        "fetched_at": fetched_at,
        "stale": _is_stale(fetched_at),
        "currency": "₹",
    }


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


def _gold_rate_now(ctx: dict) -> float:
    return _rates_payload(ctx)["gold"]["inr_per_gram"]


def _rate_for_metal(ctx: dict, metal: str) -> float:
    rates = _rates_payload(ctx)
    return rates["silver" if metal == "silver" else "gold"]["inr_per_gram"]


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


async def _savings_summary(db, customer_id: str, ctx: dict) -> dict:
    rates = _rates_payload(ctx)
    gold_rate = float(rates["gold"]["inr_per_gram"])
    silver_rate = float(rates["silver"]["inr_per_gram"])

    wallet = await db.metal_wallets.find_one({"customer_id": customer_id}) or {}
    wallet_gold = float(wallet.get("gold_grams") or 0)
    wallet_silver = float(wallet.get("silver_grams") or 0)

    sip_invested = 0.0
    sip_gold_g = 0.0
    sip_silver_g = 0.0
    enrollments = await db.sip_enrollments.find({"customer_id": customer_id}).to_list(100)
    for e in enrollments:
        enriched = _enrich_enrollment(e, ctx)
        summary = enriched.get("summary") or {}
        sip_invested += float(summary.get("total_paid") or 0)
        grams = float(summary.get("grams_accrued") or 0)
        if (e.get("metal") or "gold") == "silver":
            sip_silver_g += grams
        else:
            sip_gold_g += grams

    onetime_invested = 0.0
    purchases = await db.metal_purchases.find({"customer_id": customer_id, "status": "paid"}).to_list(500)
    for p in purchases:
        onetime_invested += float(p.get("amount_inr") or 0)

    total_invested = round(sip_invested + onetime_invested, 2)
    gold_g = round(wallet_gold + sip_gold_g, 4)
    silver_g = round(wallet_silver + sip_silver_g, 4)
    current_value = round(gold_g * gold_rate + silver_g * silver_rate, 2)
    gain = round(current_value - total_invested, 2)

    return {
        "total_invested": total_invested,
        "current_value": current_value,
        "gain": gain,
        "gold_grams": gold_g,
        "silver_grams": silver_g,
    }




async def _tenant_gateway(tenant: dict) -> dict:
    gw = tenant.get("payment_gateway") or {}
    key_id = (gw.get("key_id") or "").strip()
    secret = ""
    if gw.get("key_secret_enc"):
        try:
            secret = _decrypt_secret(gw["key_secret_enc"])
        except Exception:
            secret = ""
    webhook_secret = ""
    if gw.get("webhook_secret_enc"):
        try:
            webhook_secret = _decrypt_secret(gw["webhook_secret_enc"])
        except Exception:
            webhook_secret = ""

    if rzp.use_mock_razorpay():
        # Keep verify/create deterministic for pytest regardless of DEMO_RAZORPAY_* keys.
        return {
            "key_id": key_id or "rzp_test_mock",
            "key_secret": "mock_secret",
            "webhook_secret": "mock_webhook_secret",
            "enabled": True,
        }

    if not gw.get("enabled") or not key_id or not secret:
        raise HTTPException(
            status_code=400,
            detail="Payment gateway not configured. Owner: Admin → Settings → enable Razorpay Test keys.",
        )
    return {"key_id": key_id, "key_secret": secret, "webhook_secret": webhook_secret, "enabled": True}



def _sip_installment_due_dates(now: datetime, preferred_day: int, tenure_months: int) -> list:
    """Installment 1 = now (pay immediately). Later = calendar preferred_day (1–28)."""
    day = max(1, min(28, int(preferred_day)))
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    dates = [now]
    if tenure_months <= 1:
        return dates

    y, m = now.year, now.month
    if now.day < day:
        first = now.replace(day=min(day, calendar.monthrange(y, m)[1]), hour=0, minute=0, second=0, microsecond=0)
    else:
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
        first = datetime(y, m, min(day, calendar.monthrange(y, m)[1]), tzinfo=now.tzinfo)

    dates.append(first)
    cur = first
    for _ in range(tenure_months - 2):
        y, m = cur.year, cur.month
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
        d = min(day, calendar.monthrange(y, m)[1])
        cur = datetime(y, m, d, tzinfo=now.tzinfo)
        dates.append(cur)
    return dates


async def _apply_metal_purchase_paid(db, purchase_id: str, customer_id: str, gateway_payment_id: str):
    """Mark metal purchase paid and credit customer metal wallet grams."""
    p = await db.metal_purchases.find_one({"id": purchase_id, "customer_id": customer_id})
    if not p:
        return None
    if p.get("status") == "paid":
        return p
    rate = float(p.get("rate_locked") or 0)
    amount = float(p.get("amount_inr") or 0)
    if rate <= 0:
        raise HTTPException(status_code=400, detail="Missing rate lock on metal purchase")
    grams = round(amount / rate, 4)
    metal = p.get("metal", "gold")
    await db.metal_purchases.update_one(
        {"id": purchase_id},
        {
            "$set": {
                "status": "paid",
                "grams": grams,
                "gateway_payment_id": gateway_payment_id,
                "paid_at": _now_iso(),
            }
        },
    )
    field = "silver_grams" if metal == "silver" else "gold_grams"
    await db.metal_wallets.update_one(
        {"customer_id": customer_id},
        {
            "$inc": {field: grams},
            "$set": {"updated_at": _now_iso()},
            "$setOnInsert": {"id": str(uuid.uuid4()), "customer_id": customer_id, "created_at": _now_iso()},
        },
        upsert=True,
    )
    await db.payments.update_one(
        {"kind": "metal_purchase", "ref_id": purchase_id, "customer_id": customer_id},
        {"$set": {"status": "paid", "gateway_payment_id": gateway_payment_id, "paid_at": _now_iso()}},
    )
    return await db.metal_purchases.find_one({"id": purchase_id})


async def _start_razorpay_payment(
    cctx: dict,
    *,
    kind: str,
    amount_inr: float,
    ref_id: str,
    meta: Optional[dict] = None,
    rate_locked: Optional[float] = None,
):
    gw = await _tenant_gateway(cctx["tenant"])
    amount_paise = int(round(amount_inr * 100))
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Amount too small")
    rate_snap = rate_locked
    if rate_snap is None:
        try:
            rates = _rates_payload(cctx)
            rate_snap = rates["gold"]["inr_per_gram"]
        except Exception:
            rate_snap = None
    notes = {
        "tenant_id": cctx["tenant_id"],
        "kind": kind,
        "ref_id": ref_id,
        "customer_id": cctx["customer_id"],
        **(meta or {}),
    }
    client_rz = rzp.get_razorpay_client(gw["key_id"], gw["key_secret"])
    created = client_rz.create_order(
        amount_paise=amount_paise,
        currency="INR",
        receipt=ref_id[:40],
        notes=notes,
    )
    payment_doc = {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "ref_id": ref_id,
        "customer_id": cctx["customer_id"],
        "razorpay_order_id": created["id"],
        "amount": amount_inr,
        "amount_paise": amount_paise,
        "status": "created",
        "rate_locked": rate_snap,
        "rate_locked_at": _now_iso(),
        "notes": notes,
        "created_at": _now_iso(),
    }
    await cctx["db"].payments.insert_one(payment_doc)
    if kind == "order":
        await cctx["db"].orders.update_one(
            {"id": ref_id},
            {
                "$set": {
                    "razorpay_order_id": created["id"],
                    "rate_locked": rate_snap,
                    "rate_locked_at": payment_doc["rate_locked_at"],
                    "payment_status": "pending",
                }
            },
        )
    elif kind == "metal_purchase":
        await cctx["db"].metal_purchases.update_one(
            {"id": ref_id},
            {
                "$set": {
                    "razorpay_order_id": created["id"],
                    "rate_locked": rate_snap,
                    "rate_locked_at": payment_doc["rate_locked_at"],
                    "status": "pending",
                }
            },
        )
    return {
        "razorpay_order_id": created["id"],
        "key_id": gw["key_id"],
        "amount": amount_paise,
        "currency": "INR",
        "kind": kind,
        "ref_id": ref_id,
        "rate_locked": rate_snap,
        "rate_lock_ttl_sec": rzp.RATE_LOCK_TTL_SEC,
        "mock": rzp.use_mock_razorpay(),
    }



async def _charge_sip_mandate(db, e: dict, ctx: dict, *, actor: str):
    if e.get("mandate_status") != "active" or not e.get("razorpay_token_id") or not e.get("razorpay_customer_id"):
        raise HTTPException(status_code=400, detail="No active Autopay mandate — use one-time Checkout pay")
    target = next((i for i in e["installments"] if i["status"] in ("due", "upcoming")), None)
    if not target:
        raise HTTPException(status_code=400, detail="All installments paid")
    tenant = ctx["tenant"]
    gw = await _tenant_gateway(tenant)
    client_rz = rzp.get_razorpay_client(gw["key_id"], gw["key_secret"])
    amount_paise = int(round(float(target["amount"]) * 100))
    notes = {
        "tenant_id": ctx["tenant_id"],
        "kind": "sip_recurring",
        "ref_id": e["id"],
        "customer_id": e["customer_id"],
        "installment_index": target["index"],
        "actor": actor,
    }
    order = client_rz.create_order(
        amount_paise=amount_paise,
        currency="INR",
        receipt=e["id"][:40],
        notes=notes,
    )
    customer = await db.customers.find_one({"id": e["customer_id"]}) or {}
    phone = (e.get("member_phone") or customer.get("phone") or "9999999999")[-10:]
    rec = client_rz.create_recurring_payment(
        amount_paise=amount_paise,
        currency="INR",
        order_id=order["id"],
        customer_id=e["razorpay_customer_id"],
        token_id=e["razorpay_token_id"],
        email=customer.get("email") or "sip@example.com",
        contact="+91" + phone,
        notes=notes,
    )
    payment_id = rec.get("razorpay_payment_id") or rec.get("id")
    await db.payments.insert_one(
        {
            "id": str(uuid.uuid4()),
            "kind": "sip_recurring",
            "ref_id": e["id"],
            "customer_id": e["customer_id"],
            "razorpay_order_id": order["id"],
            "gateway_payment_id": payment_id,
            "amount": float(target["amount"]),
            "amount_paise": amount_paise,
            "status": "created" if not rzp.use_mock_razorpay() else "paid",
            "notes": notes,
            "created_at": _now_iso(),
            "paid_at": _now_iso() if rzp.use_mock_razorpay() else None,
        }
    )
    if rzp.use_mock_razorpay():
        return await _apply_sip_installment_paid(db, e["id"], e["customer_id"], ctx)
    return {
        "ok": True,
        "status": "processing",
        "razorpay_order_id": order["id"],
        "razorpay_payment_id": payment_id,
        "message": "Recurring debit initiated — webhook will mark installment paid",
    }



async def _apply_sip_installment_paid(db, enrollment_id: str, customer_id: str, ctx_for_rate: dict):
    e = await db.sip_enrollments.find_one({"id": enrollment_id, "customer_id": customer_id})
    if not e:
        return None
    metal = e.get("metal", "gold")
    rate = _rate_for_metal(ctx_for_rate, metal)
    target = next((i for i in e["installments"] if i["status"] in ("due", "upcoming")), None)
    if not target:
        return _enrich_enrollment(e, ctx_for_rate)
    grams = round(target["amount"] / rate, 4)
    target["status"] = "paid"
    target["paid_at"] = _now_iso()
    target["rate_locked"] = rate
    target["grams"] = grams
    for i in e["installments"]:
        if i["status"] == "upcoming":
            i["status"] = "due"
            break
    if all(i["status"] == "paid" for i in e["installments"]):
        e["status"] = "matured"
    await db.sip_enrollments.replace_one({"id": enrollment_id}, e)
    return _enrich_enrollment(e, ctx_for_rate)



async def _mark_order_paid(db, order: dict, gateway_payment_id: str, tenant: Optional[dict] = None):
    if order.get("payment_status") == "paid":
        return
    if rzp.rate_lock_expired(order.get("rate_locked_at")):
        raise HTTPException(status_code=400, detail="Rate lock expired")
    prefix = (tenant or {}).get("invoice_prefix") or "INV"
    invoice_no = order.get("invoice_no") or f"{prefix}-{order.get('order_no', order['id'])}"
    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "gateway_payment_id": gateway_payment_id,
                "paid_at": _now_iso(),
                "invoice_no": invoice_no,
            }
        },
    )
    await db.payments.update_one(
        {"razorpay_order_id": order.get("razorpay_order_id")},
        {"$set": {"status": "paid", "gateway_payment_id": gateway_payment_id, "paid_at": _now_iso()}},
    )



# ---------------------------------------------------------------------------
# Jeweler ADMIN — JWT helpers
# ---------------------------------------------------------------------------
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
            "username": admin.get("username"),
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
        "username": claims.get("username"),
        "db": client[tenant["mongo_db_name"]],
        "tenant": tenant,
    }


def _require_owner(ctx: dict):
    if ctx.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner role required")


def _encrypt_secret(plain: str) -> str:
    """Encrypt gateway secrets at rest (Fernet key derived from JWT_SECRET)."""
    from cryptography.fernet import Fernet
    import hashlib

    key = _b64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
    return Fernet(key).encrypt(plain.encode()).decode()


def _decrypt_secret(token: str) -> str:
    from cryptography.fernet import Fernet
    import hashlib

    key = _b64.urlsafe_b64encode(hashlib.sha256(JWT_SECRET.encode()).digest())
    return Fernet(key).decrypt(token.encode()).decode()


def _today_bounds():
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now


def _order_is_today(o: dict, start: datetime) -> bool:
    try:
        created = datetime.fromisoformat(o.get("created_at", ""))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created >= start
    except Exception:
        return False


def _installment_is_due(inst: dict) -> bool:
    if inst.get("status") != "due":
        return False
    try:
        return datetime.fromisoformat(inst.get("due_date")) <= datetime.now(timezone.utc)
    except Exception:
        return True


def _norm_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return digits
