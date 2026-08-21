"""SIP UPI Autopay mandate — mock path."""
from __future__ import annotations

import os
import uuid

import requests

from conftest import AURELIA_HOST, OTP_DEV_CODE, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def _otp_login(phone: str) -> str:
    h = tenant_headers(AURELIA_HOST)
    r = requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json().get("dev_otp") or OTP_DEV_CODE
    r2 = requests.post(
        f"{BASE_URL}/api/public/auth/otp/verify",
        headers=h,
        json={"phone": phone, "code": code},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


def _admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestSipAutopay:
    def test_mandate_setup_dev_confirm_and_charge(self):
        phone = f"98{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        h = tenant_headers(AURELIA_HOST, token)
        plans = requests.get(f"{BASE_URL}/api/public/sip/plans", headers=tenant_headers(AURELIA_HOST), timeout=15).json()
        assert plans
        enroll = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=h,
            json={"plan_id": plans[0]["id"], "name": "Auto Pay", "phone": phone},
            timeout=15,
        )
        assert enroll.status_code == 200, enroll.text
        eid = enroll.json()["id"]
        assert enroll.json().get("mandate_status") == "none"

        activated = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{eid}/mandate/dev-confirm",
            headers=h,
            json={},
            timeout=15,
        )
        assert activated.status_code == 200, activated.text
        body = activated.json()
        assert body.get("mandate_status") == "active"
        assert body.get("razorpay_token_id")
        # first installment paid on auth
        paid = [i for i in body["installments"] if i["status"] == "paid"]
        assert len(paid) >= 1

        # charge next via autopay
        charged = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{eid}/mandate/charge",
            headers=h,
            json={},
            timeout=15,
        )
        assert charged.status_code == 200, charged.text
        assert charged.json().get("mandate_status") == "active"
        assert len([i for i in charged.json()["installments"] if i["status"] == "paid"]) >= 2

    def test_manual_pay_still_works_without_mandate(self):
        phone = f"97{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        h = tenant_headers(AURELIA_HOST, token)
        plans = requests.get(f"{BASE_URL}/api/public/sip/plans", headers=tenant_headers(AURELIA_HOST), timeout=15).json()
        enroll = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=h,
            json={"plan_id": plans[0]["id"], "name": "Manual", "phone": phone},
            timeout=15,
        ).json()
        eid = enroll["id"]
        pay = requests.post(f"{BASE_URL}/api/public/sip/enrollments/{eid}/pay", headers=h, json={}, timeout=15)
        assert pay.status_code == 200, pay.text
        conf = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{eid}/pay/dev-confirm",
            headers=h,
            json={},
            timeout=15,
        )
        assert conf.status_code == 200, conf.text

    def test_admin_pause_resume_cancel(self):
        phone = f"96{uuid.uuid4().int % 10**8:08d}"
        token = _otp_login(phone)
        h = tenant_headers(AURELIA_HOST, token)
        plans = requests.get(f"{BASE_URL}/api/public/sip/plans", headers=tenant_headers(AURELIA_HOST), timeout=15).json()
        eid = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=h,
            json={"plan_id": plans[0]["id"], "name": "Admin Mand", "phone": phone},
            timeout=15,
        ).json()["id"]
        requests.post(f"{BASE_URL}/api/public/sip/enrollments/{eid}/mandate/dev-confirm", headers=h, json={}, timeout=15)
        at = _admin_token()
        ah = {"Authorization": f"Bearer {at}"}
        paused = requests.post(f"{BASE_URL}/api/admin/sip/enrollments/{eid}/mandate/pause", headers=ah, timeout=15)
        assert paused.status_code == 200, paused.text
        assert paused.json()["mandate_status"] == "paused"
        resumed = requests.post(f"{BASE_URL}/api/admin/sip/enrollments/{eid}/mandate/resume", headers=ah, timeout=15)
        assert resumed.json()["mandate_status"] == "active"
        cancelled = requests.post(f"{BASE_URL}/api/admin/sip/enrollments/{eid}/mandate/cancel", headers=ah, timeout=15)
        assert cancelled.json()["mandate_status"] == "cancelled"
        # charge should fail after cancel
        bad = requests.post(f"{BASE_URL}/api/public/sip/enrollments/{eid}/mandate/charge", headers=h, json={}, timeout=15)
        assert bad.status_code == 400
