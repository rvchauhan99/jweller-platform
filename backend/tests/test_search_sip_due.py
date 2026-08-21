"""Sprint 2: product search filters + SIP due filter."""
from __future__ import annotations

import os

import requests

from conftest import AURELIA_HOST, tenant_headers

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


class TestProductSearchFilters:
    def test_search_q_finds_name(self):
        allp = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=tenant_headers(AURELIA_HOST),
            timeout=15,
        ).json()
        assert allp
        needle = allp[0]["name"].split()[0]
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=tenant_headers(AURELIA_HOST),
            params={"q": needle},
            timeout=15,
        )
        assert r.status_code == 200
        names = " ".join(p["name"].lower() for p in r.json())
        assert needle.lower() in names

    def test_purity_and_sort(self):
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=tenant_headers(AURELIA_HOST),
            params={"purity": "22K", "sort": "price_asc"},
            timeout=15,
        )
        assert r.status_code == 200
        rows = r.json()
        assert all(p.get("purity") == "22K" for p in rows)
        prices = [p.get("live_price") or p.get("price") or 0 for p in rows]
        assert prices == sorted(prices)


class TestAdminSipDueFilter:
    def test_due_filter_returns_list(self):
        # admin login
        login = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
            timeout=15,
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        all_rows = requests.get(f"{BASE_URL}/api/admin/sip/enrollments", headers=h, timeout=15)
        assert all_rows.status_code == 200
        due_rows = requests.get(
            f"{BASE_URL}/api/admin/sip/enrollments",
            headers=h,
            params={"due": "due"},
            timeout=15,
        )
        assert due_rows.status_code == 200
        for e in due_rows.json():
            assert e.get("is_due_now") is True
        assert len(due_rows.json()) <= len(all_rows.json())
