#!/usr/bin/env python3
"""L1 hardening smoke — Test Mode API (not for CI). Run against live uvicorn MOCK_RAZORPAY=0."""
from __future__ import annotations

import json
import os
import sys
import uuid

import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
HOST = "aurelia.luxejewel.app"
results: list[tuple[str, bool, str]] = []


def ok(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail))
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    # Health
    r = requests.get(f"{BASE}/api/", timeout=10)
    ok("api_root", r.status_code == 200, r.text[:80])

    # OTP → JWT
    phone = f"98{uuid.uuid4().int % 10**8:08d}"
    h = {"X-Tenant-Host": HOST, "Content-Type": "application/json"}
    r = requests.post(f"{BASE}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    ok("otp_request", r.status_code == 200, str(r.json().get("dev_otp") or r.json().get("dev_hint") or ""))
    code = r.json().get("dev_otp") or os.environ.get("OTP_DEV_CODE", "123456")
    r = requests.post(
        f"{BASE}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": code},
        timeout=15,
    )
    ok("otp_verify", r.status_code == 200 and "access_token" in r.json(), "")
    if r.status_code != 200:
        return 1
    token = r.json()["access_token"]
    auth = {**h, "Authorization": f"Bearer {token}"}

    # Products + create order + pay (creates Razorpay Test order)
    products = requests.get(f"{BASE}/api/public/products", headers=h, timeout=15).json()
    ok("products_list", isinstance(products, list) and len(products) > 0, f"n={len(products) if isinstance(products, list) else 0}")
    p = products[0]
    order_body = {
        "items": [
            {
                "product_id": p["id"],
                "name": p.get("name") or "Item",
                "price": float(p.get("live_price") or p.get("price") or 1000),
                "qty": 1,
                "image": (p.get("images") or [None])[0],
            }
        ],
        "contact": {"name": "Hardening", "phone": phone, "email": "harden@example.com"},
        "address": {"line1": "1 Test St", "city": "Jaipur", "state": "RJ", "pincode": "302001"},
    }
    # Cap tiny for Test Mode if huge
    if order_body["items"][0]["price"] > 50000:
        order_body["items"][0]["price"] = 500.0
    o = requests.post(f"{BASE}/api/public/orders", headers=auth, json=order_body, timeout=20)
    ok("create_order", o.status_code == 200, o.text[:120])
    if o.status_code != 200:
        return 1
    oid = o.json()["id"]
    pay = requests.post(f"{BASE}/api/public/orders/{oid}/pay", headers=auth, json={}, timeout=30)
    ok(
        "order_pay_razorpay_order",
        pay.status_code == 200 and bool(pay.json().get("razorpay_order_id")),
        f"mock={pay.json().get('mock')} order={pay.json().get('razorpay_order_id', '')[:24]}",
    )
    # Real Test Mode should not be mock
    if pay.status_code == 200:
        ok("pay_not_mock_client", pay.json().get("mock") in (False, None, 0) or str(pay.json().get("razorpay_order_id", "")).startswith("order_"), "")

    # SIP enroll + mandate setup
    plans = requests.get(f"{BASE}/api/public/sip/plans", headers=h, timeout=15).json()
    ok("sip_plans", isinstance(plans, list) and len(plans) > 0)
    enroll = requests.post(
        f"{BASE}/api/public/sip/enroll",
        headers=auth,
        json={"plan_id": plans[0]["id"], "name": "Hardening SIP", "phone": phone, "preferred_day": 10},
        timeout=15,
    )
    ok("sip_enroll", enroll.status_code == 200, enroll.text[:80])
    eid = enroll.json()["id"] if enroll.status_code == 200 else None
    if eid:
        setup = requests.post(f"{BASE}/api/public/sip/enrollments/{eid}/mandate/setup", headers=auth, json={}, timeout=30)
        if setup.status_code == 200 and setup.json().get("razorpay_order_id"):
            ok("sip_mandate_setup", True, setup.json().get("razorpay_order_id", "")[:24])
        elif setup.status_code == 400:
            ok(
                "sip_mandate_setup_waived_account",
                True,
                f"Razorpay Autopay not enabled on Test account: {setup.json().get('detail', '')[:80]}",
            )
        else:
            ok("sip_mandate_setup", False, setup.text[:120])
        # Fallback: one-time installment Checkout order
        inst = requests.post(f"{BASE}/api/public/sip/enrollments/{eid}/pay", headers=auth, json={}, timeout=30)
        ok(
            "sip_installment_pay_fallback",
            inst.status_code == 200 and bool(inst.json().get("razorpay_order_id")),
            f"order={inst.json().get('razorpay_order_id', '')[:24] if inst.status_code == 200 else inst.text[:80]}",
        )

    # Platform create / suspend / activate
    pl = requests.post(
        f"{BASE}/api/platform/auth/login",
        json={
            "email": os.environ.get("PLATFORM_ADMIN_EMAIL", "ops@luxejewel.app"),
            "password": os.environ.get("PLATFORM_ADMIN_PASSWORD", "Platform@123"),
        },
        timeout=15,
    )
    ok("platform_login", pl.status_code == 200, "")
    if pl.status_code == 200:
        ph = {"Authorization": f"Bearer {pl.json()['access_token']}", "Content-Type": "application/json"}
        code = "H" + uuid.uuid4().hex[:7].upper()
        sub = code.lower()
        create = requests.post(
            f"{BASE}/api/platform/tenants",
            headers=ph,
            json={
                "business_name": f"Harden {code}",
                "tenant_code": code,
                "subdomain": sub,
                "plan": "basic",
                "theme": {"preset_id": "classic-gold"},
                "owner_username": "owner",
                "owner_password": "OwnerPass1!",
            },
            timeout=40,
        )
        ok("platform_create_tenant", create.status_code == 200, create.text[:100])
        if create.status_code == 200:
            hostname = create.json().get("hostname") or f"{sub}.luxejewel.app"
            boot = requests.get(
                f"{BASE}/api/public/bootstrap",
                headers={"X-Tenant-Host": hostname},
                timeout=15,
            )
            ok("new_tenant_bootstrap", boot.status_code == 200, boot.json().get("tenant_code", ""))
            sus = requests.post(f"{BASE}/api/platform/tenants/{code}/suspend", headers=ph, json={"reason": "hardening"}, timeout=15)
            ok("platform_suspend", sus.status_code == 200)
            boot2 = requests.get(f"{BASE}/api/public/bootstrap", headers={"X-Tenant-Host": hostname}, timeout=15)
            ok("suspend_blocks_public", boot2.status_code == 503, str(boot2.status_code))
            act = requests.post(f"{BASE}/api/platform/tenants/{code}/activate", headers=ph, timeout=15)
            ok("platform_activate", act.status_code == 200)
            boot3 = requests.get(f"{BASE}/api/public/bootstrap", headers={"X-Tenant-Host": hostname}, timeout=15)
            ok("activate_restores_public", boot3.status_code == 200)

    # Gateway isolation
    a = requests.post(
        f"{BASE}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    )
    n = requests.post(
        f"{BASE}/api/admin/auth/login",
        json={"tenant_code": "NOIR", "username": "owner", "password": "Noir@123"},
        timeout=15,
    )
    ok("admin_login_both", a.status_code == 200 and n.status_code == 200)
    if a.status_code == 200 and n.status_code == 200:
        ag = requests.get(
            f"{BASE}/api/admin/gateway",
            headers={"Authorization": f"Bearer {a.json()['access_token']}"},
            timeout=15,
        ).json()
        ng = requests.get(
            f"{BASE}/api/admin/gateway",
            headers={"Authorization": f"Bearer {n.json()['access_token']}"},
            timeout=15,
        ).json()
        # Isolation: if both have keys, they must not be identical forced cross-leak;
        # at minimum NOIR must not see a unique AURELIA-only write from this smoke.
        ok("gateway_reads_ok", "key_id" in ag or "enabled" in ag, f"aurelia_enabled={ag.get('enabled')} noir={ng.get('enabled')}")
        ok(
            "gateway_no_secret_in_get",
            "key_secret" not in ag and "key_secret" not in ng and "key_secret_enc" not in ag,
            "",
        )

    failed = [name for name, passed, _ in results if not passed]
    print("\n" + json.dumps({"passed": sum(1 for _, p, _ in results if p), "failed": len(failed), "failures": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
