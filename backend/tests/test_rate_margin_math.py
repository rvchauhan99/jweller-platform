"""Unit tests for sell-rate math: base × (1+%) + absolute ₹/g. No live HTTP."""
from decimal import Decimal

import pytest

from deps import _base_inr_per_gram, _margin_parts, _sell_inr_per_gram


def test_base_inr_per_gram_from_usd_oz():
    # 31.1034768 g/oz, 100 USD/oz, 80 INR → 100*80/31.1034768 ≈ 257.21
    base = _base_inr_per_gram("100", "80")
    assert base == Decimal("257.21")


def test_sell_with_pct_only():
    base = Decimal("212.57")
    assert _sell_inr_per_gram(base, Decimal("9"), Decimal("0")) == pytest.approx(231.70, abs=0.01)


def test_sell_with_city_premium_matches_hyderabad_style():
    base = Decimal("212.57")
    # 9% + ₹33.5/g ≈ 231.70 + 33.5 = 265.20 (Hyderabad-style board)
    sell = _sell_inr_per_gram(base, Decimal("9"), Decimal("33.5"))
    assert sell == pytest.approx(265.20, abs=0.01)


def test_margin_parts_defaults():
    pct, abs_inr = _margin_parts({}, "silver")
    assert pct == Decimal("0")
    assert abs_inr == Decimal("0")
    pct, abs_inr = _margin_parts({"silver_pct": 9, "silver_inr_per_g": 33.5}, "silver")
    assert pct == Decimal("9")
    assert abs_inr == Decimal("33.5")
