"""Backend tests for new features: live rates, SIP, orders, and tenant isolation."""
import os
import uuid
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


# -------- Live rates --------
class TestRates:
    def test_aurelia_rates_shape_and_margin(self):
        r = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("gold", "silver", "usd_inr", "fetched_at", "stale", "currency"):
            assert k in d, f"missing {k}"
        assert d["gold"]["metal"] == "Gold"
        assert d["silver"]["metal"] == "Silver"
        assert d["gold"]["margin_pct"] == 6
        assert d["silver"]["margin_pct"] == 9
        assert isinstance(d["gold"]["inr_per_gram"], (int, float)) and d["gold"]["inr_per_gram"] > 0
        assert isinstance(d["silver"]["inr_per_gram"], (int, float)) and d["silver"]["inr_per_gram"] > 0
        assert d["usd_inr"] > 0
        assert isinstance(d["stale"], bool)
        assert d["stale"] is False  # freshly polled at startup

    def test_noir_gold_margin_is_higher(self):
        a = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15).json()
        n = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(NOIR_HOST), timeout=15).json()
        assert n["gold"]["margin_pct"] == 7
        assert n["silver"]["margin_pct"] == 10
        # NOIR margin higher -> higher final INR/g on both metals
        assert n["gold"]["inr_per_gram"] > a["gold"]["inr_per_gram"]
        assert n["silver"]["inr_per_gram"] > a["silver"]["inr_per_gram"]
        # usd_inr must be identical (same spot for both tenants)
        assert n["usd_inr"] == a["usd_inr"]

    def test_rates_math_matches_margin(self):
        a = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15).json()
        n = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(NOIR_HOST), timeout=15).json()
        # a_gold = base * 1.06, n_gold = base * 1.07  => n/a == 1.07/1.06
        ratio = n["gold"]["inr_per_gram"] / a["gold"]["inr_per_gram"]
        assert abs(ratio - (1.07 / 1.06)) < 0.001, f"unexpected ratio {ratio}"


# -------- SIP plans / enroll / pay --------
class TestSip:
    def test_plans_seeded(self):
        r = requests.get(f"{BASE_URL}/api/public/sip/plans", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 200
        plans = r.json()
        ids = {p["id"] for p in plans}
        assert {"gold-11-1", "gold-flex", "silver-12"}.issubset(ids)
        p11 = next(p for p in plans if p["id"] == "gold-11-1")
        assert p11["tenure_months"] == 11
        assert p11["bonus_months"] == 1
        assert p11["metal"] == "gold"

    def test_enroll_creates_11_installments(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id, "plan_id": "gold-11-1", "name": "TEST User", "phone": "9999999999"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["plan_id"] == "gold-11-1"
        assert e["tenure_months"] == 11
        assert e["metal"] == "gold"
        assert len(e["installments"]) == 11
        assert e["installments"][0]["status"] == "due"
        for inst in e["installments"][1:]:
            assert inst["status"] == "upcoming"

        # GET should reveal it in the guest's list with summary
        lst = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(lst) == 1
        assert lst[0]["id"] == e["id"]
        assert lst[0]["summary"]["total_installments"] == 11
        assert lst[0]["summary"]["paid_installments"] == 0
        assert lst[0]["summary"]["current_rate"] is not None

    def test_enroll_plan_not_found_404(self):
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(AURELIA_HOST),
            json={"guest_id": "TEST_x", "plan_id": "does-not-exist", "name": "x", "phone": "9"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_pay_locks_rate_and_computes_grams(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        e = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id, "plan_id": "gold-11-1", "name": "TEST Pay", "phone": "9"},
            timeout=15,
        ).json()
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        paid = r.json()
        assert paid["summary"]["paid_installments"] == 1
        assert paid["summary"]["grams_accrued"] > 0
        assert paid["summary"]["current_value"] is not None
        # installment 1 should be paid, installment 2 should now be 'due'
        insts = paid["installments"]
        assert insts[0]["status"] == "paid"
        assert insts[0]["rate_locked"] is not None
        assert insts[0]["grams"] is not None
        # math: grams == amount / rate_locked (rounded 4dp)
        expected = round(insts[0]["amount"] / insts[0]["rate_locked"], 4)
        assert abs(insts[0]["grams"] - expected) < 1e-4
        assert insts[1]["status"] == "due"

    def test_pay_wrong_guest_id_404(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        e = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id, "plan_id": "gold-flex", "name": "x", "phone": "9"},
            timeout=15,
        ).json()
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=_h(AURELIA_HOST),
            json={"guest_id": "TEST_someone_else"},
            timeout=15,
        )
        assert r.status_code == 404


# -------- Orders --------
class TestOrders:
    def _item(self):
        return {
            "product_id": "aur-rings-0",
            "name": "Solitaire Halo Ring",
            "price": 189000,
            "qty": 2,
            "image": None,
        }

    def _payload(self, guest_id):
        return {
            "guest_id": guest_id,
            "items": [self._item()],
            "contact": {"name": "TEST Buyer", "phone": "9999900000", "email": "t@t.com"},
            "address": {"line1": "1 Test Ln", "city": "Jaipur", "state": "RJ", "pincode": "302001"},
            "note": "TEST reserve",
        }

    def test_create_order_and_get(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers=_h(AURELIA_HOST),
            json=self._payload(guest_id),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "reserved"
        assert o["order_no"].startswith("RSV-")
        assert o["subtotal"] == 189000 * 2
        assert o["guest_id"] == guest_id

        # persistence check
        lst = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(lst) == 1
        assert lst[0]["id"] == o["id"]

    def test_empty_items_400(self):
        p = self._payload(f"TEST_g_{uuid.uuid4().hex[:6]}")
        p["items"] = []
        r = requests.post(
            f"{BASE_URL}/api/public/orders", headers=_h(AURELIA_HOST), json=p, timeout=15
        )
        assert r.status_code == 400


# -------- Cross-tenant isolation for orders & SIP --------
class TestTenantIsolationNew:
    def test_order_created_on_aurelia_not_visible_on_noir(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        payload = {
            "guest_id": guest_id,
            "items": [{"product_id": "aur-rings-0", "name": "x", "price": 100, "qty": 1}],
            "contact": {"name": "n", "phone": "9"},
            "address": {"line1": "a", "city": "b", "pincode": "1"},
        }
        r = requests.post(
            f"{BASE_URL}/api/public/orders", headers=_h(AURELIA_HOST), json=payload, timeout=15
        )
        assert r.status_code == 200
        noir_orders = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers=_h(NOIR_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert noir_orders == []
        aur_orders = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(aur_orders) == 1

    def test_sip_enrollment_on_aurelia_not_visible_on_noir(self):
        guest_id = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id, "plan_id": "silver-12", "name": "x", "phone": "9"},
            timeout=15,
        )
        assert r.status_code == 200
        n = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=_h(NOIR_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert n == []
        a = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(a) == 1

    def test_rates_endpoint_unknown_host_404(self):
        r = requests.get(
            f"{BASE_URL}/api/public/rates", headers=_h("bogus.luxejewel.app"), timeout=15
        )
        assert r.status_code == 404

    def test_rates_endpoint_reserved_host_404(self):
        r = requests.get(
            f"{BASE_URL}/api/public/rates", headers=_h("admin.luxejewel.app"), timeout=15
        )
        assert r.status_code == 404
