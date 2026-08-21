"""Platform console API — create/suspend/sites (mocked HTTP)."""
from __future__ import annotations

import os
import uuid

import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
PLATFORM_EMAIL = os.environ.get("PLATFORM_ADMIN_EMAIL", "ops@luxejewel.app")
PLATFORM_PASSWORD = os.environ.get("PLATFORM_ADMIN_PASSWORD", "Platform@123")


def _login() -> str:
    r = requests.post(
        f"{BASE_URL}/api/platform/auth/login",
        json={"email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestPlatform:
    def test_login_and_list_tenants(self):
        token = _login()
        r = requests.get(
            f"{BASE_URL}/api/platform/tenants",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        codes = {t["tenant_code"] for t in r.json()}
        assert "AURELIA" in codes
        assert "NOIR" in codes

    def test_create_suspend_activate_and_site(self):
        token = _login()
        h = {"Authorization": f"Bearer {token}"}
        code = "T" + uuid.uuid4().hex[:7].upper()
        sub = code.lower()
        create = requests.post(
            f"{BASE_URL}/api/platform/tenants",
            headers=h,
            json={
                "business_name": f"Shop {code}",
                "tenant_code": code,
                "subdomain": sub,
                "plan": "basic",
                "theme": {"preset_id": "classic-gold"},
                "owner_username": "owner",
                "owner_password": "OwnerPass1!",
                "tagline": "Test jeweler",
            },
            timeout=30,
        )
        assert create.status_code == 200, create.text
        body = create.json()
        assert body["status"] == "active"
        assert body["hostname"] == f"{sub}.luxejewel.app"

        # Public bootstrap works
        boot = requests.get(
            f"{BASE_URL}/api/public/bootstrap",
            headers={"X-Tenant-Host": body["hostname"]},
            timeout=15,
        )
        assert boot.status_code == 200, boot.text
        assert boot.json()["tenant_code"] == code

        # Suspend → 503
        sus = requests.post(f"{BASE_URL}/api/platform/tenants/{code}/suspend", headers=h, json={"reason": "test"}, timeout=15)
        assert sus.status_code == 200, sus.text
        boot2 = requests.get(
            f"{BASE_URL}/api/public/bootstrap",
            headers={"X-Tenant-Host": body["hostname"]},
            timeout=15,
        )
        assert boot2.status_code == 503

        act = requests.post(f"{BASE_URL}/api/platform/tenants/{code}/activate", headers=h, timeout=15)
        assert act.status_code == 200
        boot3 = requests.get(
            f"{BASE_URL}/api/public/bootstrap",
            headers={"X-Tenant-Host": body["hostname"]},
            timeout=15,
        )
        assert boot3.status_code == 200

        site = requests.post(
            f"{BASE_URL}/api/platform/tenants/{code}/sites",
            headers=h,
            json={"hostname": f"www.{sub}.example.com", "kind": "custom", "is_primary": False},
            timeout=15,
        )
        assert site.status_code == 200, site.text
        assert site.json()["status"] == "pending_dns"

        sites = requests.get(f"{BASE_URL}/api/platform/tenants/{code}/sites", headers=h, timeout=15)
        assert sites.status_code == 200
        assert len(sites.json()) >= 2

    def test_bad_login(self):
        r = requests.post(
            f"{BASE_URL}/api/platform/auth/login",
            json={"email": PLATFORM_EMAIL, "password": "wrong"},
            timeout=15,
        )
        assert r.status_code == 401
