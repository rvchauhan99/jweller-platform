"""Jeweler admin API routes (mounted under /api)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, Query, Response, UploadFile, File, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os

import payments_razorpay as rzp
import invoice_pdf as inv_pdf
import r2_storage as r2
import admin_auth_extras as aauth

from deps import (
    registry,
    client,
    JWT_EXPIRE_MIN,
    _clean,
    _now_iso,
    _rates_payload,
    _enrich_product_price,
    _enrich_enrollment,
    get_admin_ctx,
    _require_owner,
    hash_password,
    verify_password,
    _issue_token,
    _encrypt_secret,
    _decrypt_secret,
    _today_bounds,
    _order_is_today,
    _installment_is_due,
    _norm_phone,
    _tenant_gateway,
    _charge_sip_mandate,
)

router = APIRouter(tags=["admin"])

class AdminLoginIn(BaseModel):
    tenant_code: str
    username: str
    password: str
    totp: Optional[str] = None


def _login_success_payload(admin: dict, tenant: Optional[dict]) -> dict:
    return {
        "access_token": _issue_token(admin),
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MIN * 60,
        "business_name": tenant["business_name"] if tenant else admin["tenant_code"],
        "tenant_code": admin["tenant_code"],
        "role": admin.get("role", "owner"),
        "username": admin["username"],
        "two_fa_enabled": bool(admin.get("two_fa_enabled")),
    }


@router.post("/admin/auth/login")
async def admin_login(body: AdminLoginIn):
    admin = await registry.tenant_admins.find_one(
        {"tenant_code": body.tenant_code.strip().upper(), "username": body.username.strip()}
    )
    valid = verify_password(body.password, admin["password_hash"]) if admin and admin.get("password_hash") else False
    if not admin or not valid:
        raise HTTPException(status_code=401, detail="Invalid tenant code, username, or password")
    if admin.get("active") is False:
        raise HTTPException(status_code=403, detail="Account deactivated")
    tenant = await registry.tenants.find_one({"_id": admin["tenant_code"]})

    if admin.get("two_fa_enabled"):
        enc = admin.get("totp_secret")
        if not enc:
            raise HTTPException(status_code=403, detail="Authenticator not enrolled. Contact an owner.")
        if not body.totp:
            return {"two_fa_required": True}
        try:
            secret = aauth.decrypt_totp_secret(enc)
        except Exception:
            raise HTTPException(status_code=403, detail="Authenticator not enrolled. Contact an owner.")
        if not aauth.verify_totp(secret, body.totp):
            raise HTTPException(status_code=401, detail="Invalid authenticator code")

    return _login_success_payload(admin, tenant)


class ForgotRequestIn(BaseModel):
    tenant_code: str
    username: str


class ForgotConfirmIn(BaseModel):
    tenant_code: str
    username: str
    code: str
    new_password: str


@router.post("/admin/auth/forgot/request")
async def admin_forgot_request(body: ForgotRequestIn, request: Request):
    """Always return a generic success message (no user oracle)."""
    generic = {"ok": True, "message": "If an account exists with a phone on file, an OTP was sent."}
    code = body.tenant_code.strip().upper()
    username = body.username.strip()
    admin = await registry.tenant_admins.find_one({"tenant_code": code, "username": username})
    if not admin or admin.get("active") is False or not admin.get("phone"):
        return generic
    tenant = await registry.tenants.find_one({"_id": code})
    client_ip = request.client.host if request.client else "unknown"
    try:
        out = aauth.store_and_send_admin_reset_otp(
            tenant_code=code,
            username=username,
            phone_e164=admin["phone"],
            business_name=(tenant or {}).get("business_name") or code,
            client_ip=client_ip,
        )
        return out
    except HTTPException as e:
        if e.status_code == 429:
            raise
        return generic


@router.post("/admin/auth/forgot/confirm")
async def admin_forgot_confirm(body: ForgotConfirmIn):
    aauth.validate_admin_password(body.new_password)
    code = body.tenant_code.strip().upper()
    username = body.username.strip()
    admin = await registry.tenant_admins.find_one({"tenant_code": code, "username": username})
    if not admin or admin.get("active") is False:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    aauth.verify_admin_reset_otp(tenant_code=code, username=username, code=body.code)
    await registry.tenant_admins.update_one(
        {"tenant_code": code, "username": username},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": _now_iso()}},
    )
    return {"ok": True, "message": "Password updated. Sign in with your new password."}


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/admin/auth/change-password")
async def admin_change_password(body: ChangePasswordIn, ctx=Depends(get_admin_ctx)):
    aauth.validate_admin_password(body.new_password)
    username = ctx.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid session")
    admin = await registry.tenant_admins.find_one(
        {"tenant_code": ctx["tenant_code"], "username": username}
    )
    if not admin or not verify_password(body.current_password, admin.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await registry.tenant_admins.update_one(
        {"tenant_code": ctx["tenant_code"], "username": username},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": _now_iso()}},
    )
    return {"ok": True}


@router.post("/admin/auth/2fa/generate")
async def admin_2fa_generate(ctx=Depends(get_admin_ctx)):
    username = ctx.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid session")
    secret = aauth.new_totp_secret()
    await registry.tenant_admins.update_one(
        {"tenant_code": ctx["tenant_code"], "username": username},
        {
            "$set": {
                "totp_pending_secret": aauth.encrypt_totp_secret(secret),
                "updated_at": _now_iso(),
            }
        },
    )
    uri = aauth.totp_uri(secret=secret, username=username, tenant_code=ctx["tenant_code"])
    return {
        "otpauth_url": uri,
        "secret": secret,
        "qr_png_data_url": aauth.qr_png_data_url(uri),
    }


class TotpIn(BaseModel):
    totp: str


@router.post("/admin/auth/2fa/enable")
async def admin_2fa_enable(body: TotpIn, ctx=Depends(get_admin_ctx)):
    username = ctx.get("username")
    admin = await registry.tenant_admins.find_one(
        {"tenant_code": ctx["tenant_code"], "username": username}
    )
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    pending = admin.get("totp_pending_secret")
    if not pending:
        raise HTTPException(status_code=400, detail="Generate authenticator setup first")
    try:
        secret = aauth.decrypt_totp_secret(pending)
    except Exception:
        raise HTTPException(status_code=400, detail="Generate authenticator setup first")
    if not aauth.verify_totp(secret, body.totp):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    await registry.tenant_admins.update_one(
        {"tenant_code": ctx["tenant_code"], "username": username},
        {
            "$set": {
                "two_fa_enabled": True,
                "totp_secret": pending,
                "updated_at": _now_iso(),
            },
            "$unset": {"totp_pending_secret": ""},
        },
    )
    return {"ok": True, "two_fa_enabled": True}


@router.post("/admin/auth/2fa/disable")
async def admin_2fa_disable(body: TotpIn, ctx=Depends(get_admin_ctx)):
    username = ctx.get("username")
    admin = await registry.tenant_admins.find_one(
        {"tenant_code": ctx["tenant_code"], "username": username}
    )
    if not admin or not admin.get("two_fa_enabled"):
        return {"ok": True, "two_fa_enabled": False}
    enc = admin.get("totp_secret")
    if not enc:
        await registry.tenant_admins.update_one(
            {"tenant_code": ctx["tenant_code"], "username": username},
            {
                "$set": {"two_fa_enabled": False, "updated_at": _now_iso()},
                "$unset": {"totp_secret": "", "totp_pending_secret": ""},
            },
        )
        return {"ok": True, "two_fa_enabled": False}
    try:
        secret = aauth.decrypt_totp_secret(enc)
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot verify authenticator")
    if not aauth.verify_totp(secret, body.totp):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    await registry.tenant_admins.update_one(
        {"tenant_code": ctx["tenant_code"], "username": username},
        {
            "$set": {"two_fa_enabled": False, "updated_at": _now_iso()},
            "$unset": {"totp_secret": "", "totp_pending_secret": ""},
        },
    )
    return {"ok": True, "two_fa_enabled": False}


@router.get("/admin/me")
async def admin_me(ctx=Depends(get_admin_ctx)):
    t = ctx["tenant"]
    username = ctx.get("username")
    admin = None
    if username:
        admin = await registry.tenant_admins.find_one(
            {"tenant_code": ctx["tenant_code"], "username": username}
        )
    return {
        "tenant_code": ctx["tenant_code"],
        "business_name": t["business_name"],
        "role": ctx["role"],
        "status": t["status"],
        "username": username,
        "two_fa_enabled": bool((admin or {}).get("two_fa_enabled")),
        "phone_masked": aauth.mask_phone((admin or {}).get("phone")),
    }


def _installment_is_due(inst: dict) -> bool:
    if inst.get("status") != "due":
        return False
    try:
        return datetime.fromisoformat(inst.get("due_date")) <= datetime.now(timezone.utc)
    except Exception:
        return True


@router.get("/admin/dashboard")
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
    start, _ = _today_bounds()
    today_orders = [o for o in orders if _order_is_today(o, start)]
    sales_online = round(
        sum(o.get("subtotal", 0) for o in today_orders if o.get("channel", "online") != "offline"), 2
    )
    sales_offline = round(
        sum(o.get("subtotal", 0) for o in today_orders if o.get("channel") == "offline"), 2
    )
    last_paid = next((o for o in orders if o.get("payment_status") == "paid"), None)
    gw = (ctx["tenant"].get("payment_gateway") or {})
    key_id = (gw.get("key_id") or "").strip()
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
        "sales_today": {
            "online": sales_online,
            "offline": sales_offline,
            "total": round(sales_online + sales_offline, 2),
            "order_count": len(today_orders),
        },
        "payment_health": {
            "gateway_enabled": bool(gw.get("enabled") and key_id),
            "provider": gw.get("provider") or "razorpay",
            "key_id_masked": (key_id[:8] + "…" + key_id[-4:]) if len(key_id) > 12 else (key_id or None),
            "mock_razorpay": rzp.use_mock_razorpay(),
            "last_paid_order_id": last_paid.get("id") if last_paid else None,
            "last_paid_order_no": last_paid.get("order_no") if last_paid else None,
            "last_paid_at": last_paid.get("paid_at") if last_paid else None,
        },
    }


@router.post("/admin/uploads")
async def admin_upload_product_image(
    file: UploadFile = File(...),
    ctx=Depends(get_admin_ctx),
):
    """Multipart upload → Cloudflare R2 (or MOCK_R2). Field name: file."""
    if not r2.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Object storage is not configured. Set BUCKET_* env or MOCK_R2=1.",
        )
    data = await file.read()
    try:
        meta = r2.upload_product_image(
            tenant_code=ctx["tenant"].get("tenant_code") or ctx["tenant_id"],
            data=data,
            content_type=file.content_type or "application/octet-stream",
            filename=file.filename or "image.jpg",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return meta


@router.get("/admin/storage/status")
async def admin_storage_status(ctx=Depends(get_admin_ctx)):
    return {
        "configured": r2.is_configured(),
        "mock": r2.use_mock_r2(),
        "public_base": (os.environ.get("BUCKET_PUBLIC_BASE_URL") or "").strip() or None,
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


@router.get("/admin/products")
async def admin_products(ctx=Depends(get_admin_ctx)):
    rows = await ctx["db"].products.find({}).sort("sort_order", 1).to_list(2000)
    return [_enrich_product_price(_clean(r), ctx) for r in rows]


@router.post("/admin/products")
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


@router.put("/admin/products/{pid}")
async def admin_update_product(pid: str, body: ProductIn, ctx=Depends(get_admin_ctx)):
    res = await ctx["db"].products.update_one({"id": pid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return _clean(await ctx["db"].products.find_one({"id": pid}))


@router.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, ctx=Depends(get_admin_ctx)):
    await ctx["db"].products.delete_one({"id": pid})
    return {"ok": True}


class CategoryIn(BaseModel):
    name: str
    slug: str
    image: Optional[str] = None
    active: bool = True


@router.get("/admin/categories")
async def admin_categories(ctx=Depends(get_admin_ctx)):
    return [_clean(c) for c in await ctx["db"].categories.find({}).sort("sort_order", 1).to_list(200)]


@router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, ctx=Depends(get_admin_ctx)):
    doc = body.model_dump()
    doc["id"] = body.slug.strip().lower()
    doc["slug"] = doc["id"]
    doc["sort_order"] = await ctx["db"].categories.count_documents({})
    await ctx["db"].categories.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    return _clean(doc)


@router.put("/admin/categories/{cid}")
async def admin_update_category(cid: str, body: CategoryIn, ctx=Depends(get_admin_ctx)):
    await ctx["db"].categories.update_one({"id": cid}, {"$set": {"name": body.name, "image": body.image, "active": body.active}})
    return _clean(await ctx["db"].categories.find_one({"id": cid}))


@router.delete("/admin/categories/{cid}")
async def admin_delete_category(cid: str, ctx=Depends(get_admin_ctx)):
    await ctx["db"].categories.delete_one({"id": cid})
    return {"ok": True}


ORDER_FLOW = ["reserved", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"]
RETURN_FROM = {"shipped", "delivered"}
FORWARD_FLOW = ["reserved", "confirmed", "packed", "shipped", "delivered"]


class StatusIn(BaseModel):
    status: str
    reason: Optional[str] = None


@router.get("/admin/orders")
async def admin_orders(ctx=Depends(get_admin_ctx)):
    return [_clean(o) for o in await ctx["db"].orders.find({}).sort("created_at", -1).to_list(2000)]


async def _restock_order_items(db, order: dict) -> None:
    for it in order.get("items") or []:
        pid = it.get("product_id")
        if not pid:
            continue
        qty = int(it.get("qty") or 0)
        if qty <= 0:
            continue
        await db.products.update_one({"id": str(pid)}, {"$inc": {"stock_qty": qty}})


@router.put("/admin/orders/{oid}/status")
async def admin_order_status(oid: str, body: StatusIn, ctx=Depends(get_admin_ctx)):
    if body.status not in ORDER_FLOW:
        raise HTTPException(status_code=400, detail="Invalid status")
    o = await ctx["db"].orders.find_one({"id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    current = o.get("status") or "reserved"
    if current in ("cancelled", "returned") and body.status != current:
        raise HTTPException(status_code=400, detail=f"Cannot change status from {current}")

    update: dict = {"status": body.status}

    if body.status == "returned":
        if current == "returned":
            return _clean(o)
        if current not in RETURN_FROM:
            raise HTTPException(
                status_code=400,
                detail="Return allowed only from shipped or delivered",
            )
        update["returned_at"] = _now_iso()
        if body.reason is not None:
            update["return_reason"] = str(body.reason).strip()[:500]
        if not o.get("return_restocked"):
            await _restock_order_items(ctx["db"], o)
            update["return_restocked"] = True
    elif body.status == "cancelled":
        if current == "delivered":
            raise HTTPException(status_code=400, detail="Cannot cancel a delivered order; use return")
    else:
        # Forward pipeline: allow jumping forward or staying; block returning to earlier steps
        if current in FORWARD_FLOW and body.status in FORWARD_FLOW:
            if FORWARD_FLOW.index(body.status) < FORWARD_FLOW.index(current):
                raise HTTPException(status_code=400, detail="Cannot move order backward")

    await ctx["db"].orders.update_one({"id": oid}, {"$set": update})
    return _clean(await ctx["db"].orders.find_one({"id": oid}))


@router.get("/admin/orders/{oid}/invoice")
async def admin_order_invoice(oid: str, ctx=Depends(get_admin_ctx)):
    o = await ctx["db"].orders.find_one({"id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Invoice available after payment")
    ids = [it.get("product_id") for it in (o.get("items") or [])]
    products = {}
    if ids:
        rows = await ctx["db"].products.find({"id": {"$in": [str(x) for x in ids if x]}}).to_list(len(ids))
        products = {str(r.get("id")): r for r in rows}
    pdf = inv_pdf.build_tax_invoice_pdf(tenant=ctx["tenant"], order=o, products_by_id=products)
    filename = f"{o.get('invoice_no') or o.get('order_no') or oid}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/sip/enrollments")
async def admin_sip_enrollments(
    ctx=Depends(get_admin_ctx),
    due: Optional[str] = Query(None, description="due|overdue|all"),
):
    rows = await ctx["db"].sip_enrollments.find({}).sort("created_at", -1).to_list(2000)
    out = []
    for r in rows:
        e = _enrich_enrollment(r, ctx)
        nxt = next((i for i in e["installments"] if i.get("status") == "due"), None)
        e["next_due_date"] = nxt.get("due_date") if nxt else None
        e["is_due_now"] = bool(nxt and _installment_is_due(nxt))
        e["customer_id"] = r.get("customer_id")
        out.append(e)
    mode = (due or "all").lower()
    if mode == "due":
        out = [e for e in out if e.get("is_due_now")]
    elif mode == "overdue":
        now = datetime.now(timezone.utc)
        filtered = []
        for e in out:
            if not e.get("is_due_now") or not e.get("next_due_date"):
                continue
            try:
                dd = datetime.fromisoformat(e["next_due_date"].replace("Z", "+00:00"))
                if dd.tzinfo is None:
                    dd = dd.replace(tzinfo=timezone.utc)
                if dd < now:
                    filtered.append(e)
            except Exception:
                filtered.append(e)
        out = filtered
    return out


@router.post("/admin/sip/enrollments/{eid}/mandate/pause")
async def admin_sip_mandate_pause(eid: str, ctx=Depends(get_admin_ctx)):
    e = await ctx["db"].sip_enrollments.find_one({"id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.get("mandate_status") != "active":
        raise HTTPException(status_code=400, detail="Mandate not active")
    # Razorpay has limited pause API; mark locally (token remains; charges blocked)
    await ctx["db"].sip_enrollments.update_one({"id": eid}, {"$set": {"mandate_status": "paused"}})
    return _enrich_enrollment(await ctx["db"].sip_enrollments.find_one({"id": eid}), ctx)


@router.post("/admin/sip/enrollments/{eid}/mandate/resume")
async def admin_sip_mandate_resume(eid: str, ctx=Depends(get_admin_ctx)):
    e = await ctx["db"].sip_enrollments.find_one({"id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.get("mandate_status") != "paused" or not e.get("razorpay_token_id"):
        raise HTTPException(status_code=400, detail="Mandate not paused")
    await ctx["db"].sip_enrollments.update_one({"id": eid}, {"$set": {"mandate_status": "active"}})
    return _enrich_enrollment(await ctx["db"].sip_enrollments.find_one({"id": eid}), ctx)


@router.post("/admin/sip/enrollments/{eid}/mandate/cancel")
async def admin_sip_mandate_cancel(eid: str, ctx=Depends(get_admin_ctx)):
    e = await ctx["db"].sip_enrollments.find_one({"id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    token_id = e.get("razorpay_token_id")
    if token_id:
        try:
            gw = await _tenant_gateway(ctx["tenant"])
            rzp.get_razorpay_client(gw["key_id"], gw["key_secret"]).cancel_token(token_id)
        except Exception:
            pass
    await ctx["db"].sip_enrollments.update_one(
        {"id": eid}, {"$set": {"mandate_status": "cancelled", "mandate_cancelled_at": _now_iso()}}
    )
    return _enrich_enrollment(await ctx["db"].sip_enrollments.find_one({"id": eid}), ctx)


@router.post("/admin/sip/enrollments/{eid}/mandate/charge")
async def admin_sip_mandate_charge(eid: str, ctx=Depends(get_admin_ctx)):
    e = await ctx["db"].sip_enrollments.find_one({"id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    admin_ctx = {**ctx, "tenant_id": ctx["tenant_id"]}
    return await _charge_sip_mandate(ctx["db"], e, admin_ctx, actor="admin")


@router.get("/admin/theme")
async def admin_get_theme(ctx=Depends(get_admin_ctx)):
    t = await ctx["db"].site_theme.find_one({"_id": "theme"})
    return _clean(t) if t else {}


class ThemeIn(BaseModel):
    preset_id: Optional[str] = None
    mode: Optional[str] = None
    colors: dict
    fonts: dict


@router.put("/admin/theme")
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


@router.get("/admin/cms")
async def admin_get_cms(ctx=Depends(get_admin_ctx)):
    c = await ctx["db"].site_cms.find_one({"_id": "cms"})
    return _clean(c) if c else {}


class CmsIn(BaseModel):
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_image: Optional[str] = None
    about_title: Optional[str] = None
    about_text: Optional[str] = None


@router.put("/admin/cms")
async def admin_put_cms(body: CmsIn, ctx=Depends(get_admin_ctx)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await ctx["db"].site_cms.update_one({"_id": "cms"}, {"$set": update}, upsert=True)
    return {"ok": True}


@router.get("/admin/settings")
async def admin_get_settings(ctx=Depends(get_admin_ctx)):
    t = ctx["tenant"]
    try:
        rates_preview = _rates_payload(ctx)
    except Exception:
        rates_preview = None
    return {
        "business_name": t["business_name"],
        "tenant_code": t["tenant_code"],
        "subdomain": t.get("subdomain"),
        "rate_margins": t.get(
            "rate_margins",
            {
                "gold_pct": 0,
                "silver_pct": 0,
                "gold_inr_per_g": 0,
                "silver_inr_per_g": 0,
            },
        ),
        "rate_city": t.get("rate_city"),
        "rate_state": t.get("rate_state"),
        "rates_preview": rates_preview,
        "gstin": t.get("gstin"),
        "invoice_prefix": t.get("invoice_prefix"),
    }


class SettingsIn(BaseModel):
    business_name: Optional[str] = None
    gstin: Optional[str] = None
    invoice_prefix: Optional[str] = None
    rate_margins: Optional[dict] = None
    rate_city: Optional[str] = None
    rate_state: Optional[str] = None


@router.put("/admin/settings")
async def admin_put_settings(body: SettingsIn, ctx=Depends(get_admin_ctx)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await registry.tenants.update_one({"_id": ctx["tenant_id"]}, {"$set": update})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Phase B — customers, SIP plans, staff, gateway keys
# ---------------------------------------------------------------------------
def _norm_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return digits


async def _build_customer_map(db) -> dict:
    """Union of customers collection + order contacts + SIP members, keyed by phone."""
    by_phone: dict = {}

    def upsert(phone: str, name: str = "", email: str = "", guest_id: str = "", source: str = ""):
        key = _norm_phone(phone)
        if not key:
            return
        row = by_phone.get(key) or {
            "id": key,
            "phone": key,
            "name": "",
            "email": "",
            "guest_ids": [],
            "order_count": 0,
            "sip_count": 0,
            "sources": set(),
        }
        if name and (not row["name"] or len(name) > len(row.get("name") or "")):
            row["name"] = name
        if email:
            row["email"] = email
        if guest_id and guest_id not in row["guest_ids"]:
            row["guest_ids"].append(guest_id)
        if source:
            row["sources"].add(source)
        by_phone[key] = row

    for c in await db.customers.find({}).to_list(5000):
        upsert(c.get("phone"), c.get("name", ""), c.get("email", ""), c.get("guest_id", ""), "crm")
        key = _norm_phone(c.get("phone"))
        if key and by_phone.get(key):
            by_phone[key]["id"] = c.get("id") or key
            by_phone[key]["created_at"] = c.get("created_at")

    for o in await db.orders.find({}).to_list(5000):
        contact = o.get("contact") or {}
        upsert(contact.get("phone"), contact.get("name", ""), contact.get("email", ""), o.get("guest_id", ""), "order")
        key = _norm_phone(contact.get("phone"))
        if key and by_phone.get(key):
            by_phone[key]["order_count"] += 1

    for e in await db.sip_enrollments.find({}).to_list(5000):
        upsert(e.get("member_phone"), e.get("member_name", ""), "", e.get("guest_id", ""), "sip")
        key = _norm_phone(e.get("member_phone"))
        if key and by_phone.get(key):
            by_phone[key]["sip_count"] += 1

    return by_phone


@router.get("/admin/customers")
async def admin_customers(q: Optional[str] = Query(None), ctx=Depends(get_admin_ctx)):
    by_phone = await _build_customer_map(ctx["db"])
    rows = []
    for row in by_phone.values():
        rows.append(
            {
                "id": row["id"],
                "phone": row["phone"],
                "name": row.get("name") or "—",
                "email": row.get("email") or None,
                "order_count": row.get("order_count", 0),
                "sip_count": row.get("sip_count", 0),
                "guest_ids": row.get("guest_ids", []),
                "sources": sorted(list(row.get("sources") or [])),
            }
        )
    rows.sort(key=lambda r: (r["name"] or "").lower())
    if q:
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in (r.get("name") or "").lower()
            or needle in (r.get("phone") or "")
            or needle in (r.get("email") or "").lower()
        ]
    return rows


@router.get("/admin/customers/{cid}")
async def admin_customer_detail(cid: str, ctx=Depends(get_admin_ctx)):
    by_phone = await _build_customer_map(ctx["db"])
    row = by_phone.get(_norm_phone(cid))
    if not row:
        for r in by_phone.values():
            if r.get("id") == cid:
                row = r
                break
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    phone = row["phone"]
    guest_ids = set(row.get("guest_ids") or [])
    orders = []
    for o in await ctx["db"].orders.find({}).sort("created_at", -1).to_list(2000):
        cphone = _norm_phone((o.get("contact") or {}).get("phone"))
        if cphone == phone or o.get("guest_id") in guest_ids:
            orders.append(_clean(o))
    enrollments = []
    for e in await ctx["db"].sip_enrollments.find({}).sort("created_at", -1).to_list(2000):
        if _norm_phone(e.get("member_phone")) == phone or e.get("guest_id") in guest_ids:
            enrollments.append(_enrich_enrollment(e, ctx))
    return {
        "id": row["id"],
        "phone": phone,
        "name": row.get("name") or "—",
        "email": row.get("email"),
        "order_count": len(orders),
        "sip_count": len(enrollments),
        "orders": orders[:50],
        "sip_enrollments": enrollments[:50],
    }


class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None


@router.post("/admin/customers")
async def admin_create_customer(body: CustomerIn, ctx=Depends(get_admin_ctx)):
    phone = _norm_phone(body.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Valid 10-digit phone required")
    existing = await ctx["db"].customers.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=409, detail="Customer already exists")
    doc = {
        "id": phone,
        "name": body.name.strip(),
        "phone": phone,
        "email": body.email,
        "created_at": _now_iso(),
    }
    await ctx["db"].customers.insert_one(doc)
    return _clean(doc)


class SipPlanIn(BaseModel):
    name: str
    tagline: Optional[str] = ""
    monthly_amount: float
    tenure_months: int
    bonus_months: int = 0
    metal: str = "gold"
    benefit_text: Optional[str] = ""
    min_amount: float = 0
    rate_mode: str = "live"
    active: bool = True


@router.get("/admin/sip/plans")
async def admin_sip_plans(ctx=Depends(get_admin_ctx)):
    return [_clean(p) for p in await ctx["db"].sip_plans.find({}).to_list(200)]


@router.post("/admin/sip/plans")
async def admin_create_sip_plan(body: SipPlanIn, ctx=Depends(get_admin_ctx)):
    doc = body.model_dump()
    doc["id"] = "sip-" + uuid.uuid4().hex[:8]
    doc["created_at"] = _now_iso()
    await ctx["db"].sip_plans.insert_one(doc)
    return _clean(doc)


@router.put("/admin/sip/plans/{pid}")
async def admin_update_sip_plan(pid: str, body: SipPlanIn, ctx=Depends(get_admin_ctx)):
    res = await ctx["db"].sip_plans.update_one({"id": pid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _clean(await ctx["db"].sip_plans.find_one({"id": pid}))


@router.delete("/admin/sip/plans/{pid}")
async def admin_delete_sip_plan(pid: str, ctx=Depends(get_admin_ctx)):
    await ctx["db"].sip_plans.delete_one({"id": pid})
    return {"ok": True}


class StaffIn(BaseModel):
    username: str
    password: Optional[str] = None
    role: str = "staff"
    active: bool = True
    phone: Optional[str] = None


def _staff_public(row: dict) -> dict:
    return {
        "username": row["username"],
        "role": row.get("role", "staff"),
        "active": row.get("active", True),
        "created_at": row.get("created_at"),
        "phone_masked": aauth.mask_phone(row.get("phone")),
        "phone": row.get("phone"),
        "two_fa_enabled": bool(row.get("two_fa_enabled")),
    }


@router.get("/admin/staff")
async def admin_staff_list(ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    rows = await registry.tenant_admins.find({"tenant_code": ctx["tenant_code"]}).to_list(200)
    return [_staff_public(r) for r in rows]


@router.post("/admin/staff")
async def admin_create_staff(body: StaffIn, ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    aauth.validate_admin_password(body.password)
    if body.role not in ("owner", "staff", "manager"):
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = await registry.tenant_admins.find_one({"tenant_code": ctx["tenant_code"], "username": username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    phone = aauth.normalize_staff_phone(body.phone)
    doc = {
        "tenant_code": ctx["tenant_code"],
        "username": username,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "active": True,
        "two_fa_enabled": False,
        "created_at": _now_iso(),
    }
    if phone:
        doc["phone"] = phone
    await registry.tenant_admins.insert_one(doc)
    return _staff_public(doc)


@router.put("/admin/staff/{username}")
async def admin_update_staff(username: str, body: StaffIn, ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    update: dict = {"role": body.role, "active": body.active}
    if body.password:
        aauth.validate_admin_password(body.password)
        update["password_hash"] = hash_password(body.password)
    if body.phone is not None:
        phone = aauth.normalize_staff_phone(body.phone) if body.phone.strip() else None
        if phone:
            update["phone"] = phone
        else:
            update["phone"] = None
    res = await registry.tenant_admins.update_one(
        {"tenant_code": ctx["tenant_code"], "username": username}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    if "phone" in update and update["phone"] is None:
        await registry.tenant_admins.update_one(
            {"tenant_code": ctx["tenant_code"], "username": username},
            {"$unset": {"phone": ""}},
        )
    row = await registry.tenant_admins.find_one({"tenant_code": ctx["tenant_code"], "username": username})
    return _staff_public(row)


@router.delete("/admin/staff/{username}")
async def admin_delete_staff(username: str, ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    if username == ctx.get("username"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    await registry.tenant_admins.delete_one({"tenant_code": ctx["tenant_code"], "username": username})
    return {"ok": True}


class GatewayIn(BaseModel):
    provider: str = "razorpay"
    key_id: Optional[str] = None
    key_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    enabled: bool = False


@router.get("/admin/gateway")
async def admin_get_gateway(ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    t = ctx["tenant"]
    gw = t.get("payment_gateway") or {}
    return {
        "provider": gw.get("provider", "razorpay"),
        "key_id": gw.get("key_id"),
        "key_secret_set": bool(gw.get("key_secret_enc")),
        "webhook_secret_set": bool(gw.get("webhook_secret_enc")),
        "enabled": bool(gw.get("enabled")),
    }


@router.put("/admin/gateway")
async def admin_put_gateway(body: GatewayIn, ctx=Depends(get_admin_ctx)):
    _require_owner(ctx)
    existing = (ctx["tenant"].get("payment_gateway") or {}).copy()
    gw = {
        "provider": body.provider,
        "key_id": body.key_id if body.key_id is not None else existing.get("key_id"),
        "enabled": body.enabled,
        "updated_at": _now_iso(),
    }
    if body.key_secret:
        gw["key_secret_enc"] = _encrypt_secret(body.key_secret)
    elif existing.get("key_secret_enc"):
        gw["key_secret_enc"] = existing["key_secret_enc"]
    if body.webhook_secret:
        gw["webhook_secret_enc"] = _encrypt_secret(body.webhook_secret)
    elif existing.get("webhook_secret_enc"):
        gw["webhook_secret_enc"] = existing["webhook_secret_enc"]
    await registry.tenants.update_one({"_id": ctx["tenant_id"]}, {"$set": {"payment_gateway": gw}})
    return {
        "provider": gw["provider"],
        "key_id": gw.get("key_id"),
        "key_secret_set": bool(gw.get("key_secret_enc")),
        "webhook_secret_set": bool(gw.get("webhook_secret_enc")),
        "enabled": gw["enabled"],
    }


# ---------------------------------------------------------------------------
# Phase C — POS, purchases / WAC, reports
# ---------------------------------------------------------------------------
class PosItemIn(BaseModel):
    product_id: str
    qty: int = 1
    weight_grams: Optional[float] = None
    unit_price: Optional[float] = None


class PosSaleIn(BaseModel):
    items: List[PosItemIn]
    tender: str = "cash"
    contact_name: Optional[str] = "Walk-in"
    contact_phone: Optional[str] = None
    note: Optional[str] = None
    lock_rate: bool = True


@router.post("/admin/pos/sale")
async def admin_pos_sale(body: PosSaleIn, ctx=Depends(get_admin_ctx)):
    if not body.items:
        raise HTTPException(status_code=400, detail="No items")
    if body.tender not in ("cash", "upi", "card"):
        raise HTTPException(status_code=400, detail="Invalid tender")
    db = ctx["db"]
    line_items = []
    subtotal = 0.0
    rate_snapshot = None
    try:
        rates = _rates_payload(ctx)
        rate_snapshot = rates["gold"]["inr_per_gram"]
    except Exception:
        rate_snapshot = None

    for it in body.items:
        prod = await db.products.find_one({"id": it.product_id})
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        qty = max(1, it.qty)
        stock = prod.get("stock_qty", 0) or 0
        if stock < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {prod.get('name')}")
        enriched = _enrich_product_price(_clean(dict(prod)), ctx)
        weight = it.weight_grams if it.weight_grams is not None else enriched.get("weight_grams", 0)
        unit = it.unit_price
        if unit is None:
            unit = enriched.get("live_price") or enriched.get("price") or 0
        line_total = round(float(unit) * qty, 2)
        subtotal += line_total
        line_items.append(
            {
                "product_id": prod["id"],
                "name": prod["name"],
                "price": float(unit),
                "qty": qty,
                "weight_grams": weight,
                "image": (prod.get("images") or [None])[0],
            }
        )
        await db.products.update_one({"id": prod["id"]}, {"$inc": {"stock_qty": -qty}})

    phone = _norm_phone(body.contact_phone) if body.contact_phone else None
    if phone and body.contact_name:
        await db.customers.update_one(
            {"phone": phone},
            {
                "$set": {"name": body.contact_name, "phone": phone, "updated_at": _now_iso()},
                "$setOnInsert": {"id": phone, "created_at": _now_iso()},
            },
            upsert=True,
        )

    order_id = str(uuid.uuid4())
    order_no = "POS-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid.uuid4().hex[:5].upper()
    prefix = (ctx["tenant"].get("invoice_prefix") or ctx["tenant"].get("code") or "INV")[:8]
    order = {
        "id": order_id,
        "order_no": order_no,
        "channel": "offline",
        "tender": body.tender,
        "guest_id": None,
        "items": line_items,
        "subtotal": round(subtotal, 2),
        "currency": "₹",
        "contact": {"name": body.contact_name or "Walk-in", "phone": phone or "", "email": None},
        "address": {"line1": "In-store", "city": "", "state": None, "pincode": ""},
        "note": body.note,
        "status": "delivered",
        "payment_status": "paid",
        "paid_at": _now_iso(),
        "invoice_no": f"{prefix}-{order_no}",
        "rate_locked": rate_snapshot if body.lock_rate else None,
        "created_at": _now_iso(),
    }
    await db.orders.insert_one(order)
    return _clean(order)


class PurchaseIn(BaseModel):
    product_id: str
    qty: int
    unit_cost: float
    supplier: Optional[str] = None
    note: Optional[str] = None


@router.get("/admin/purchases")
async def admin_purchases(ctx=Depends(get_admin_ctx)):
    rows = await ctx["db"].purchases.find({}).sort("created_at", -1).to_list(500)
    return [_clean(r) for r in rows]


@router.post("/admin/purchases")
async def admin_create_purchase(body: PurchaseIn, ctx=Depends(get_admin_ctx)):
    if body.qty < 1 or body.unit_cost < 0:
        raise HTTPException(status_code=400, detail="Invalid qty or cost")
    prod = await ctx["db"].products.find_one({"id": body.product_id})
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    old_qty = prod.get("stock_qty", 0) or 0
    old_cost = prod.get("avg_cost", prod.get("price", 0)) or 0
    new_qty = old_qty + body.qty
    if new_qty > 0:
        avg_cost = round(((old_qty * old_cost) + (body.qty * body.unit_cost)) / new_qty, 2)
    else:
        avg_cost = body.unit_cost
    doc = {
        "id": str(uuid.uuid4()),
        "product_id": body.product_id,
        "product_name": prod.get("name"),
        "qty": body.qty,
        "unit_cost": body.unit_cost,
        "total_cost": round(body.qty * body.unit_cost, 2),
        "supplier": body.supplier,
        "note": body.note,
        "avg_cost_after": avg_cost,
        "created_at": _now_iso(),
    }
    await ctx["db"].purchases.insert_one(doc)
    await ctx["db"].products.update_one(
        {"id": body.product_id}, {"$set": {"stock_qty": new_qty, "avg_cost": avg_cost}}
    )
    return _clean(doc)


@router.get("/admin/reports/sales")
async def admin_report_sales(ctx=Depends(get_admin_ctx)):
    orders = await ctx["db"].orders.find({}).sort("created_at", -1).to_list(5000)
    rows = []
    for o in orders:
        rows.append(
            {
                "date": o.get("created_at"),
                "order_no": o.get("order_no"),
                "channel": o.get("channel", "online"),
                "status": o.get("status"),
                "tender": o.get("tender"),
                "customer": (o.get("contact") or {}).get("name"),
                "phone": (o.get("contact") or {}).get("phone"),
                "items": len(o.get("items") or []),
                "subtotal": o.get("subtotal", 0),
            }
        )
    return {"rows": rows, "total": round(sum(r["subtotal"] or 0 for r in rows), 2)}


@router.get("/admin/reports/stock")
async def admin_report_stock(ctx=Depends(get_admin_ctx)):
    products = await ctx["db"].products.find({}).to_list(5000)
    rows = []
    for p in products:
        qty = p.get("stock_qty", 0) or 0
        cost = p.get("avg_cost", p.get("price", 0)) or 0
        rows.append(
            {
                "sku": p.get("sku"),
                "name": p.get("name"),
                "stock_qty": qty,
                "avg_cost": cost,
                "stock_value": round(qty * cost, 2),
                "listed_online": bool(p.get("listed_online")),
            }
        )
    return {"rows": rows, "total_value": round(sum(r["stock_value"] for r in rows), 2)}


@router.get("/admin/reports/sip-liability")
async def admin_report_sip(ctx=Depends(get_admin_ctx)):
    enrollments = await ctx["db"].sip_enrollments.find({}).to_list(5000)
    rows = []
    for e in enrollments:
        enriched = _enrich_enrollment(e, ctx)
        rows.append(
            {
                "member_name": enriched.get("member_name"),
                "member_phone": enriched.get("member_phone"),
                "plan_name": enriched.get("plan_name"),
                "status": enriched.get("status"),
                "grams_accrued": enriched.get("summary", {}).get("grams_accrued", 0),
                "total_paid": enriched.get("summary", {}).get("total_paid", 0),
                "current_value": enriched.get("summary", {}).get("current_value"),
            }
        )
    return {
        "rows": rows,
        "total_grams": round(sum(r["grams_accrued"] or 0 for r in rows), 4),
        "total_liability": round(sum(r["current_value"] or 0 for r in rows), 2),
    }
