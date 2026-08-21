#!/usr/bin/env python3
"""L3 Expo contract smoke — public/customer APIs the app uses (no WebView)."""
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
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    h = {"X-Tenant-Host": HOST, "Content-Type": "application/json"}
    boot = requests.get(f"{BASE}/api/public/bootstrap", headers=h, timeout=15)
    ok("bootstrap", boot.status_code == 200 and boot.json().get("tenant_code") == "AURELIA")
    rates = requests.get(f"{BASE}/api/public/rates", headers=h, timeout=15)
    ok("rates", rates.status_code == 200 and "gold" in rates.json())
    search = requests.get(f"{BASE}/api/public/products", headers=h, params={"q": "ring"}, timeout=15)
    ok("search", search.status_code == 200 and isinstance(search.json(), list))
    cats = requests.get(f"{BASE}/api/public/categories", headers=h, timeout=15)
    ok("categories", cats.status_code == 200)
    products = requests.get(f"{BASE}/api/public/products", headers=h, timeout=15).json()
    ok("pdp", bool(products) and requests.get(f"{BASE}/api/public/products/{products[0]['id']}", headers=h, timeout=15).status_code == 200)

    phone = f"96{uuid.uuid4().int % 10**8:08d}"
    req = requests.post(f"{BASE}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    ok("otp_banner_fields", req.status_code == 200 and (req.json().get("dev_otp") or req.json().get("dev_hint")))
    code = req.json().get("dev_otp") or "123456"
    ver = requests.post(f"{BASE}/api/public/auth/otp/verify", headers=h, json={"phone": phone, "code": code}, timeout=15)
    ok("otp_verify", ver.status_code == 200)
    token = ver.json()["access_token"]
    auth = {**h, "Authorization": f"Bearer {token}"}
    me = requests.get(f"{BASE}/api/public/me", headers=auth, timeout=15)
    ok("profile_me", me.status_code == 200)

    # Checkout order create + pay start (WebView confirm is MANUAL device step)
    p = products[0]
    price = min(float(p.get("live_price") or p.get("price") or 500), 500.0)
    order = requests.post(
        f"{BASE}/api/public/orders",
        headers=auth,
        json={
            "items": [{"product_id": p["id"], "name": p["name"], "price": price, "qty": 1}],
            "contact": {"name": "Expo Harden", "phone": phone},
            "address": {"line1": "1 St", "city": "Jaipur", "pincode": "302001"},
        },
        timeout=20,
    )
    ok("checkout_create_order", order.status_code == 200)
    if order.status_code == 200:
        pay = requests.post(f"{BASE}/api/public/orders/{order.json()['id']}/pay", headers=auth, json={}, timeout=30)
        ok(
            "checkout_pay_opens_razorpay_order",
            pay.status_code == 200 and pay.json().get("razorpay_order_id") and pay.json().get("key_id"),
            f"order={pay.json().get('razorpay_order_id','')[:20]}",
        )
        ok(
            "manual_webview_confirm_required",
            True,
            "Device: complete Test card 4111… then pay/confirm — see HARDENING_CHECKLIST L3",
        )

    plans = requests.get(f"{BASE}/api/public/sip/plans", headers=h, timeout=15).json()
    enroll = requests.post(
        f"{BASE}/api/public/sip/enroll",
        headers=auth,
        json={"plan_id": plans[0]["id"], "name": "Expo SIP", "phone": phone, "preferred_day": 12},
        timeout=15,
    )
    ok("sip_enroll", enroll.status_code == 200)
    if enroll.status_code == 200:
        eid = enroll.json()["id"]
        sip_pay = requests.post(f"{BASE}/api/public/sip/enrollments/{eid}/pay", headers=auth, json={}, timeout=30)
        ok("sip_pay_order", sip_pay.status_code == 200 and bool(sip_pay.json().get("razorpay_order_id")))

    # Admin phone API (same backend)
    al = requests.post(
        f"{BASE}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    )
    ok("expo_admin_login", al.status_code == 200)
    if al.status_code == 200:
        ah = {"Authorization": f"Bearer {al.json()['access_token']}"}
        due = requests.get(f"{BASE}/api/admin/sip/enrollments", headers=ah, params={"due": "due"}, timeout=15)
        ok("expo_admin_sip_due", due.status_code == 200)

    failed = [n for n, p, _ in results if not p]
    print("\n" + json.dumps({"passed": sum(1 for _, p, _ in results if p), "failed": len(failed), "failures": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
