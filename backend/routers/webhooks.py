"""Razorpay webhook routes (mounted under /api)."""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
import uuid

import payments_razorpay as rzp

from deps import (
    registry,
    client,
    _now_iso,
    _tenant_gateway,
    _mark_order_paid,
    _apply_sip_installment_paid,
    _apply_metal_purchase_paid,
)

router = APIRouter(tags=["webhooks"])

@router.post("/public/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    import json

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or ""
    try:
        payload = json.loads(body.decode() or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event") or ""
    # Prefer payment entity; also handle token entity for mandate lifecycle
    payment_entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    token_entity = ((payload.get("payload") or {}).get("token") or {}).get("entity") or {}
    entity = payment_entity or token_entity
    notes = entity.get("notes") or {}
    tenant_id = notes.get("tenant_id")
    razorpay_order_id = entity.get("order_id") or payment_entity.get("order_id")
    payment_id = payment_entity.get("id") or ("pay_wh_" + uuid.uuid4().hex[:10])
    if not tenant_id and razorpay_order_id:
        async for t in registry.tenants.find({}):
            tdb = client[t["mongo_db_name"]]
            p = await tdb.payments.find_one({"razorpay_order_id": razorpay_order_id})
            if p:
                tenant_id = t["_id"]
                notes = p.get("notes") or notes
                break
    if not tenant_id and token_entity.get("id"):
        # Locate enrollment by token
        async for t in registry.tenants.find({}):
            tdb = client[t["mongo_db_name"]]
            e = await tdb.sip_enrollments.find_one({"razorpay_token_id": token_entity["id"]})
            if e:
                tenant_id = t["_id"]
                notes = {**notes, "ref_id": e["id"], "customer_id": e.get("customer_id"), "kind": "sip_mandate_token"}
                break
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Unknown tenant for webhook")

    tenant = await registry.tenants.find_one({"_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=400, detail="Unknown tenant")
    gw = await _tenant_gateway(tenant)
    if not rzp.verify_webhook_signature(body, signature, gw["webhook_secret"]):
        raise HTTPException(status_code=400, detail="Invalid signature")

    tdb = client[tenant["mongo_db_name"]]
    kind = notes.get("kind")
    ref_id = notes.get("ref_id")
    customer_id = notes.get("customer_id")
    ctx_for_rate = {"tenant": tenant, "tenant_id": tenant_id, "db": tdb, "tenant_code": tenant["tenant_code"]}

    # Token lifecycle
    if event.startswith("token.") or kind == "sip_mandate_token":
        token_id = token_entity.get("id")
        if token_id and ref_id:
            status_map = {
                "token.confirmed": "active",
                "token.rejected": "failed",
                "token.cancelled": "cancelled",
                "token.paused": "paused",
                "token.resumed": "active",
            }
            new_status = status_map.get(event)
            if new_status:
                upd = {"mandate_status": new_status, "razorpay_token_id": token_id}
                if new_status == "active":
                    upd["mandate_authorized_at"] = _now_iso()
                await tdb.sip_enrollments.update_one({"id": ref_id}, {"$set": upd})
        return {"ok": True, "event": event}

    if payment_id and await tdb.orders.find_one({"gateway_payment_id": payment_id}):
        return {"ok": True, "duplicate": True}
    if payment_id and await tdb.payments.find_one({"gateway_payment_id": payment_id}):
        return {"ok": True, "duplicate": True}

    if kind == "order" and ref_id:
        o = await tdb.orders.find_one({"id": ref_id})
        if not o:
            return {"ok": False, "reason": "order_missing"}
        try:
            await _mark_order_paid(tdb, o, gateway_payment_id=payment_id, tenant=tenant)
        except HTTPException as e:
            return {"ok": False, "detail": e.detail}
    elif kind == "metal_purchase" and ref_id and customer_id:
        await _apply_metal_purchase_paid(tdb, ref_id, customer_id, payment_id)
    elif kind in ("sip_installment", "sip_recurring", "sip_mandate_auth") and ref_id and customer_id:
        if kind == "sip_mandate_auth":
            token_id = payment_entity.get("token_id") or payment_entity.get("token")
            if token_id:
                await tdb.sip_enrollments.update_one(
                    {"id": ref_id},
                    {"$set": {"mandate_status": "active", "razorpay_token_id": token_id, "mandate_authorized_at": _now_iso()}},
                )
        await _apply_sip_installment_paid(tdb, ref_id, customer_id, ctx_for_rate)
        await tdb.payments.update_one(
            {"razorpay_order_id": razorpay_order_id},
            {"$set": {"status": "paid", "gateway_payment_id": payment_id, "paid_at": _now_iso()}},
        )
    return {"ok": True, "event": event}
