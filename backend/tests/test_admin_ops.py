"""Admin login, POS, gateway isolation (mock HTTP)."""
from __future__ import annotations

import os
import uuid

import requests

from conftest import AURELIA_HOST, NOIR_HOST, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def _admin_login(tenant_code: str, username: str, password: str):
    return requests.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"tenant_code": tenant_code, "username": username, "password": password},
        timeout=15,
    )


class TestAdminOps:
    def test_login_success_and_fail(self):
        ok = _admin_login("AURELIA", "owner", "Aurelia@123")
        assert ok.status_code == 200, ok.text
        assert ok.json().get("access_token")
        assert ok.json().get("tenant_code") == "AURELIA"

        bad = _admin_login("AURELIA", "owner", "wrong-password")
        assert bad.status_code == 401

        unknown = _admin_login("NOPE", "owner", "Aurelia@123")
        assert unknown.status_code in (401, 404)

    def test_pos_sale_happy_path(self):
        login = _admin_login("AURELIA", "owner", "Aurelia@123")
        token = login.json()["access_token"]
        ah = {"Authorization": f"Bearer {token}"}
        products = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15)
        assert products.status_code == 200, products.text
        items = products.json()
        assert items, "seed products required"
        pid = items[0]["id"]
        sale = requests.post(
            f"{BASE_URL}/api/admin/pos/sale",
            headers=ah,
            json={
                "items": [{"product_id": pid, "qty": 1}],
                "tender": "cash",
                "contact_name": "Walk-in Test",
            },
            timeout=20,
        )
        assert sale.status_code == 200, sale.text
        body = sale.json()
        assert body.get("channel") == "offline"
        assert body.get("status") in ("delivered", "confirmed", "paid") or body.get("payment_status") == "paid"
        assert body.get("order_no", "").startswith("POS-")

    def test_gateway_isolation_between_tenants(self):
        """AURELIA gateway keys must not leak onto NOIR gateway read."""
        a = _admin_login("AURELIA", "owner", "Aurelia@123")
        assert a.status_code == 200
        at = a.json()["access_token"]
        unique_key = "rzp_test_isolation_" + uuid.uuid4().hex[:8]
        put = requests.put(
            f"{BASE_URL}/api/admin/gateway",
            headers={"Authorization": f"Bearer {at}"},
            json={
                "provider": "razorpay",
                "key_id": unique_key,
                "key_secret": "secret_isolation_test_value",
                "enabled": True,
            },
            timeout=15,
        )
        assert put.status_code == 200, put.text
        assert put.json().get("key_id") == unique_key

        n = _admin_login("NOIR", "owner", "Noir@123")
        assert n.status_code == 200
        nt = n.json()["access_token"]
        noir_gw = requests.get(
            f"{BASE_URL}/api/admin/gateway",
            headers={"Authorization": f"Bearer {nt}"},
            timeout=15,
        )
        assert noir_gw.status_code == 200, noir_gw.text
        assert noir_gw.json().get("key_id") != unique_key

        # Public pay for NOIR must not use AURELIA key via Host (gateway is per tenant doc)
        # Cross-check: AURELIA still has its key
        aurelia_gw = requests.get(
            f"{BASE_URL}/api/admin/gateway",
            headers={"Authorization": f"Bearer {at}"},
            timeout=15,
        )
        assert aurelia_gw.json().get("key_id") == unique_key
