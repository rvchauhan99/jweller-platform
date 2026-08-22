"""Admin forgot-password SMS OTP + optional TOTP 2FA."""
from __future__ import annotations

import os

import pyotp
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
OTP = os.environ.get("OTP_DEV_CODE", "123456")


def _login(tenant="AURELIA", username="owner", password="Aurelia@123", totp=None):
    body = {"tenant_code": tenant, "username": username, "password": password}
    if totp is not None:
        body["totp"] = totp
    return requests.post(f"{BASE_URL}/api/admin/auth/login", json=body, timeout=15)


def _owner_headers():
    r = _login()
    assert r.status_code == 200 and r.json().get("access_token"), r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


class TestAdminAuthSecurity:
    def test_login_without_2fa(self):
        r = _login()
        assert r.status_code == 200, r.text
        assert r.json().get("access_token")
        assert r.json().get("two_fa_required") is not True

    def test_forgot_request_and_confirm(self):
        req = requests.post(
            f"{BASE_URL}/api/admin/auth/forgot/request",
            json={"tenant_code": "AURELIA", "username": "owner"},
            timeout=15,
        )
        assert req.status_code == 200, req.text
        body = req.json()
        assert body.get("ok") is True
        code = body.get("dev_otp") or OTP

        new_pw = "TempPass99"
        conf = requests.post(
            f"{BASE_URL}/api/admin/auth/forgot/confirm",
            json={
                "tenant_code": "AURELIA",
                "username": "owner",
                "code": code,
                "new_password": new_pw,
            },
            timeout=15,
        )
        assert conf.status_code == 200, conf.text

        ok = _login(password=new_pw)
        assert ok.status_code == 200, ok.text
        token = ok.json()["access_token"]

        ch = requests.post(
            f"{BASE_URL}/api/admin/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"current_password": new_pw, "new_password": "Aurelia@123"},
            timeout=15,
        )
        assert ch.status_code == 200, ch.text
        assert _login().status_code == 200

    def test_2fa_enable_challenge_disable(self):
        # Dedicated staff user so parallel suites keep using owner without 2FA.
        oh = _owner_headers()
        uname = "2fauser"
        requests.delete(f"{BASE_URL}/api/admin/staff/{uname}", headers=oh, timeout=15)
        create = requests.post(
            f"{BASE_URL}/api/admin/staff",
            headers=oh,
            json={
                "username": uname,
                "password": "StaffPass1",
                "role": "staff",
                "phone": "9876500123",
            },
            timeout=15,
        )
        assert create.status_code == 200, create.text

        login = _login(username=uname, password="StaffPass1")
        assert login.status_code == 200, login.text
        h = {"Authorization": f"Bearer {login.json()['access_token']}", "Content-Type": "application/json"}

        gen = requests.post(f"{BASE_URL}/api/admin/auth/2fa/generate", headers=h, json={}, timeout=15)
        assert gen.status_code == 200, gen.text
        secret = gen.json()["secret"]
        assert gen.json().get("qr_png_data_url", "").startswith("data:image/png")
        code = pyotp.TOTP(secret).now()

        en = requests.post(
            f"{BASE_URL}/api/admin/auth/2fa/enable",
            headers=h,
            json={"totp": code},
            timeout=15,
        )
        assert en.status_code == 200, en.text
        assert en.json().get("two_fa_enabled") is True

        challenge = _login(username=uname, password="StaffPass1")
        assert challenge.status_code == 200
        assert challenge.json().get("two_fa_required") is True
        assert "access_token" not in challenge.json()

        bad = _login(username=uname, password="StaffPass1", totp="000000")
        assert bad.status_code == 401

        good_code = pyotp.TOTP(secret).now()
        full = _login(username=uname, password="StaffPass1", totp=good_code)
        assert full.status_code == 200, full.text
        assert full.json().get("access_token")
        h2 = {"Authorization": f"Bearer {full.json()['access_token']}", "Content-Type": "application/json"}

        off_code = pyotp.TOTP(secret).now()
        off = requests.post(
            f"{BASE_URL}/api/admin/auth/2fa/disable",
            headers=h2,
            json={"totp": off_code},
            timeout=15,
        )
        assert off.status_code == 200, off.text
        assert off.json().get("two_fa_enabled") is False

        again = _login(username=uname, password="StaffPass1")
        assert again.status_code == 200
        assert again.json().get("access_token")

        requests.delete(f"{BASE_URL}/api/admin/staff/{uname}", headers=oh, timeout=15)
