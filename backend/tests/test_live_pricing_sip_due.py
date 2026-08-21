"""Iteration 2 backend tests: live piece pricing on products + SIP due-date reminders transition."""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

AURELIA_HOST = "aurelia.luxejewel.app"
NOIR_HOST = "noir.luxejewel.app"

PURITY_FACTORS = {"24K": 1.0, "22K": 0.916, "18K": 0.75, "14K": 0.585}


def _h(host: str) -> dict:
    return {"X-Tenant-Host": host, "Accept": "application/json"}


def _parse_iso(s: str) -> datetime:
    # Python 3.11 handles "+00:00" ok; handle trailing Z too
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# --- Feature 1: Live piece pricing on product list & detail ----------------
class TestLivePricing:
    def test_product_detail_has_live_price_and_pricing_breakdown(self):
        # aur-rings-0 = Solitaire Halo Ring, 4.2g, 18K, making_charge 12500 flat
        r = requests.get(
            f"{BASE_URL}/api/public/products/aur-rings-0",
            headers=_h(AURELIA_HOST),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "live_price" in d, "product missing live_price"
        assert isinstance(d["live_price"], (int, float)) and d["live_price"] > 0

        p = d.get("pricing")
        assert p is not None, "product missing pricing block"
        # required fields per spec
        for k in ("metal_value", "making", "purity", "purity_factor",
                  "rate_per_gram", "live_price", "stale", "fetched_at"):
            assert k in p, f"pricing missing key: {k}"

        # aur-rings-0 specifics
        assert p["purity"] == "18K"
        assert p["purity_factor"] == pytest.approx(0.75, rel=0, abs=1e-6)
        assert p["making"] == 12500  # flat making charge
        assert isinstance(p["stale"], bool)
        # fetched_at must be a valid ISO timestamp
        _parse_iso(p["fetched_at"])

    def test_live_price_math_matches_formula(self):
        # rate from /rates should be equal to pricing.rate_per_gram for gold pieces
        rates = requests.get(
            f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15
        ).json()
        gold_rate = rates["gold"]["inr_per_gram"]

        r = requests.get(
            f"{BASE_URL}/api/public/products/aur-rings-0",
            headers=_h(AURELIA_HOST),
            timeout=15,
        ).json()
        p = r["pricing"]

        # rate must match /rates
        assert p["rate_per_gram"] == pytest.approx(gold_rate, rel=0, abs=0.01)

        # metal_value ≈ round(4.2 * rate * 0.75)
        expected_metal = round(4.2 * gold_rate * 0.75)
        assert p["metal_value"] == expected_metal, (
            f"metal_value {p['metal_value']} != {expected_metal}"
        )
        # live_price ≈ round(metal + making) — since server rounds each separately,
        # allow ±1 rupee tolerance vs. sum of rounded parts.
        expected_live = round(4.2 * gold_rate * 0.75 + 12500)
        assert abs(r["live_price"] - expected_live) <= 1, (
            f"live_price {r['live_price']} not within ±1 of {expected_live}"
        )
        assert r["live_price"] == p["live_price"]

    def test_featured_list_items_have_live_price(self):
        r = requests.get(
            f"{BASE_URL}/api/public/products",
            headers=_h(AURELIA_HOST),
            params={"featured": "true"},
            timeout=15,
        )
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        for p in prods:
            assert "live_price" in p and isinstance(p["live_price"], (int, float))
            assert p["live_price"] > 0
            assert p.get("pricing") is not None
            assert p["pricing"]["live_price"] == p["live_price"]

    def test_purity_factor_correct_for_22k_product(self):
        # aur-necklaces-2 = Riviera Diamond Necklace, 18.4g, 22K, making 32000 flat
        r = requests.get(
            f"{BASE_URL}/api/public/products/aur-necklaces-2",
            headers=_h(AURELIA_HOST),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        p = d["pricing"]
        assert p["purity"] == "22K"
        assert p["purity_factor"] == pytest.approx(0.916, rel=0, abs=1e-6)
        assert p["making"] == 32000

        rates = requests.get(
            f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15
        ).json()
        gold_rate = rates["gold"]["inr_per_gram"]
        expected_metal = round(18.4 * gold_rate * 0.916)
        assert p["metal_value"] == expected_metal

    def test_noir_pricing_uses_higher_gold_margin(self):
        # Same-shape product: rings-0 exists on both tenants with identical weight/purity/making.
        aur = requests.get(
            f"{BASE_URL}/api/public/products/aur-rings-0",
            headers=_h(AURELIA_HOST),
            timeout=15,
        ).json()
        noi = requests.get(
            f"{BASE_URL}/api/public/products/noi-rings-0",
            headers=_h(NOIR_HOST),
            timeout=15,
        ).json()

        a_rate = aur["pricing"]["rate_per_gram"]
        n_rate = noi["pricing"]["rate_per_gram"]

        # NOIR gold margin 7% > AURELIA 6% => higher rate_per_gram
        assert n_rate > a_rate, (
            f"NOIR rate_per_gram ({n_rate}) should exceed AURELIA ({a_rate})"
        )
        ratio = n_rate / a_rate
        assert abs(ratio - (1.07 / 1.06)) < 0.001, f"unexpected ratio {ratio}"

        # NOIR live_price also higher (making is identical, metal_value differs)
        assert noi["live_price"] > aur["live_price"]
        assert noi["pricing"]["making"] == aur["pricing"]["making"] == 12500


# --- Feature 3: SIP due reminders (backend contract) ------------------------
class TestSipDueReminders:
    def _enroll(self, host, plan_id="gold-11-1"):
        guest_id = f"TEST_due_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=_h(host),
            json={"guest_id": guest_id, "plan_id": plan_id,
                  "name": "TEST DueNudge", "phone": "9999911111"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return guest_id, r.json()

    def test_first_installment_is_due_now(self):
        guest_id, e = self._enroll(AURELIA_HOST)
        # Backend seeds first installment as 'due' with due_date = now.
        first = e["installments"][0]
        assert first["status"] == "due"
        due_dt = _parse_iso(first["due_date"])
        now = datetime.now(timezone.utc)
        # due_date should be <= now (within a small clock-skew allowance)
        assert (due_dt - now).total_seconds() <= 5, (
            f"first installment due_date {first['due_date']} should be <= now {now.isoformat()}"
        )

        # And it should also come back via GET /enrollments for the same guest
        lst = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(lst) == 1
        due_insts = [
            i for i in lst[0]["installments"]
            if i["status"] == "due" and _parse_iso(i["due_date"]) <= datetime.now(timezone.utc)
        ]
        assert len(due_insts) == 1, "expected exactly one immediately-due installment"

    def test_pay_shifts_due_to_future_no_longer_immediately_due(self):
        guest_id, e = self._enroll(AURELIA_HOST)
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=_h(AURELIA_HOST),
            json={"guest_id": guest_id},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        paid = r.json()
        insts = paid["installments"]

        # previously-due is now paid
        assert insts[0]["status"] == "paid"
        assert insts[0]["paid_at"] is not None

        # the new due installment exists (index 2) and its due_date is in the FUTURE
        new_due = [i for i in insts if i["status"] == "due"]
        assert len(new_due) == 1, "expected exactly one due installment after pay"
        nd = new_due[0]
        assert nd["index"] == 2
        due_dt = _parse_iso(nd["due_date"])
        now = datetime.now(timezone.utc)
        delta_days = (due_dt - now).total_seconds() / 86400.0
        # ~30 days ahead (allow 25..35 for clock skew / rounding)
        assert 25 < delta_days < 35, (
            f"next due_date should be ~30 days ahead; got {delta_days:.2f} days"
        )

        # Re-fetch via GET to confirm the same state — i.e. reminder logic on the
        # frontend (status=='due' AND due_date<=now) would now yield zero nudges.
        lst = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=_h(AURELIA_HOST),
            params={"guest_id": guest_id},
            timeout=15,
        ).json()
        assert len(lst) == 1
        immediately_due = [
            i for i in lst[0]["installments"]
            if i["status"] == "due" and _parse_iso(i["due_date"]) <= datetime.now(timezone.utc)
        ]
        assert immediately_due == [], (
            "after paying, no installment should be both 'due' AND due_date<=now"
        )
