"""Backend tests for the multi-tenant luxury jewelry storefront."""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

AURELIA_HOST = "aurelia.luxejewel.app"
NOIR_HOST = "noir.luxejewel.app"


def _h(host: str) -> dict:
    return {"X-Tenant-Host": host, "Accept": "application/json"}


# ---- Bootstrap ---------------------------------------------------------
class TestBootstrap:
    def test_aurelia_bootstrap(self):
        r = requests.get(f"{BASE_URL}/api/public/bootstrap", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["business_name"] == "Aurelia Fine Jewels"
        assert d["tenant_code"] == "AURELIA"
        assert d["theme"]["preset_id"] == "classic-gold"
        assert d["theme"]["mode"] == "light"
        assert "colors" in d["theme"] and "fonts" in d["theme"]
        assert d["theme"]["colors"]["primary"].startswith("#")
        assert isinstance(d["homepage_sections"], list) and len(d["homepage_sections"]) >= 1

    def test_noir_bootstrap_theme_differs(self):
        a = requests.get(f"{BASE_URL}/api/public/bootstrap", headers=_h(AURELIA_HOST), timeout=15).json()
        n = requests.get(f"{BASE_URL}/api/public/bootstrap", headers=_h(NOIR_HOST), timeout=15).json()
        assert n["business_name"] == "Noir Diamonds"
        assert n["theme"]["mode"] == "dark"
        assert n["theme"]["preset_id"] == "dark-royal"
        assert a["theme"]["colors"]["background"] != n["theme"]["colors"]["background"]
        assert a["theme"]["fonts"]["heading"] != n["theme"]["fonts"]["heading"]


# ---- CMS ---------------------------------------------------------------
class TestCms:
    def test_cms_shape(self):
        r = requests.get(f"{BASE_URL}/api/public/cms", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("hero_title", "hero_subtitle", "hero_image", "about_text", "rate"):
            assert k in d, f"missing {k}"
        assert d["hero_image"].startswith("http")
        assert "value" in d["rate"]


# ---- Categories --------------------------------------------------------
class TestCategories:
    def test_categories_sorted_and_active(self):
        r = requests.get(f"{BASE_URL}/api/public/categories", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 4
        orders = [c["sort_order"] for c in cats]
        assert orders == sorted(orders)
        assert all(c["active"] for c in cats)
        slugs = {c["slug"] for c in cats}
        assert slugs == {"rings", "necklaces", "earrings", "bangles"}


# ---- Products ----------------------------------------------------------
class TestProducts:
    def test_products_featured_only(self):
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=_h(AURELIA_HOST),
            params={"featured": "true"},
            timeout=15,
        )
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        assert all(p.get("featured") is True for p in prods)
        assert all(p.get("listed_online") for p in prods)

    def test_products_by_category(self):
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=_h(AURELIA_HOST),
            params={"category": "rings"},
            timeout=15,
        )
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        assert all(p["category_id"] == "rings" for p in prods)

    def test_unknown_category_returns_empty(self):
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=_h(AURELIA_HOST),
            params={"category": "does-not-exist"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_product_detail_and_category_name(self):
        list_r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=_h(AURELIA_HOST),
            params={"category": "rings"},
            timeout=15,
        ).json()
        pid = list_r[0]["id"]
        r = requests.get(f"{BASE_URL}/api/public/products/{pid}", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pid
        assert d["category_name"] == "Rings"
        for k in ("name", "price", "purity", "images", "sku", "weight_grams"):
            assert k in d

    def test_product_detail_unknown_404(self):
        r = requests.get(f"{BASE_URL}/api/public/products/no-such-id", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 404


# ---- Tenant isolation & security --------------------------------------
class TestTenantIsolation:
    def test_unknown_host_404(self):
        r = requests.get(f"{BASE_URL}/api/public/bootstrap", headers=_h("bogus.luxejewel.app"), timeout=15)
        assert r.status_code == 404

    @pytest.mark.parametrize("host", ["luxejewel.app", "admin.luxejewel.app", "localhost"])
    def test_reserved_host_404(self, host):
        r = requests.get(f"{BASE_URL}/api/public/bootstrap", headers=_h(host), timeout=15)
        assert r.status_code == 404

    def test_no_tenant_id_query_accepted(self):
        # tenant_id must never resolve without a valid host header
        r = requests.get(
            f"{BASE_URL}/api/public/bootstrap",
            headers={"Accept": "application/json"},
            params={"tenant_id": "AURELIA"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_aurelia_cannot_see_noir_products(self):
        # NOIR products have ids like noi-*, AURELIA has aur-*
        aur = requests.get(
            f"{BASE_URL}/api/public/products", headers=_h(AURELIA_HOST), timeout=15
        ).json()
        noi = requests.get(
            f"{BASE_URL}/api/public/products", headers=_h(NOIR_HOST), timeout=15
        ).json()
        aur_ids = {p["id"] for p in aur}
        noi_ids = {p["id"] for p in noi}
        assert aur_ids.isdisjoint(noi_ids)
        assert all(pid.startswith("aur-") for pid in aur_ids)
        assert all(pid.startswith("noi-") for pid in noi_ids)

        # Fetching NOIR product via AURELIA host must 404
        any_noir_id = next(iter(noi_ids))
        r = requests.get(
            f"{BASE_URL}/api/public/products/{any_noir_id}",
            headers=_h(AURELIA_HOST),
            timeout=15,
        )
        assert r.status_code == 404
