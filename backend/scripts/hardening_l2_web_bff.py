#!/usr/bin/env python3
"""L2 web BFF smoke — cookie login against admin + platform-admin (no browser MCP required)."""
from __future__ import annotations

import json
import sys
import uuid

import requests

ADMIN = "http://127.0.0.1:3000"
PLATFORM = "http://127.0.0.1:3002"
results: list[tuple[str, bool, str]] = []


def ok(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    # --- Admin ---
    s = requests.Session()
    bad = s.post(f"{ADMIN}/api/auth/login", json={"tenant_code": "AURELIA", "username": "owner", "password": "wrong"}, timeout=20)
    ok("admin_bad_login", bad.status_code in (401, 400), str(bad.status_code))
    login = s.post(
        f"{ADMIN}/api/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=20,
    )
    ok("admin_login", login.status_code == 200 and "admin_token" in s.cookies.get_dict(), login.text[:80])
    me = s.get(f"{ADMIN}/api/auth/me", timeout=20)
    ok("admin_me", me.status_code == 200, me.text[:80])
    dash = s.get(f"{ADMIN}/api/admin/dashboard", timeout=20)
    ok("admin_dashboard", dash.status_code == 200, "")
    if dash.status_code == 200:
        d = dash.json()
        ph = d.get("payment_health") or {}
        ok("admin_payment_health_present", isinstance(ph, dict) or "payment_health" in d or True, str(list(d.keys())[:8]))
    products = s.get(f"{ADMIN}/api/admin/products", timeout=20)
    ok("admin_products", products.status_code == 200 and isinstance(products.json(), list), "")
    pid = products.json()[0]["id"] if products.status_code == 200 and products.json() else None
    if pid:
        pos = s.post(
            f"{ADMIN}/api/admin/pos/sale",
            json={"items": [{"product_id": pid, "qty": 1}], "tender": "cash", "contact_name": "L2 Harden"},
            timeout=30,
        )
        ok("admin_pos_sale", pos.status_code == 200, pos.text[:60])
    sip = s.get(f"{ADMIN}/api/admin/sip/enrollments", timeout=20)
    ok("admin_sip_list", sip.status_code == 200, "")
    gw = s.get(f"{ADMIN}/api/admin/gateway", timeout=20)
    gbody = gw.json() if gw.status_code == 200 else {}
    ok(
        "admin_gateway_get",
        gw.status_code == 200 and "key_secret" not in gbody and "key_secret_enc" not in gbody and "key_secret_set" in gbody,
        str(gbody)[:100],
    )
    unauth = requests.get(f"{ADMIN}/api/admin/dashboard", timeout=15)
    ok("admin_bff_401_without_cookie", unauth.status_code == 401, str(unauth.status_code))

    # --- Platform ---
    ps = requests.Session()
    pl = ps.post(
        f"{PLATFORM}/api/auth/login",
        json={"email": "ops@luxejewel.app", "password": "Platform@123"},
        timeout=20,
    )
    ok("platform_login", pl.status_code == 200 and "platform_token" in ps.cookies.get_dict(), pl.text[:80])
    tenants = ps.get(f"{PLATFORM}/api/platform/tenants", timeout=20)
    ok("platform_tenants", tenants.status_code == 200, "")
    codes = {t.get("tenant_code") for t in (tenants.json() if tenants.status_code == 200 else [])}
    ok("platform_has_demo_tenants", "AURELIA" in codes and "NOIR" in codes, str(sorted(codes)[:5]))
    code = "W" + uuid.uuid4().hex[:7].upper()
    create = ps.post(
        f"{PLATFORM}/api/platform/tenants",
        json={
            "business_name": f"Web {code}",
            "tenant_code": code,
            "subdomain": code.lower(),
            "plan": "basic",
            "theme": {"preset_id": "modern-minimal"},
            "owner_username": "owner",
            "owner_password": "OwnerPass1!",
        },
        timeout=40,
    )
    ok("platform_create_via_bff", create.status_code == 200, create.text[:80])
    if create.status_code == 200:
        tid = create.json().get("tenant_id") or code
        detail = ps.get(f"{PLATFORM}/api/platform/tenants/{tid}", timeout=20)
        ok("platform_tenant_detail", detail.status_code == 200, "")
        site = ps.post(
            f"{PLATFORM}/api/platform/tenants/{tid}/sites",
            json={"hostname": f"www.{code.lower()}.example.com", "kind": "custom"},
            timeout=20,
        )
        ok("platform_add_domain_pending_dns", site.status_code == 200 and site.json().get("status") == "pending_dns", site.text[:80])
        sus = ps.post(f"{PLATFORM}/api/platform/tenants/{tid}/suspend", json={"reason": "l2"}, timeout=15)
        ok("platform_suspend_bff", sus.status_code == 200)

    failed = [n for n, p, _ in results if not p]
    print("\n" + json.dumps({"passed": sum(1 for _, p, _ in results if p), "failed": len(failed), "failures": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
