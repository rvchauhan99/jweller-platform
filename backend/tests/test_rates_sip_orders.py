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
        assert d["gold"]["margin_inr_per_g"] == 100
        assert d["silver"]["margin_inr_per_g"] == 33.5
        assert isinstance(d["gold"]["inr_per_gram"], (int, float)) and d["gold"]["inr_per_gram"] > 0
        assert isinstance(d["silver"]["inr_per_gram"], (int, float)) and d["silver"]["inr_per_gram"] > 0
        assert d["gold"]["base_inr_per_gram"] > 0
        assert d["silver"]["base_inr_per_gram"] > 0
        assert d["usd_inr"] > 0
        assert d.get("rate_city") == "Hyderabad"
        assert isinstance(d["stale"], bool)
        assert d["stale"] is False  # freshly polled at startup
        assert "note" not in d
        # sell = base × (1+%) + absolute ₹/g (Hyderabad-oriented silver board)
        expected_sil = round(
            d["silver"]["base_inr_per_gram"] * 1.09 + 33.5, 2
        )
        assert d["silver"]["inr_per_gram"] == pytest.approx(expected_sil, abs=0.02)

    def test_noir_gold_margin_is_higher(self):
        a = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15).json()
        n = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(NOIR_HOST), timeout=15).json()
        assert n["gold"]["margin_pct"] == 7
        assert n["silver"]["margin_pct"] == 10
        assert n["gold"]["margin_inr_per_g"] == 50
        assert n["silver"]["margin_inr_per_g"] == 45
        # NOIR margin higher -> higher final INR/g on both metals
        assert n["gold"]["inr_per_gram"] > a["gold"]["inr_per_gram"]
        assert n["silver"]["inr_per_gram"] > a["silver"]["inr_per_gram"]
        # usd_inr / base must be identical (same spot for both tenants)
        assert n["usd_inr"] == a["usd_inr"]
        assert n["gold"]["base_inr_per_gram"] == a["gold"]["base_inr_per_gram"]

    def test_rates_math_matches_margin(self):
        a = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(AURELIA_HOST), timeout=15).json()
        n = requests.get(f"{BASE_URL}/api/public/rates", headers=_h(NOIR_HOST), timeout=15).json()
        # sell = base * (1+pct/100) + abs
        base = a["gold"]["base_inr_per_gram"]
        assert a["gold"]["inr_per_gram"] == pytest.approx(base * 1.06 + 100, abs=0.02)
        assert n["gold"]["inr_per_gram"] == pytest.approx(base * 1.07 + 50, abs=0.02)


# -------- SIP plans / enroll / pay --------
class TestSip:
    def _login(self, phone=None):
        phone = phone or f"9{uuid.uuid4().int % 10**9:09d}"
        h = _h(AURELIA_HOST)
        assert requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).status_code == 200
        code = os.environ.get("OTP_DEV_CODE", "123456")
        r = requests.post(
            f"{BASE_URL}/api/public/auth/otp/verify",
            headers=h,
            json={"phone": phone, "code": code},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return r.json()["access_token"], phone

    def _ah(self, token):
        return {**_h(AURELIA_HOST), "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

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
        token, phone = self._login()
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=self._ah(token),
            json={"plan_id": "gold-11-1", "name": "TEST User", "phone": phone, "preferred_day": 15},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["plan_id"] == "gold-11-1"
        assert e["tenure_months"] == 11
        assert e["metal"] == "gold"
        assert e["preferred_day"] == 15
        assert len(e["installments"]) == 11
        assert e["installments"][0]["status"] == "due"
        for inst in e["installments"][1:]:
            assert inst["status"] == "upcoming"
            # later installments land on preferred day (UTC calendar)
            from datetime import datetime

            due = datetime.fromisoformat(inst["due_date"].replace("Z", "+00:00"))
            assert due.day == 15

        lst = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers=self._ah(token),
            timeout=15,
        ).json()
        assert len(lst) == 1
        assert lst[0]["id"] == e["id"]
        assert lst[0]["summary"]["total_installments"] == 11
        assert lst[0]["summary"]["paid_installments"] == 0
        assert lst[0]["summary"]["current_rate"] is not None

    def test_metal_one_time_buy_credits_wallet(self):
        token, phone = self._login()
        buy = requests.post(
            f"{BASE_URL}/api/public/metal/buy",
            headers=self._ah(token),
            json={"metal": "gold", "amount_inr": 2000},
            timeout=15,
        )
        assert buy.status_code == 200, buy.text
        body = buy.json()
        assert body.get("purchase_id")
        assert body.get("razorpay_order_id")
        assert body.get("estimated_grams", 0) > 0
        conf = requests.post(
            f"{BASE_URL}/api/public/metal/buy/dev-confirm",
            headers=self._ah(token),
            json={"purchase_id": body["purchase_id"]},
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        wallet = conf.json()["wallet"]
        assert wallet["gold_grams"] > 0
        w = requests.get(f"{BASE_URL}/api/public/metal/wallet", headers=self._ah(token), timeout=15)
        assert w.status_code == 200
        assert w.json()["gold_grams"] == wallet["gold_grams"]

        sil = requests.post(
            f"{BASE_URL}/api/public/metal/buy",
            headers=self._ah(token),
            json={"metal": "silver", "amount_inr": 500},
            timeout=15,
        )
        assert sil.status_code == 200, sil.text
        conf_s = requests.post(
            f"{BASE_URL}/api/public/metal/buy/dev-confirm",
            headers=self._ah(token),
            json={"purchase_id": sil.json()["purchase_id"]},
            timeout=15,
        )
        assert conf_s.status_code == 200, conf_s.text
        assert conf_s.json()["wallet"]["silver_grams"] > 0

    def test_enroll_plan_not_found_404(self):
        token, phone = self._login()
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=self._ah(token),
            json={"plan_id": "does-not-exist", "name": "x", "phone": phone},
            timeout=15,
        )
        assert r.status_code == 404

    def test_pay_locks_rate_and_computes_grams(self):
        token, phone = self._login()
        e = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=self._ah(token),
            json={"plan_id": "gold-11-1", "name": "TEST Pay", "phone": phone},
            timeout=15,
        ).json()
        # create razorpay order then dev-confirm (mock pay path)
        assert requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=self._ah(token),
            json={},
            timeout=15,
        ).status_code == 200
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay/dev-confirm",
            headers=self._ah(token),
            json={},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        paid = r.json()
        assert paid["summary"]["paid_installments"] == 1
        assert paid["summary"]["grams_accrued"] > 0
        assert paid["summary"]["current_value"] is not None
        insts = paid["installments"]
        assert insts[0]["status"] == "paid"
        assert insts[0]["rate_locked"] is not None
        assert insts[0]["grams"] is not None
        expected = round(insts[0]["amount"] / insts[0]["rate_locked"], 4)
        assert abs(insts[0]["grams"] - expected) < 1e-4
        assert insts[1]["status"] == "due"

    def test_pay_wrong_customer_404(self):
        token_a, phone_a = self._login()
        token_b, _ = self._login()
        e = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=self._ah(token_a),
            json={"plan_id": "gold-flex", "name": "x", "phone": phone_a},
            timeout=15,
        ).json()
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=self._ah(token_b),
            json={},
            timeout=15,
        )
        assert r.status_code == 404


# -------- Orders --------
class TestOrders:
    def _login(self):
        phone = f"8{uuid.uuid4().int % 10**9:09d}"
        h = _h(AURELIA_HOST)
        requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).raise_for_status()
        code = os.environ.get("OTP_DEV_CODE", "123456")
        r = requests.post(
            f"{BASE_URL}/api/public/auth/otp/verify",
            headers=h,
            json={"phone": phone, "code": code},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()["access_token"]

    def _ah(self, token):
        return {**_h(AURELIA_HOST), "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _item(self):
        return {
            "product_id": "aur-rings-0",
            "name": "Solitaire Halo Ring",
            "price": 189000,
            "qty": 2,
            "image": None,
        }

    def _payload(self):
        return {
            "items": [self._item()],
            "contact": {"name": "TEST Buyer", "phone": "9999900000", "email": "t@t.com"},
            "address": {"line1": "1 Test Ln", "city": "Jaipur", "state": "RJ", "pincode": "302001"},
            "note": "TEST reserve",
        }

    def test_create_order_and_get(self):
        token = self._login()
        r = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers=self._ah(token),
            json=self._payload(),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "reserved"
        assert o["order_no"].startswith("RSV-")
        assert o["subtotal"] == 189000 * 2

        lst = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers=self._ah(token),
            timeout=15,
        ).json()
        assert len(lst) == 1
        assert lst[0]["id"] == o["id"]

    def test_empty_items_400(self):
        token = self._login()
        p = self._payload()
        p["items"] = []
        r = requests.post(
            f"{BASE_URL}/api/public/orders", headers=self._ah(token), json=p, timeout=15
        )
        assert r.status_code == 400


# -------- Cross-tenant isolation for orders & SIP --------
class TestTenantIsolationNew:
    def _login(self, host):
        phone = f"7{uuid.uuid4().int % 10**9:09d}"
        h = _h(host)
        requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).raise_for_status()
        code = os.environ.get("OTP_DEV_CODE", "123456")
        r = requests.post(f"{BASE_URL}/api/public/auth/otp/verify", headers=h, json={"phone": phone, "code": code}, timeout=15)
        r.raise_for_status()
        return r.json()["access_token"], phone

    def test_order_created_on_aurelia_not_visible_on_noir(self):
        token_a, _ = self._login(AURELIA_HOST)
        token_n, _ = self._login(NOIR_HOST)
        payload = {
            "items": [{"product_id": "aur-rings-0", "name": "x", "price": 100, "qty": 1}],
            "contact": {"name": "n", "phone": "9876543210"},
            "address": {"line1": "a", "city": "b", "pincode": "400001"},
        }
        r = requests.post(
            f"{BASE_URL}/api/public/orders",
            headers={**_h(AURELIA_HOST), "Authorization": f"Bearer {token_a}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        noir_orders = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers={**_h(NOIR_HOST), "Authorization": f"Bearer {token_n}"},
            timeout=15,
        ).json()
        assert noir_orders == []
        aur_orders = requests.get(
            f"{BASE_URL}/api/public/orders",
            headers={**_h(AURELIA_HOST), "Authorization": f"Bearer {token_a}"},
            timeout=15,
        ).json()
        assert len(aur_orders) == 1

    def test_sip_enrollment_on_aurelia_not_visible_on_noir(self):
        token_a, phone = self._login(AURELIA_HOST)
        token_n, _ = self._login(NOIR_HOST)
        r = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers={**_h(AURELIA_HOST), "Authorization": f"Bearer {token_a}", "Content-Type": "application/json"},
            json={"plan_id": "silver-12", "name": "x", "phone": phone},
            timeout=15,
        )
        assert r.status_code == 200
        n = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers={**_h(NOIR_HOST), "Authorization": f"Bearer {token_n}"},
            timeout=15,
        ).json()
        assert n == []
        a = requests.get(
            f"{BASE_URL}/api/public/sip/enrollments",
            headers={**_h(AURELIA_HOST), "Authorization": f"Bearer {token_a}"},
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


class TestSavingsSummary:
    def _login(self, phone=None):
        phone = phone or f"9{uuid.uuid4().int % 10**9:09d}"
        h = _h(AURELIA_HOST)
        assert requests.post(f"{BASE_URL}/api/public/auth/otp/request", headers=h, json={"phone": phone}, timeout=15).status_code == 200
        code = os.environ.get("OTP_DEV_CODE", "123456")
        r = requests.post(
            f"{BASE_URL}/api/public/auth/otp/verify",
            headers=h,
            json={"phone": phone, "code": code},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return r.json()["access_token"], phone

    def _ah(self, token):
        return {**_h(AURELIA_HOST), "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_summary_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/public/savings/summary", headers=_h(AURELIA_HOST), timeout=15)
        assert r.status_code == 401

    def test_summary_sip_and_onetime_totals(self):
        token, phone = self._login()
        h = self._ah(token)
        empty = requests.get(f"{BASE_URL}/api/public/savings/summary", headers=h, timeout=15)
        assert empty.status_code == 200, empty.text
        assert empty.json()["total_invested"] == 0

        buy = requests.post(
            f"{BASE_URL}/api/public/metal/buy",
            headers=h,
            json={"metal": "gold", "amount_inr": 2000},
            timeout=15,
        )
        assert buy.status_code == 200, buy.text
        purchase_id = buy.json()["purchase_id"]
        conf = requests.post(
            f"{BASE_URL}/api/public/metal/buy/dev-confirm",
            headers=h,
            json={"purchase_id": purchase_id},
            timeout=15,
        )
        assert conf.status_code == 200, conf.text
        wallet_g = conf.json()["wallet"]["gold_grams"]

        e = requests.post(
            f"{BASE_URL}/api/public/sip/enroll",
            headers=h,
            json={"plan_id": "gold-11-1", "name": "Summary Test", "phone": phone, "preferred_day": 10},
            timeout=15,
        ).json()
        assert requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay",
            headers=h,
            json={},
            timeout=15,
        ).status_code == 200
        pay_conf = requests.post(
            f"{BASE_URL}/api/public/sip/enrollments/{e['id']}/pay/dev-confirm",
            headers=h,
            json={},
            timeout=15,
        )
        assert pay_conf.status_code == 200, pay_conf.text
        paid_enrollment = pay_conf.json()
        sip_paid = paid_enrollment["summary"]["total_paid"]
        sip_grams = paid_enrollment["summary"]["grams_accrued"]

        summary = requests.get(f"{BASE_URL}/api/public/savings/summary", headers=h, timeout=15)
        assert summary.status_code == 200, summary.text
        body = summary.json()
        assert body["total_invested"] == pytest.approx(2000 + sip_paid, abs=0.02)
        assert body["gold_grams"] == pytest.approx(wallet_g + sip_grams, abs=0.0001)
        assert body["current_value"] >= body["total_invested"] * 0.5
        assert "gain" in body
