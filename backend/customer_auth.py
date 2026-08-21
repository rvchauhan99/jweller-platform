"""Customer OTP (+91) + JWT (aud: customer). SMS via pluggable provider."""
from __future__ import annotations

import hashlib
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Protocol

import jwt as _pyjwt
from fastapi import Header, HTTPException, Request

logger = logging.getLogger(__name__)

CUSTOMER_AUD = "customer"
CUSTOMER_JWT_EXPIRE_MIN = 60 * 24 * 30  # 30 days
OTP_TTL_SEC = 300
OTP_MAX_ATTEMPTS = 5
OTP_RATE_WINDOW_SEC = 600
# Per-phone stays at 5; IP is looser in non-prod so parallel pytest does not collide.
OTP_RATE_MAX_PHONE = 5
OTP_RATE_MAX_IP = 200 if os.environ.get("APP_ENV", "").lower() in ("test", "development") else 5

_otp_store: dict[str, dict] = {}
_otp_rate: dict[str, list[float]] = {}


class SmsProvider(Protocol):
    def send_otp(self, phone_e164: str, code: str, business_name: str) -> None: ...


class LogSmsProvider:
    """Non-prod / mock: log OTP instead of sending SMS."""

    def send_otp(self, phone_e164: str, code: str, business_name: str) -> None:
        logger.info("[SMS OTP] to=%s business=%s code=%s", phone_e164, business_name, code)


_sms: SmsProvider = LogSmsProvider()


def set_sms_provider(provider: SmsProvider) -> None:
    global _sms
    _sms = provider


def normalize_in_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise HTTPException(status_code=400, detail="Valid Indian mobile (+91) required")
    return "+91" + digits


def phone_local(phone_e164: str) -> str:
    return phone_e164[-10:]


def _otp_key(tenant_id: str, phone_e164: str) -> str:
    return f"otp:{tenant_id}:{phone_e164}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _rate_check(bucket: str) -> None:
    now = time.time()
    limit = OTP_RATE_MAX_IP if bucket.startswith("ip:") else OTP_RATE_MAX_PHONE
    arr = [t for t in _otp_rate.get(bucket, []) if now - t < OTP_RATE_WINDOW_SEC]
    if len(arr) >= limit:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again later.")
    arr.append(now)
    _otp_rate[bucket] = arr


def _dev_code() -> Optional[str]:
    env = os.environ.get("APP_ENV", "development").lower()
    if env == "production":
        return None
    # Non-prod: fixed testing OTP for every customer create/login (default 123456).
    return os.environ.get("OTP_DEV_CODE") or "123456"


def issue_customer_token(*, customer_id: str, tenant_id: str, site_hostname: str, jwt_secret: str) -> str:
    now = datetime.now(timezone.utc)
    return _pyjwt.encode(
        {
            "sub": customer_id,
            "tenant_id": tenant_id,
            "site_hostname": site_hostname,
            "role": "customer",
            "aud": CUSTOMER_AUD,
            "iss": "jewelers-platform",
            "iat": now,
            "exp": now + timedelta(minutes=CUSTOMER_JWT_EXPIRE_MIN),
        },
        jwt_secret,
        algorithm="HS256",
    )


async def store_and_send_otp(
    *,
    tenant_id: str,
    phone_e164: str,
    business_name: str,
    client_ip: str,
) -> dict:
    _rate_check(f"phone:{tenant_id}:{phone_e164}")
    _rate_check(f"ip:{client_ip}")

    code = _dev_code() or f"{uuid.uuid4().int % 1000000:06d}"
    key = _otp_key(tenant_id, phone_e164)
    _otp_store[key] = {
        "hash": _hash_code(code),
        "exp": time.time() + OTP_TTL_SEC,
        "attempts": 0,
    }
    _sms.send_otp(phone_e164, code, business_name)
    out = {"ok": True, "expires_in": OTP_TTL_SEC, "phone": phone_e164}
    # Never return OTP in production responses.
    if _dev_code():
        out["dev_hint"] = "This is a testing app. Below is your OTP."
        out["dev_otp"] = code
    return out


def verify_otp_code(*, tenant_id: str, phone_e164: str, code: str) -> None:
    key = _otp_key(tenant_id, phone_e164)
    row = _otp_store.get(key)
    if not row:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")
    if time.time() > row["exp"]:
        _otp_store.pop(key, None)
        raise HTTPException(status_code=400, detail="OTP expired")
    row["attempts"] += 1
    if row["attempts"] > OTP_MAX_ATTEMPTS:
        _otp_store.pop(key, None)
        raise HTTPException(status_code=400, detail="Too many invalid attempts")
    if _hash_code(code.strip()) != row["hash"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    _otp_store.pop(key, None)


def decode_customer_token(token: str, jwt_secret: str) -> dict:
    try:
        return _pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience=CUSTOMER_AUD,
            options={"require": ["exp", "iat", "aud", "sub", "tenant_id"]},
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired customer session")


def bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()
