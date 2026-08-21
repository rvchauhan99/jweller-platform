"""Razorpay Model B checkout + webhook + SIP installment pay (mocked)."""
from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from payments_razorpay import mock_webhook_signature

from conftest import AURELIA_HOST, NOIR_HOST, OTP_DEV_CODE, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
WEBHOOK_SECRET = "mock_webhook_secret"


def _otp_login(host: str, phone: str) -> str:
    h = tenant_headers(host)
    requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).raise_for_status()
    r = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": OTP_DEV_CODE},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _first_product(host: str):
    r = requests.get(f"{BASE_URL}/api/public/products", headers=tenant_headers(host), timeout=15)
    r.raise_for_status()
    rows = r.json()
    assert rows, "seed products required"
    return rows[0]


def _create_order(token: str, host: str = AURELIA_HOST):
    p = _first_product(host)
    price = p.get("live_price") or p.get("price") or 1000
    r = requests.post(
        f"{BASE_URL}/api/public/orders",
        headers=tenant_headers(host, token),
        json={
            "items": [{"product_id": p["id"], "name": p["name"], "price": price, "qty": 1}],
            "contact": {"name": "Pay User", "phone": "9876543210"},
            "address": {"line1": "MG Road", "city": "Mumbai", "pincode": "400001"},
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestRazorpayCheckout:
    def test_pay_creates_mock_order(self):
        phone = f"9{uuid.uuid4().int % 10**9:09d}"
        token = _otp_login(AURELIA_HOST, phone)
        order = _create_order(token)
        pay = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        )
        assert pay.status_code == 200, pay.text
        body = pay.json()
        assert body["razorpay_order_id"].startswith("order_")
        assert body["key_id"]
        assert body["amount"] > 0
        assert body.get("mock") is True
        assert "rate_lock_ttl_sec" in body

    def test_dev_confirm_marks_paid(self):
        phone = f"8{uuid.uuid4().int % 10**9:09d}"
        token = _otp_login(AURELIA_HOST, phone)
        order = _create_order(token)
        requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).raise_for_status()
        conf = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay/dev-confirm",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        assert conf.json()["payment_status"] == "paid"
        assert conf.json()["status"] == "confirmed"

    def test_webhook_happy_path(self):
        phone = f"7{uuid.uuid4().int % 10**9:09d}"
        token = _otp_login(AURELIA_HOST, phone)
        order = _create_order(token)
        pay = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).json()
        # tenant_id in notes is AURELIA code (tenant _id)
        payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_" + uuid.uuid4().hex[:8],
                        "order_id": pay["razorpay_order_id"],
                        "notes": {
                            "tenant_id": "AURELIA",
                            "kind": "order",
                            "ref_id": order["id"],
                            "customer_id": "ignored",
                        },
                    }
                }
            },
        }
        raw = json.dumps(payload).encode()
        sig = mock_webhook_signature(raw, WEBHOOK_SECRET)
        wh = requests.post(
            f"{BASE_URL}/api/public/webhooks/razorpay",
            data=raw,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
            timeout=15,
        )
        assert wh.status_code == 200, wh.text
        got = requests.get(
            f"{BASE_URL}/api/public/orders/{order['id']}",
            headers=tenant_headers(AURELIA_HOST, token),
            timeout=15,
        ).json()
        assert got["payment_status"] == "paid"

    def test_webhook_bad_signature(self):
        payload = {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "x", "notes": {"tenant_id": "AURELIA"}}}}}
        raw = json.dumps(payload).encode()
        wh = requests.post(
            f"{BASE_URL}/api/public/webhooks/razorpay",
            data=raw,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": "deadbeef"},
            timeout=15,
        )
        assert wh.status_code == 400

    def test_tenant_a_webhook_cannot_pay_tenant_b_order(self):
        phone_a = f"6{uuid.uuid4().int % 10**9:09d}"
        phone_b = f"95{uuid.uuid4().int % 10**8:08d}"
        token_a = _otp_login(AURELIA_HOST, phone_a)
        token_b = _otp_login(NOIR_HOST, phone_b)
        order_b = _create_order(token_b, NOIR_HOST)
        pay_b = requests.post(
            f"{BASE_URL}/api/public/orders/{order_b['id']}/pay",
            headers=tenant_headers(NOIR_HOST, token_b),
            json={},
            timeout=15,
        ).json()
        # Forge webhook claiming AURELIA tenant but NOIR order ref
        payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_forge_" + uuid.uuid4().hex[:8],
                        "order_id": pay_b["razorpay_order_id"],
                        "notes": {
                            "tenant_id": "AURELIA",
                            "kind": "order",
                            "ref_id": order_b["id"],
                            "customer_id": "x",
                        },
                    }
                }
            },
        }
        raw = json.dumps(payload).encode()
        sig = mock_webhook_signature(raw, WEBHOOK_SECRET)
        requests.post(
            f"{BASE_URL}/api/public/webhooks/razorpay",
            data=raw,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
            timeout=15,
        )
        got = requests.get(
            f"{BASE_URL}/api/public/orders/{order_b['id']}",
            headers=tenant_headers(NOIR_HOST, token_b),
            timeout=15,
        ).json()
        assert got.get("payment_status") != "paid"

    def test_sip_installment_pay_mock(self):
        phone = f"94{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(AURELIA_HOST, phone)
        en = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=tenant_headers(AURELIA_HOST, token),
            json={"plan_id": "gold-11-1", "name": "SIP Pay", "phone": phone},
            timeout=15,
        ).json()
        pay = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{en['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        )
        assert pay.status_code == 200, pay.text
        assert pay.json()["razorpay_order_id"]
        conf = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{en['id']}/pay/dev-confirm",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        assert conf.json()["summary"]["paid_installments"] >= 1
        assert conf.json()["installments"][0]["status"] == "paid"
