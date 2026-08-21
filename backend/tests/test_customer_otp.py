"""Customer OTP (+91) — Host-scoped JWT and isolation."""
from __future__ import annotations

import os
import uuid

import pytest
import requests

from conftest import AURELIA_HOST, NOIR_HOST, OTP_DEV_CODE, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def _otp_login(host: str, phone: str = "9876543210") -> str:
    h = tenant_headers(host)
    r = requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    assert r.status_code == 200, r.text
    r2 = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": OTP_DEV_CODE},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


class TestCustomerOtp:
    def test_request_and_verify_happy_path(self):
        phone = f"9{uuid.uuid4().int % 10**9:09d}"
        token = _otp_login(AURELIA_HOST, phone)
        me = requests.get(f"{BASE_URL}/api/public/me", headers=tenant_headers(AURELIA_HOST, token), timeout=15)
        assert me.status_code == 200
        assert me.json()["phone"] == phone[-10:] if len(phone) > 10 else phone

    def test_wrong_code(self):
        phone = f"8{uuid.uuid4().int % 10**9:09d}"
        h = tenant_headers(AURELIA_HOST)
        assert requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).status_code == 200
        bad = requests.post(
            f"{BASE_URL}/api/public/auth/otp/verify",
            headers=h,
            json={"phone": phone, "code": "000000"},
            timeout=15,
        )
        assert bad.status_code == 400

    def test_same_phone_two_tenants_isolated(self):
        phone = f"7{uuid.uuid4().int % 10**9:09d}"
        ta = _otp_login(AURELIA_HOST, phone)
        tn = _otp_login(NOIR_HOST, phone)
        ma = requests.get(f"{BASE_URL}/api/public/me", headers=tenant_headers(AURELIA_HOST, ta), timeout=15).json()
        mn = requests.get(f"{BASE_URL}/api/public/me", headers=tenant_headers(NOIR_HOST, tn), timeout=15).json()
        assert ma["id"] != mn["id"]
        assert ma["phone"] == mn["phone"]

    def test_jwt_rejected_on_other_host(self):
        phone = f"6{uuid.uuid4().int % 10**9:09d}"
        token = _otp_login(AURELIA_HOST, phone)
        r = requests.get(f"{BASE_URL}/api/public/me", headers=tenant_headers(NOIR_HOST, token), timeout=15)
        assert r.status_code == 401

    def test_rate_limit_429(self):
        phone = f"98{uuid.uuid4().int % 10**8:08d}"
        h = tenant_headers(AURELIA_HOST)
        codes = []
        for _ in range(6):
            codes.append(
                requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).status_code
            )
        assert 429 in codes

    def test_checkout_requires_jwt(self):
        r = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers=tenant_headers(AURELIA_HOST),
            json={
                "items": [{"product_id": "x", "name": "x", "price": 100, "qty": 1}],
                "contact": {"name": "A", "phone": "9876543210"},
                "address": {"line1": "1", "city": "Mumbai", "pincode": "400001"},
            },
            timeout=15,
        )
        assert r.status_code == 401

    def test_sip_enroll_with_jwt(self):
        phone = f"97{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(AURELIA_HOST, phone)
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=tenant_headers(AURELIA_HOST, token),
            json={"plan_id": "gold-11-1", "name": "OTP User", "phone": phone},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert len(r.json()["installments"]) == 11
