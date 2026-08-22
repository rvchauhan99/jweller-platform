"""Admin order return (restock) + invoice availability."""
from __future__ import annotations

import os
import uuid

import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
AURELIA_HOST = "aurelia.luxejewel.app"


def _admin_headers():
    login = requests.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}", "Content-Type": "application/json"}


def _customer_headers():
    phone = f"9{uuid.uuid4().int % 10**9:09d}"
    h = {"X-Tenant-Host": AURELIA_HOST, "Accept": "application/json", "Content-Type": "application/json"}
    requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    code = os.environ.get("OTP_DEV_CODE", "123456")
    tok = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": code},
        timeout=15,
    ).json()["access_token"]
    return {**h, "Authorization": f"Bearer {tok}"}, phone


class TestAdminOrderReturnAndInvoice:
    def test_return_from_delivered_restocks_once(self):
        ah = _admin_headers()
        products = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        assert products
        pid = products[0]["id"]
        stock_before = next(p for p in products if p["id"] == pid).get("stock_qty") or 0

        sale = requests.post(
            f"{BASE_URL}/api/admin/pos/sale",
            headers=ah,
            json={
                "items": [{"product_id": pid, "qty": 1}],
                "tender": "cash",
                "contact_name": "Return Test",
            },
            timeout=20,
        )
        assert sale.status_code == 200, sale.text
        order = sale.json()
        assert order["status"] == "delivered"
        oid = order["id"]

        mid = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        assert (next(p for p in mid if p["id"] == pid).get("stock_qty") or 0) == stock_before - 1

        ret = requests.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            headers=ah,
            json={"status": "returned", "reason": "Customer exchange"},
            timeout=15,
        )
        assert ret.status_code == 200, ret.text
        body = ret.json()
        assert body["status"] == "returned"
        assert body.get("return_restocked") is True
        assert body.get("return_reason") == "Customer exchange"
        assert body.get("returned_at")

        after = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        assert (next(p for p in after if p["id"] == pid).get("stock_qty") or 0) == stock_before

        again = requests.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            headers=ah,
            json={"status": "returned"},
            timeout=15,
        )
        assert again.status_code == 200
        after2 = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        assert (next(p for p in after2 if p["id"] == pid).get("stock_qty") or 0) == stock_before

    def test_return_from_reserved_rejected_and_no_public_return(self):
        ah = _admin_headers()
        products = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        pid = products[0]["id"]
        cust_h, phone = _customer_headers()
        order = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers=cust_h,
            json={
                "items": [{"product_id": pid, "name": "x", "price": 100, "qty": 1}],
                "contact": {"name": "n", "phone": phone},
                "address": {"line1": "a", "city": "Hyderabad", "pincode": "500001"},
            },
            timeout=15,
        )
        assert order.status_code == 200, order.text
        oid = order.json()["id"]
        assert order.json()["status"] == "reserved"

        rej = requests.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            headers=ah,
            json={"status": "returned"},
            timeout=15,
        )
        assert rej.status_code == 400, rej.text

        pub = requests.put(
            f"{BASE_URL}/api/public/orders/{oid}/return",
            headers=cust_h,
            json={},
            timeout=15,
        )
        assert pub.status_code in (404, 405, 422)

    def test_admin_invoice_paid_pos(self):
        ah = _admin_headers()
        products = requests.get(f"{BASE_URL}/api/admin/products", headers=ah, timeout=15).json()
        pid = products[0]["id"]
        sale = requests.post(
            f"{BASE_URL}/api/admin/pos/sale",
            headers=ah,
            json={"items": [{"product_id": pid, "qty": 1}], "tender": "cash"},
            timeout=20,
        ).json()
        inv = requests.get(
            f"{BASE_URL}/api/admin/orders/{sale['id']}/invoice",
            headers=ah,
            timeout=20,
        )
        assert inv.status_code == 200, inv.text
        assert inv.headers.get("content-type", "").startswith("application/pdf")
        assert inv.content[:4] == b"%PDF"
