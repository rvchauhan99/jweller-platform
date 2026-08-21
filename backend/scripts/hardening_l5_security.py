#!/usr/bin/env python3
"""L5 tenancy / security matrix smoke."""
from __future__ import annotations

import json
import os
import sys
import uuid

import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
results: list[tuple[str, bool, str]] = []


def ok(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def otp_token(host: str) -> str:
    phone = f"97{uuid.uuid4().int % 10**8:08d}"
    h = {"X-Tenant-Host": host, "Content-Type": "application/json"}
    requests.post(f"{BASE}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    code = os.environ.get("OTP_DEV_CODE", "123456")
    r = requests.post(f"{BASE}/api/public/auth/otp/verify", headers=h, json={"phone": phone, "code": code}, timeout=15)
    return r.json()["access_token"]


def main() -> int:
    # Customer JWT on wrong host — orders should not leak AURELIA data onto NOIR
    at = otp_token("aurelia.luxejewel.app")
    ah = {"X-Tenant-Host": "aurelia.luxejewel.app", "Authorization": f"Bearer {at}"}
    # Create nothing required — list orders on wrong host
    cross = requests.get(
        f"{BASE}/api/public/orders",
        headers={"X-Tenant-Host": "noir.luxejewel.app", "Authorization": f"Bearer {at}"},
        timeout=15,
    )
    # Either 401/403 or empty list — must not return AURELIA orders as success with data from other tenant
    ok(
        "customer_jwt_cross_host",
        cross.status_code in (401, 403) or (cross.status_code == 200 and cross.json() == []),
        f"status={cross.status_code} body={str(cross.text)[:60]}",
    )

    a = requests.post(
        f"{BASE}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    ).json()["access_token"]
    # Platform token must not work on admin
    pl = requests.post(
        f"{BASE}/api/platform/auth/login",
        json={"email": "ops@luxejewel.app", "password": "Platform@123"},
        timeout=15,
    ).json()["access_token"]
    bad_admin = requests.get(
        f"{BASE}/api/admin/dashboard",
        headers={"Authorization": f"Bearer {pl}"},
        timeout=15,
    )
    ok("platform_jwt_blocked_on_admin", bad_admin.status_code == 401, str(bad_admin.status_code))

    bad_plat = requests.get(
        f"{BASE}/api/platform/tenants",
        headers={"Authorization": f"Bearer {a}"},
        timeout=15,
    )
    ok("admin_jwt_blocked_on_platform", bad_plat.status_code == 401, str(bad_plat.status_code))

    # Webhook bad signature
    wh = requests.post(
        f"{BASE}/api/public/webhooks/razorpay",
        data=b'{"event":"payment.captured","payload":{"payment":{"entity":{"notes":{"tenant_id":"AURELIA","kind":"order","ref_id":"x"}}}}}',
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "deadbeef"},
        timeout=15,
    )
    ok("webhook_bad_signature", wh.status_code == 400, str(wh.status_code))

    # Gateway GET never returns raw secret
    gw = requests.get(f"{BASE}/api/admin/gateway", headers={"Authorization": f"Bearer {a}"}, timeout=15)
    ok("gateway_no_raw_secret", gw.status_code == 200 and "key_secret_enc" not in gw.text and '"key_secret"' not in gw.text)

    failed = [n for n, p, _ in results if not p]
    print("\n" + json.dumps({"passed": sum(1 for _, p, _ in results if p), "failed": len(failed), "failures": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
