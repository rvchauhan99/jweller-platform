"""pay/confirm signature verification (mocked Razorpay — no live network)."""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from payments_razorpay import payment_signature_for_tests

from conftest import AURELIA_HOST, OTP_DEV_CODE, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
# Mock client still uses this secret when MOCK_RAZORPAY=1 on the API process
MOCK_KEY_SECRET = "mock_secret"


def _otp_login(phone: str) -> str:
    h = tenant_headers(AURELIA_HOST)
    requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).raise_for_status()
    r = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": OTP_DEV_CODE},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _create_order(token: str):
    p = requests.get(f"{BASE_URL}/api/public/products", headers=tenant_headers(AURELIA_HOST), timeout=15).json()[0]
    price = p.get("live_price") or p.get("price") or 1000
    r = requests.post(
        f"{BASE_URL}/api/public/orders",
        headers=tenant_headers(AURELIA_HOST, token),
        json={
            "items": [{"product_id": p["id"], "name": p["name"], "price": price, "qty": 1}],
            "contact": {"name": "Confirm User", "phone": "9876543210"},
            "address": {"line1": "MG Road", "city": "Mumbai", "pincode": "400001"},
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestPayConfirm:
    def test_confirm_happy_path(self):
        phone = f"96{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        order = _create_order(token)
        pay = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).json()
        payment_id = "pay_test_" + uuid.uuid4().hex[:10]
        sig = payment_signature_for_tests(
            razorpay_order_id=pay["razorpay_order_id"],
            razorpay_payment_id=payment_id,
            key_secret=MOCK_KEY_SECRET,
        )
        conf = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay/confirm",
            headers=tenant_headers(AURELIA_HOST, token),
            json={
                "razorpay_order_id": pay["razorpay_order_id"],
                "razorpay_payment_id": payment_id,
                "razorpay_signature": sig,
            },
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        assert conf.json()["payment_status"] == "paid"

    def test_confirm_bad_signature(self):
        phone = f"95{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        order = _create_order(token)
        pay = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).json()
        conf = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay/confirm",
            headers=tenant_headers(AURELIA_HOST, token),
            json={
                "razorpay_order_id": pay["razorpay_order_id"],
                "razorpay_payment_id": "pay_bad",
                "razorpay_signature": "deadbeef",
            },
            timeout=15,
        )
        assert conf.status_code == 400

    def test_sip_confirm_happy_path(self):
        phone = f"94{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        en = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=tenant_headers(AURELIA_HOST, token),
            json={"plan_id": "gold-11-1", "name": "SIP Confirm", "phone": phone},
            timeout=15,
        ).json()
        pay = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{en['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).json()
        payment_id = "pay_sip_" + uuid.uuid4().hex[:10]
        sig = payment_signature_for_tests(
            razorpay_order_id=pay["razorpay_order_id"],
            razorpay_payment_id=payment_id,
            key_secret=MOCK_KEY_SECRET,
        )
        conf = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{en['id']}/pay/confirm",
            headers=tenant_headers(AURELIA_HOST, token),
            json={
                "razorpay_order_id": pay["razorpay_order_id"],
                "razorpay_payment_id": payment_id,
                "razorpay_signature": sig,
            },
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        assert conf.json()["summary"]["paid_installments"] >= 1
