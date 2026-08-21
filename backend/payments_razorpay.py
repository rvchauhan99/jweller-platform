"""Razorpay Model B helpers — orders, UPI Autopay mandates, mock for tests."""
from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from typing import Any, Optional, Protocol


RATE_LOCK_TTL_SEC = 900  # 15 minutes


class RazorpayClient(Protocol):
    def create_order(self, *, amount_paise: int, currency: str, receipt: str, notes: dict) -> dict: ...

    def create_customer(self, *, name: str, contact: str, email: str = "", notes: Optional[dict] = None) -> dict: ...

    def create_mandate_order(
        self,
        *,
        amount_paise: int,
        currency: str,
        customer_id: str,
        max_amount_paise: int,
        frequency: str,
        expire_at: int,
        receipt: str,
        notes: dict,
    ) -> dict: ...

    def create_recurring_payment(
        self,
        *,
        amount_paise: int,
        currency: str,
        order_id: str,
        customer_id: str,
        token_id: str,
        email: str,
        contact: str,
        notes: Optional[dict] = None,
    ) -> dict: ...

    def cancel_token(self, token_id: str) -> dict: ...

    def fetch_payment(self, payment_id: str) -> dict: ...


class MockRazorpayClient:
    def create_order(self, *, amount_paise: int, currency: str, receipt: str, notes: dict) -> dict:
        oid = "order_mock_" + uuid.uuid4().hex[:14]
        return {
            "id": oid,
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
            "notes": notes,
            "status": "created",
        }

    def create_customer(self, *, name: str, contact: str, email: str = "", notes: Optional[dict] = None) -> dict:
        return {
            "id": "cust_mock_" + uuid.uuid4().hex[:12],
            "name": name,
            "contact": contact,
            "email": email,
            "notes": notes or {},
        }

    def create_mandate_order(
        self,
        *,
        amount_paise: int,
        currency: str,
        customer_id: str,
        max_amount_paise: int,
        frequency: str,
        expire_at: int,
        receipt: str,
        notes: dict,
    ) -> dict:
        oid = "order_mandate_" + uuid.uuid4().hex[:12]
        return {
            "id": oid,
            "amount": amount_paise,
            "currency": currency,
            "customer_id": customer_id,
            "receipt": receipt,
            "notes": notes,
            "status": "created",
            "token": {
                "max_amount": max_amount_paise,
                "frequency": frequency,
                "expire_at": expire_at,
            },
        }

    def create_recurring_payment(
        self,
        *,
        amount_paise: int,
        currency: str,
        order_id: str,
        customer_id: str,
        token_id: str,
        email: str,
        contact: str,
        notes: Optional[dict] = None,
    ) -> dict:
        return {
            "razorpay_payment_id": "pay_rec_" + uuid.uuid4().hex[:12],
            "razorpay_order_id": order_id,
            "razorpay_signature": "mock_recurring_sig",
            "status": "captured",
            "token_id": token_id,
            "notes": notes or {},
        }

    def cancel_token(self, token_id: str) -> dict:
        return {"id": token_id, "status": "cancelled"}

    def fetch_payment(self, payment_id: str) -> dict:
        return {
            "id": payment_id,
            "status": "captured",
            "token_id": "token_mock_" + payment_id[-8:],
            "notes": {},
        }


class LiveRazorpayClient:
    def __init__(self, key_id: str, key_secret: str):
        self.key_id = key_id
        self.key_secret = key_secret

    def _http(self):
        import httpx

        return httpx

    def create_order(self, *, amount_paise: int, currency: str, receipt: str, notes: dict) -> dict:
        r = self._http().post(
            "https://api.razorpay.com/v1/orders",
            auth=(self.key_id, self.key_secret),
            json={
                "amount": amount_paise,
                "currency": currency,
                "receipt": receipt,
                "notes": notes,
            },
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def create_customer(self, *, name: str, contact: str, email: str = "", notes: Optional[dict] = None) -> dict:
        payload: dict[str, Any] = {"name": name or "Customer", "contact": contact, "fail_existing": "0"}
        if email:
            payload["email"] = email
        if notes:
            payload["notes"] = notes
        r = self._http().post(
            "https://api.razorpay.com/v1/customers",
            auth=(self.key_id, self.key_secret),
            json=payload,
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def create_mandate_order(
        self,
        *,
        amount_paise: int,
        currency: str,
        customer_id: str,
        max_amount_paise: int,
        frequency: str,
        expire_at: int,
        receipt: str,
        notes: dict,
    ) -> dict:
        r = self._http().post(
            "https://api.razorpay.com/v1/orders",
            auth=(self.key_id, self.key_secret),
            json={
                "amount": amount_paise,
                "currency": currency,
                "customer_id": customer_id,
                "method": "upi",
                "token": {
                    "max_amount": max_amount_paise,
                    "frequency": frequency,
                    "expire_at": expire_at,
                },
                "receipt": receipt,
                "notes": notes,
            },
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def create_recurring_payment(
        self,
        *,
        amount_paise: int,
        currency: str,
        order_id: str,
        customer_id: str,
        token_id: str,
        email: str,
        contact: str,
        notes: Optional[dict] = None,
    ) -> dict:
        r = self._http().post(
            "https://api.razorpay.com/v1/payments/create/recurring",
            auth=(self.key_id, self.key_secret),
            json={
                "email": email or "sip@example.com",
                "contact": contact,
                "amount": amount_paise,
                "currency": currency,
                "order_id": order_id,
                "customer_id": customer_id,
                "token": token_id,
                "recurring": "1",
                "notes": notes or {},
            },
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def cancel_token(self, token_id: str) -> dict:
        r = self._http().put(
            f"https://api.razorpay.com/v1/tokens/{token_id}/cancel",
            auth=(self.key_id, self.key_secret),
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def fetch_payment(self, payment_id: str) -> dict:
        r = self._http().get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            auth=(self.key_id, self.key_secret),
            timeout=20,
        )
        r.raise_for_status()
        return r.json()


def use_mock_razorpay() -> bool:
    """Mock only when MOCK_RAZORPAY=1. Pytest sets this via conftest; local Test Mode uses 0."""
    return os.environ.get("MOCK_RAZORPAY", "1") == "1"


def get_razorpay_client(key_id: str, key_secret: str) -> RazorpayClient:
    if use_mock_razorpay() or not key_id or not key_secret:
        return MockRazorpayClient()
    return LiveRazorpayClient(key_id, key_secret)


def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def mock_webhook_signature(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def verify_payment_signature(
    *,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    key_secret: str,
) -> bool:
    """Checkout success HMAC: order_id|payment_id signed with key_secret."""
    if not (razorpay_order_id and razorpay_payment_id and razorpay_signature and key_secret):
        return False
    payload = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    digest = hmac.new(key_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, razorpay_signature)


def payment_signature_for_tests(
    *,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    key_secret: str,
) -> str:
    payload = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    return hmac.new(key_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def rate_lock_expired(locked_at_iso: Optional[str], ttl: int = RATE_LOCK_TTL_SEC) -> bool:
    if not locked_at_iso:
        return True
    try:
        from datetime import datetime, timezone

        dt = datetime.fromisoformat(locked_at_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() > ttl
    except Exception:
        return True


def allow_dev_confirm() -> bool:
    if os.environ.get("APP_ENV", "").lower() == "production":
        return False
    return os.environ.get("ALLOW_PAY_DEV_CONFIRM", "0") == "1"


def mandate_expire_unix(months: int = 24) -> int:
    return int(time.time()) + max(months, 1) * 30 * 24 * 3600
