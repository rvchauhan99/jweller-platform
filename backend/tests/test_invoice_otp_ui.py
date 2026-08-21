"""Invoice PDF stub + OTP dev_otp + pay/confirm invoice_no."""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from invoice_pdf import build_simple_pdf
from payments_razorpay import payment_signature_for_tests

from conftest import AURELIA_HOST, OTP_DEV_CODE, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
MOCK_KEY_SECRET = "mock_secret"


def _otp_login(phone: str) -> str:
    h = tenant_headers(AURELIA_HOST)
    r = requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("dev_otp") == OTP_DEV_CODE or body.get("dev_otp") == "123456"
    assert "dev_hint" in body
    r2 = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": body["dev_otp"]},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


class TestInvoiceAndDevOtp:
    def test_pdf_builder_produces_pdf_header(self):
        pdf = build_simple_pdf(["Line one", "Line two"], title="Tax Invoice")
        assert pdf.startswith(b"%PDF")

    def test_otp_request_returns_dev_otp(self):
        phone = f"96{uuid.uuid4().int % 10**8:08d}"
        r = requests.post(
            f"{BASE_URL}/api/public/auth/otp/request",
            headers=tenant_headers(AURELIA_HOST),
            json={"phone": phone},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("dev_otp")

    def test_paid_order_invoice_pdf(self):
        phone = f"95{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        p = requests.get(f"{BASE_URL}/api/public/products", headers=tenant_headers(AURELIA_HOST), timeout=15).json()[0]
        price = p.get("live_price") or p.get("price") or 1000
        order = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers=tenant_headers(AURELIA_HOST, token),
            json={
                "items": [{"product_id": p["id"], "name": p["name"], "price": price, "qty": 1}],
                "contact": {"name": "Inv", "phone": phone},
                "address": {"line1": "1", "city": "Mumbai", "pincode": "400001"},
            },
            timeout=15,
        ).json()
        pay = requests.post(
            f"{BASE_URL}/api/public/orders/{order['id']}/pay",
            headers=tenant_headers(AURELIA_HOST, token),
            json={},
            timeout=15,
        ).json()
        payment_id = "pay_inv_" + uuid.uuid4().hex[:8]
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
        assert conf.json().get("invoice_no")
        inv = requests.get(
            f"{BASE_URL}/api/public/orders/{order['id']}/invoice",
            headers=tenant_headers(AURELIA_HOST, token),
            timeout=15,
        )
        assert inv.status_code == 200
        assert inv.headers.get("content-type", "").startswith("application/pdf")
        assert inv.content.startswith(b"%PDF")
