"""Public storefront + customer auth API routes (mounted under /api)."""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Depends, Query, Header, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os

import customer_auth as cust_auth
import payments_razorpay as rzp
import invoice_pdf as inv_pdf
import r2_storage as r2

from deps import (
    JWT_SECRET,
    registry,
    client,
    _clean,
    normalize_host,
    resolve_public_tenant,
    _now_iso,
    _rates_payload,
    _enrich_product_price,
    _enrich_enrollment,
    _start_razorpay_payment,
    _charge_sip_mandate,
    _apply_sip_installment_paid,
    _apply_metal_purchase_paid,
    _sip_installment_due_dates,
    _mark_order_paid,
    _tenant_gateway,
    _rate_for_metal,
)

router = APIRouter(tags=["public"])

@router.get("/")
async def root():
    return {"service": "LuxeJewel Storefront API", "status": "ok"}


@router.get("/public/bootstrap")
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


@router.get("/public/cms")
async def public_cms(ctx: dict = Depends(resolve_public_tenant)):
    cms = await ctx["db"].site_cms.find_one({"_id": "cms"})
    if not cms:
        return {}
    return _clean(cms)


@router.get("/public/categories")
async def public_categories(ctx: dict = Depends(resolve_public_tenant)):
    cats = await ctx["db"].categories.find({"active": True}).sort("sort_order", 1).to_list(100)
    return [_clean(c) for c in cats]


@router.get("/public/products")
async def public_products(
    ctx: dict = Depends(resolve_public_tenant),
    category: Optional[str] = Query(None, description="category slug"),
    featured: Optional[bool] = Query(None),
    q: Optional[str] = Query(None, description="search name/sku/description"),
    purity: Optional[str] = Query(None, description="e.g. 22K, 18K"),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    sort: Optional[str] = Query(None, description="price_asc|price_desc"),
):
    """Listed-online products. Optional category, search, purity, price band, sort."""
    filt: dict = {"active": True, "listed_online": True}
    if category:
        cat = await ctx["db"].categories.find_one({"slug": category})
        if not cat:
            return []
        filt["category_id"] = cat["id"]
    if featured:
        filt["featured"] = True
    if purity:
        filt["purity"] = purity.strip()
    if q and q.strip():
        term = q.strip()
        filt["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"sku": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
        ]
    prods = await ctx["db"].products.find(filt).sort("sort_order", 1).to_list(200)
    enriched = [_enrich_product_price(_clean(p), ctx) for p in prods]
    if min_price is not None:
        enriched = [p for p in enriched if (p.get("live_price") or p.get("price") or 0) >= min_price]
    if max_price is not None:
        enriched = [p for p in enriched if (p.get("live_price") or p.get("price") or 0) <= max_price]
    if sort == "price_asc":
        enriched.sort(key=lambda p: p.get("live_price") or p.get("price") or 0)
    elif sort == "price_desc":
        enriched.sort(key=lambda p: p.get("live_price") or p.get("price") or 0, reverse=True)
    return enriched


@router.get("/public/products/{product_id}")
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


@router.get("/public/media/{object_path:path}")
async def public_media(object_path: str):
    """Serve mock R2 objects locally (MOCK_R2=1). Real R2 uses BUCKET_PUBLIC_BASE_URL."""
    path = r2.mock_file_path(object_path)
    if not path:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


@router.get("/public/rates")
async def public_rates(ctx: dict = Depends(resolve_public_tenant)):
    return _rates_payload(ctx)

class OtpRequestIn(BaseModel):
    phone: str


class OtpVerifyIn(BaseModel):
    phone: str
    code: str


class CustomerProfileIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


async def get_customer_ctx(
    request: Request,
    authorization: Optional[str] = Header(None),
    ctx: dict = Depends(resolve_public_tenant),
):
    token = cust_auth.bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Customer login required")
    claims = cust_auth.decode_customer_token(token, JWT_SECRET)
    if claims.get("tenant_id") != ctx["tenant_id"]:
        raise HTTPException(status_code=401, detail="Token not valid for this store")
    customer = await ctx["db"].customers.find_one({"id": claims["sub"]})
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return {**ctx, "customer": _clean(customer), "customer_id": customer["id"]}


@router.post("/public/auth/otp/request")
async def otp_request(body: OtpRequestIn, request: Request, ctx: dict = Depends(resolve_public_tenant)):
    phone = cust_auth.normalize_in_phone(body.phone)
    ip = request.client.host if request.client else "unknown"
    return await cust_auth.store_and_send_otp(
        tenant_id=ctx["tenant_id"],
        phone_e164=phone,
        business_name=ctx["tenant"]["business_name"],
        client_ip=ip,
    )


@router.post("/public/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn, request: Request, ctx: dict = Depends(resolve_public_tenant)):
    phone = cust_auth.normalize_in_phone(body.phone)
    cust_auth.verify_otp_code(tenant_id=ctx["tenant_id"], phone_e164=phone, code=body.code)
    local = cust_auth.phone_local(phone)
    customer = await ctx["db"].customers.find_one({"phone": local})
    if not customer:
        customer = {
            "id": str(uuid.uuid4()),
            "phone": local,
            "phone_e164": phone,
            "name": "",
            "email": None,
            "created_at": _now_iso(),
        }
        await ctx["db"].customers.insert_one(customer)
    host = normalize_host(request.headers.get("x-tenant-host") or request.headers.get("host"))
    token = cust_auth.issue_customer_token(
        customer_id=customer["id"],
        tenant_id=ctx["tenant_id"],
        site_hostname=host,
        jwt_secret=JWT_SECRET,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": {
            "id": customer["id"],
            "phone": customer.get("phone"),
            "name": customer.get("name") or "",
            "email": customer.get("email"),
        },
    }


@router.get("/public/me")
async def public_me(cctx=Depends(get_customer_ctx)):
    c = cctx["customer"]
    return {"id": c["id"], "phone": c.get("phone"), "name": c.get("name") or "", "email": c.get("email")}


@router.patch("/public/me")
async def public_me_patch(body: CustomerProfileIn, cctx=Depends(get_customer_ctx)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "email" in update and update["email"]:
        other = await cctx["db"].customers.find_one(
            {"email": update["email"].strip().lower(), "id": {"$ne": cctx["customer_id"]}}
        )
        if other:
            raise HTTPException(status_code=409, detail="Email already used at this store")
        update["email"] = update["email"].strip().lower()
    if update:
        await cctx["db"].customers.update_one({"id": cctx["customer_id"]}, {"$set": update})
    c = await cctx["db"].customers.find_one({"id": cctx["customer_id"]})
    return {"id": c["id"], "phone": c.get("phone"), "name": c.get("name") or "", "email": c.get("email")}


# ---------------------------------------------------------------------------
# SIP (gold savings plans) — customer JWT required for enroll/pay
# ---------------------------------------------------------------------------
class SipEnrollIn(BaseModel):
    plan_id: str
    monthly_amount: Optional[float] = None
    name: str
    phone: Optional[str] = None
    preferred_day: int = Field(default=1, ge=1, le=28)


def _gold_rate_now(ctx: dict) -> float:
    payload = _rates_payload(ctx)
    return payload["gold"]["inr_per_gram"]


@router.get("/public/sip/plans")
async def sip_plans(ctx: dict = Depends(resolve_public_tenant)):
    plans = await ctx["db"].sip_plans.find({}).to_list(50)
    return [_clean(p) for p in plans]


@router.post("/public/sip/enroll")
async def sip_enroll(body: SipEnrollIn, cctx=Depends(get_customer_ctx)):
    plan = await cctx["db"].sip_plans.find_one({"id": body.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    amount = float(body.monthly_amount or plan["monthly_amount"])
    if amount < float(plan.get("min_amount", 0)):
        raise HTTPException(status_code=400, detail="Amount below plan minimum")

    preferred_day = int(body.preferred_day)
    start = datetime.now(timezone.utc)
    due_dates = _sip_installment_due_dates(start, preferred_day, int(plan["tenure_months"]))
    installments = []
    for i, due in enumerate(due_dates):
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

    customer = cctx["customer"]
    phone = body.phone or customer.get("phone") or ""
    enrollment = {
        "id": str(uuid.uuid4()),
        "customer_id": cctx["customer_id"],
        "guest_id": None,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "metal": plan.get("metal", "gold"),
        "monthly_amount": amount,
        "tenure_months": plan["tenure_months"],
        "bonus_months": plan.get("bonus_months", 0),
        "preferred_day": preferred_day,
        "member_name": body.name,
        "member_phone": phone,
        "status": "active",
        "installments": installments,
        "created_at": _now_iso(),
        "mandate_status": "none",
        "razorpay_customer_id": None,
        "razorpay_token_id": None,
        "razorpay_mandate_order_id": None,
    }
    await cctx["db"].sip_enrollments.insert_one(enrollment)
    if body.name and not customer.get("name"):
        await cctx["db"].customers.update_one({"id": cctx["customer_id"]}, {"$set": {"name": body.name}})
    return _clean(enrollment)


@router.get("/public/sip/enrollments")
async def sip_enrollments(cctx=Depends(get_customer_ctx)):
    rows = await cctx["db"].sip_enrollments.find({"customer_id": cctx["customer_id"]}).sort("created_at", -1).to_list(100)
    return [_enrich_enrollment(r, cctx) for r in rows]


@router.get("/public/sip/mine")
async def sip_mine(cctx=Depends(get_customer_ctx)):
    rows = await cctx["db"].sip_enrollments.find({"customer_id": cctx["customer_id"]}).sort("created_at", -1).to_list(100)
    return [_enrich_enrollment(r, cctx) for r in rows]


class SipPayIn(BaseModel):
    pass


class PayConfirmIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/public/sip/enrollments/{enrollment_id}/pay")
async def sip_pay(enrollment_id: str, cctx=Depends(get_customer_ctx)):
    """Create Razorpay order for next due installment (manual Checkout fallback)."""
    e = await cctx["db"].sip_enrollments.find_one({"id": enrollment_id, "customer_id": cctx["customer_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    target = next((i for i in e["installments"] if i["status"] in ("due", "upcoming")), None)
    if not target:
        raise HTTPException(status_code=400, detail="All installments paid")
    return await _start_razorpay_payment(
        cctx,
        kind="sip_installment",
        amount_inr=float(target["amount"]),
        ref_id=enrollment_id,
        meta={"installment_index": target["index"]},
    )


@router.post("/public/sip/enrollments/{enrollment_id}/mandate/setup")
async def sip_mandate_setup(enrollment_id: str, cctx=Depends(get_customer_ctx)):
    """Start UPI Autopay mandate registration (auth order for Checkout)."""
    e = await cctx["db"].sip_enrollments.find_one({"id": enrollment_id, "customer_id": cctx["customer_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.get("mandate_status") == "active" and e.get("razorpay_token_id"):
        raise HTTPException(status_code=400, detail="Mandate already active")
    gw = await _tenant_gateway(cctx["tenant"])
    client_rz = rzp.get_razorpay_client(gw["key_id"], gw["key_secret"])
    customer = cctx["customer"]
    phone = (e.get("member_phone") or customer.get("phone") or "").replace("+91", "")[-10:]
    if len(phone) != 10:
        raise HTTPException(status_code=400, detail="Valid phone required for Autopay")
    rz_cust_id = e.get("razorpay_customer_id")
    try:
        if not rz_cust_id:
            created_cust = client_rz.create_customer(
                name=e.get("member_name") or customer.get("name") or "SIP Member",
                contact="+91" + phone,
                email=(customer.get("email") or "") or "",
                notes={"tenant_id": cctx["tenant_id"], "customer_id": cctx["customer_id"]},
            )
            rz_cust_id = created_cust["id"]
        amount_paise = int(round(float(e["monthly_amount"]) * 100))
        max_paise = max(amount_paise, int(round(float(e["monthly_amount"]) * 1.5 * 100)))
        notes = {
            "tenant_id": cctx["tenant_id"],
            "kind": "sip_mandate_auth",
            "ref_id": enrollment_id,
            "customer_id": cctx["customer_id"],
        }
        order = client_rz.create_mandate_order(
            amount_paise=amount_paise,
            currency="INR",
            customer_id=rz_cust_id,
            max_amount_paise=max_paise,
            frequency="monthly",
            expire_at=rzp.mandate_expire_unix(max(int(e.get("tenure_months") or 12) + 6, 12)),
            receipt=enrollment_id[:40],
            notes=notes,
        )
    except Exception as exc:
        # Razorpay Test accounts often lack UPI Autopay — surface as 400; Checkout installment remains fallback
        detail = "Autopay mandate unavailable — use Pay installment Checkout"
        try:
            import httpx

            if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
                body = exc.response.json()
                err = (body.get("error") or {}) if isinstance(body, dict) else {}
                detail = err.get("description") or err.get("reason") or detail
        except Exception:
            detail = str(exc)[:200] or detail
        raise HTTPException(status_code=400, detail=detail) from exc
    await cctx["db"].sip_enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "mandate_status": "pending",
                "razorpay_customer_id": rz_cust_id,
                "razorpay_mandate_order_id": order["id"],
            }
        },
    )
    await cctx["db"].payments.insert_one(
        {
            "id": str(uuid.uuid4()),
            "kind": "sip_mandate_auth",
            "ref_id": enrollment_id,
            "customer_id": cctx["customer_id"],
            "razorpay_order_id": order["id"],
            "amount": float(e["monthly_amount"]),
            "amount_paise": amount_paise,
            "status": "created",
            "notes": notes,
            "created_at": _now_iso(),
        }
    )
    return {
        "key_id": gw["key_id"],
        "razorpay_order_id": order["id"],
        "razorpay_customer_id": rz_cust_id,
        "amount": amount_paise,
        "currency": "INR",
        "mock": rzp.use_mock_razorpay(),
        "mandate_status": "pending",
    }


@router.post("/public/sip/enrollments/{enrollment_id}/mandate/confirm")
async def sip_mandate_confirm(enrollment_id: str, body: PayConfirmIn, cctx=Depends(get_customer_ctx)):
    """Confirm mandate auth Checkout; store token; mark first installment paid if due."""
    e = await cctx["db"].sip_enrollments.find_one({"id": enrollment_id, "customer_id": cctx["customer_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    gw = await _tenant_gateway(cctx["tenant"])
    if not rzp.use_mock_razorpay():
        if not rzp.verify_payment_signature(
            razorpay_order_id=body.razorpay_order_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
            key_secret=gw["key_secret"],
        ):
            raise HTTPException(status_code=400, detail="Invalid payment signature")
    client_rz = rzp.get_razorpay_client(gw["key_id"], gw["key_secret"])
    pay_entity = client_rz.fetch_payment(body.razorpay_payment_id)
    token_id = pay_entity.get("token_id") or pay_entity.get("token") or ("token_mock_" + body.razorpay_payment_id[-10:])
    await cctx["db"].sip_enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "mandate_status": "active",
                "razorpay_token_id": token_id,
                "mandate_authorized_at": _now_iso(),
            }
        },
    )
    await cctx["db"].payments.update_one(
        {"razorpay_order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "gateway_payment_id": body.razorpay_payment_id, "paid_at": _now_iso()}},
    )
    # Auth payment amount = first installment → mark paid
    result = await _apply_sip_installment_paid(cctx["db"], enrollment_id, cctx["customer_id"], cctx)
    return result or _enrich_enrollment(
        await cctx["db"].sip_enrollments.find_one({"id": enrollment_id}), cctx
    )


@router.post("/public/sip/enrollments/{enrollment_id}/mandate/dev-confirm")
async def sip_mandate_dev_confirm(enrollment_id: str, cctx=Depends(get_customer_ctx)):
    """Mock-only: activate mandate without Checkout."""
    if not rzp.allow_dev_confirm() or not rzp.use_mock_razorpay():
        raise HTTPException(status_code=404, detail="Not found")
    setup = await sip_mandate_setup(enrollment_id, cctx)
    body = PayConfirmIn(
        razorpay_order_id=setup["razorpay_order_id"],
        razorpay_payment_id="pay_mandate_dev_" + uuid.uuid4().hex[:8],
        razorpay_signature="dev",
    )
    return await sip_mandate_confirm(enrollment_id, body, cctx)


@router.post("/public/sip/enrollments/{enrollment_id}/mandate/charge")
async def sip_mandate_charge(enrollment_id: str, cctx=Depends(get_customer_ctx)):
    """Charge next due installment via active UPI Autopay token (fallback: use /pay Checkout)."""
    e = await cctx["db"].sip_enrollments.find_one({"id": enrollment_id, "customer_id": cctx["customer_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return await _charge_sip_mandate(cctx["db"], e, cctx, actor="customer")


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
    items: List[OrderItem]
    contact: Contact
    address: Address
    note: Optional[str] = None


async def _products_by_ids(db, product_ids: list) -> dict:
    ids = [str(x) for x in product_ids if x]
    if not ids:
        return {}
    rows = await db.products.find({"id": {"$in": ids}}).to_list(len(ids))
    return {str(r.get("id")): r for r in rows}


async def _invoice_pdf_for_order(*, db, tenant: dict, order: dict) -> bytes:
    ids = [it.get("product_id") for it in (order.get("items") or [])]
    products = await _products_by_ids(db, ids)
    return inv_pdf.build_tax_invoice_pdf(tenant=tenant, order=order, products_by_id=products)


@router.post("/public/orders")
async def create_order(body: OrderIn, cctx=Depends(get_customer_ctx)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    subtotal = sum(i.price * i.qty for i in body.items)
    products = await _products_by_ids(cctx["db"], [i.product_id for i in body.items])
    items = []
    for i in body.items:
        row = i.model_dump()
        prod = products.get(str(i.product_id)) or {}
        if prod:
            row.update(inv_pdf.snapshot_fields_from_product(prod))
        else:
            row.setdefault("hsn", inv_pdf.DEFAULT_HSN)
        items.append(row)
    order = {
        "id": str(uuid.uuid4()),
        "order_no": "RSV-" + datetime.now(timezone.utc).strftime("%y%m%d") + "-" + uuid.uuid4().hex[:5].upper(),
        "customer_id": cctx["customer_id"],
        "guest_id": None,
        "channel": "online",
        "items": items,
        "subtotal": round(subtotal, 2),
        "currency": "₹",
        "contact": body.contact.model_dump(),
        "address": body.address.model_dump(),
        "note": body.note,
        "status": "reserved",
        "payment_status": "unpaid",
        "created_at": _now_iso(),
    }
    await cctx["db"].orders.insert_one(order)
    cust = cctx["customer"]
    if body.contact.name and not cust.get("name"):
        await cctx["db"].customers.update_one(
            {"id": cctx["customer_id"]}, {"$set": {"name": body.contact.name}}
        )
    return _clean(order)


@router.get("/public/orders")
async def list_orders(cctx=Depends(get_customer_ctx)):
    rows = await cctx["db"].orders.find({"customer_id": cctx["customer_id"]}).sort("created_at", -1).to_list(100)
    return [_clean(r) for r in rows]


@router.get("/public/orders/{order_id}")
async def get_order(order_id: str, cctx=Depends(get_customer_ctx)):
    o = await cctx["db"].orders.find_one({"id": order_id, "customer_id": cctx["customer_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _clean(o)


@router.get("/public/orders/{order_id}/invoice")
async def get_order_invoice(order_id: str, cctx=Depends(get_customer_ctx)):
    o = await cctx["db"].orders.find_one({"id": order_id, "customer_id": cctx["customer_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Invoice available after payment")
    pdf = await _invoice_pdf_for_order(db=cctx["db"], tenant=cctx["tenant"], order=o)
    filename = f"{o.get('invoice_no') or o.get('order_no') or order_id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/public/orders/{order_id}/pay")
async def order_pay(order_id: str, cctx=Depends(get_customer_ctx)):
    o = await cctx["db"].orders.find_one({"id": order_id, "customer_id": cctx["customer_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    return await _start_razorpay_payment(
        cctx, kind="order", amount_inr=float(o.get("subtotal", 0)), ref_id=order_id
    )


@router.post("/public/orders/{order_id}/pay/dev-confirm")
async def order_pay_dev_confirm(order_id: str, cctx=Depends(get_customer_ctx)):
    if not rzp.allow_dev_confirm():
        raise HTTPException(status_code=404, detail="Not found")
    o = await cctx["db"].orders.find_one({"id": order_id, "customer_id": cctx["customer_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if rzp.rate_lock_expired(o.get("rate_locked_at")):
        # allow confirm if pay was never started — start then confirm
        if not o.get("rate_locked_at"):
            await order_pay(order_id, cctx)
            o = await cctx["db"].orders.find_one({"id": order_id})
        if rzp.rate_lock_expired(o.get("rate_locked_at")):
            raise HTTPException(status_code=400, detail="Rate lock expired")
    await _mark_order_paid(
        cctx["db"], o, gateway_payment_id="pay_dev_" + uuid.uuid4().hex[:10], tenant=cctx["tenant"]
    )
    return _clean(await cctx["db"].orders.find_one({"id": order_id}))


@router.post("/public/orders/{order_id}/pay/confirm")
async def order_pay_confirm(order_id: str, body: PayConfirmIn, cctx=Depends(get_customer_ctx)):
    o = await cctx["db"].orders.find_one({"id": order_id, "customer_id": cctx["customer_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("payment_status") == "paid":
        return _clean(o)
    if o.get("razorpay_order_id") and o["razorpay_order_id"] != body.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order id mismatch")
    if rzp.rate_lock_expired(o.get("rate_locked_at")):
        raise HTTPException(status_code=400, detail="Rate lock expired")
    gw = await _tenant_gateway(cctx["tenant"])
    if not rzp.verify_payment_signature(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature,
        key_secret=gw["key_secret"],
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    await cctx["db"].orders.update_one(
        {"id": order_id},
        {"$set": {"razorpay_order_id": body.razorpay_order_id}},
    )
    o = await cctx["db"].orders.find_one({"id": order_id})
    await _mark_order_paid(
        cctx["db"], o, gateway_payment_id=body.razorpay_payment_id, tenant=cctx["tenant"]
    )
    return _clean(await cctx["db"].orders.find_one({"id": order_id}))


class MetalBuyIn(BaseModel):
    metal: str
    amount_inr: float = Field(..., gt=0)


@router.get("/public/metal/wallet")
async def metal_wallet(cctx=Depends(get_customer_ctx)):
    w = await cctx["db"].metal_wallets.find_one({"customer_id": cctx["customer_id"]}) or {}
    return {
        "customer_id": cctx["customer_id"],
        "gold_grams": float(w.get("gold_grams") or 0),
        "silver_grams": float(w.get("silver_grams") or 0),
        "updated_at": w.get("updated_at"),
    }


@router.post("/public/metal/buy")
async def metal_buy(body: MetalBuyIn, cctx=Depends(get_customer_ctx)):
    metal = (body.metal or "").strip().lower()
    if metal not in ("gold", "silver"):
        raise HTTPException(status_code=400, detail="metal must be gold or silver")
    amount = float(body.amount_inr)
    if amount < 100:
        raise HTTPException(status_code=400, detail="Minimum purchase is ₹100")
    rate = _rate_for_metal(cctx, metal)
    purchase_id = str(uuid.uuid4())
    doc = {
        "id": purchase_id,
        "customer_id": cctx["customer_id"],
        "metal": metal,
        "amount_inr": amount,
        "rate_locked": rate,
        "rate_locked_at": _now_iso(),
        "grams": None,
        "status": "created",
        "created_at": _now_iso(),
    }
    await cctx["db"].metal_purchases.insert_one(doc)
    pay = await _start_razorpay_payment(
        cctx,
        kind="metal_purchase",
        amount_inr=amount,
        ref_id=purchase_id,
        meta={"metal": metal},
        rate_locked=rate,
    )
    return {**pay, "purchase_id": purchase_id, "metal": metal, "estimated_grams": round(amount / rate, 4)}


@router.post("/public/metal/buy/dev-confirm")
async def metal_buy_dev_confirm(body: dict, cctx=Depends(get_customer_ctx)):
    if not rzp.allow_dev_confirm():
        raise HTTPException(status_code=404, detail="Not found")
    purchase_id = body.get("purchase_id")
    if not purchase_id:
        raise HTTPException(status_code=400, detail="purchase_id required")
    p = await cctx["db"].metal_purchases.find_one({"id": purchase_id, "customer_id": cctx["customer_id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if p.get("status") == "paid":
        wallet = await cctx["db"].metal_wallets.find_one({"customer_id": cctx["customer_id"]}) or {}
        return {
            "purchase": _clean(p),
            "wallet": {
                "gold_grams": float(wallet.get("gold_grams") or 0),
                "silver_grams": float(wallet.get("silver_grams") or 0),
            },
        }
    rate = float(p.get("rate_locked") or _rate_for_metal(cctx, p.get("metal", "gold")))
    if not p.get("razorpay_order_id"):
        await _start_razorpay_payment(
            cctx,
            kind="metal_purchase",
            amount_inr=float(p["amount_inr"]),
            ref_id=purchase_id,
            meta={"metal": p.get("metal", "gold")},
            rate_locked=rate,
        )
    result = await _apply_metal_purchase_paid(
        cctx["db"], purchase_id, cctx["customer_id"], "pay_dev_" + uuid.uuid4().hex[:10]
    )
    wallet = await cctx["db"].metal_wallets.find_one({"customer_id": cctx["customer_id"]}) or {}
    return {
        "purchase": _clean(result),
        "wallet": {
            "gold_grams": float(wallet.get("gold_grams") or 0),
            "silver_grams": float(wallet.get("silver_grams") or 0),
        },
    }


@router.post("/public/metal/buy/confirm")
async def metal_buy_confirm(body: dict, cctx=Depends(get_customer_ctx)):
    purchase_id = body.get("purchase_id")
    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_signature = body.get("razorpay_signature")
    if not all([purchase_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        raise HTTPException(status_code=400, detail="Missing payment fields")
    p = await cctx["db"].metal_purchases.find_one({"id": purchase_id, "customer_id": cctx["customer_id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if p.get("status") == "paid":
        w = await cctx["db"].metal_wallets.find_one({"customer_id": cctx["customer_id"]}) or {}
        return {"purchase": _clean(p), "wallet": {
            "gold_grams": float(w.get("gold_grams") or 0),
            "silver_grams": float(w.get("silver_grams") or 0),
        }}
    if p.get("razorpay_order_id") and p["razorpay_order_id"] != razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order id mismatch")
    if rzp.rate_lock_expired(p.get("rate_locked_at")):
        raise HTTPException(status_code=400, detail="Rate lock expired")
    gw = await _tenant_gateway(cctx["tenant"])
    if not rzp.verify_payment_signature(
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id,
        razorpay_signature=razorpay_signature,
        key_secret=gw["key_secret"],
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    result = await _apply_metal_purchase_paid(cctx["db"], purchase_id, cctx["customer_id"], razorpay_payment_id)
    w = await cctx["db"].metal_wallets.find_one({"customer_id": cctx["customer_id"]}) or {}
    return {"purchase": _clean(result), "wallet": {
        "gold_grams": float(w.get("gold_grams") or 0),
        "silver_grams": float(w.get("silver_grams") or 0),
    }}


@router.post("/public/sip/enrollments/{enrollment_id}/pay/dev-confirm")
async def sip_pay_dev_confirm(enrollment_id: str, cctx=Depends(get_customer_ctx)):
    if not rzp.allow_dev_confirm():
        raise HTTPException(status_code=404, detail="Not found")
    # ensure a payment attempt exists
    await sip_pay(enrollment_id, cctx)
    result = await _apply_sip_installment_paid(cctx["db"], enrollment_id, cctx["customer_id"], cctx)
    if not result:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return result


@router.post("/public/sip/enrollments/{enrollment_id}/pay/confirm")
async def sip_pay_confirm(enrollment_id: str, body: PayConfirmIn, cctx=Depends(get_customer_ctx)):
    e = await cctx["db"].sip_enrollments.find_one({"id": enrollment_id, "customer_id": cctx["customer_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    pay = await cctx["db"].payments.find_one(
        {
            "kind": "sip_installment",
            "ref_id": enrollment_id,
            "customer_id": cctx["customer_id"],
            "razorpay_order_id": body.razorpay_order_id,
        },
        sort=[("created_at", -1)],
    )
    if not pay:
        raise HTTPException(status_code=400, detail="No matching Razorpay order for this enrollment")
    if rzp.rate_lock_expired(pay.get("rate_locked_at")):
        raise HTTPException(status_code=400, detail="Rate lock expired")
    gw = await _tenant_gateway(cctx["tenant"])
    if not rzp.verify_payment_signature(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature,
        key_secret=gw["key_secret"],
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    result = await _apply_sip_installment_paid(cctx["db"], enrollment_id, cctx["customer_id"], cctx)
    if not result:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await cctx["db"].payments.update_one(
        {"id": pay["id"]},
        {"$set": {"status": "paid", "gateway_payment_id": body.razorpay_payment_id, "paid_at": _now_iso()}},
    )
    return result
