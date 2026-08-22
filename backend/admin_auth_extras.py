"""Admin forgot-password OTP + optional TOTP 2FA helpers."""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import re
import time
import uuid
from typing import Optional

import pyotp
from fastapi import HTTPException

from customer_auth import LogSmsProvider, SmsProvider, _dev_code
from deps import _decrypt_secret, _encrypt_secret

logger = logging.getLogger(__name__)

OTP_TTL_SEC = 300
OTP_MAX_ATTEMPTS = 5
OTP_RATE_WINDOW_SEC = 600
OTP_RATE_MAX = 5

_admin_otp_store: dict[str, dict] = {}
_admin_otp_rate: dict[str, list[float]] = {}

_sms: SmsProvider = LogSmsProvider()


def set_admin_sms_provider(provider: SmsProvider) -> None:
    global _sms
    _sms = provider


def validate_admin_password(password: str) -> None:
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include a letter and a digit")


def normalize_staff_phone(phone: Optional[str]) -> Optional[str]:
    if phone is None or str(phone).strip() == "":
        return None
    digits = re.sub(r"\D", "", str(phone))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise HTTPException(status_code=400, detail="Valid Indian mobile (+91) required")
    return "+91" + digits


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    local = digits[-10:] if len(digits) >= 10 else digits
    if len(local) < 4:
        return "****"
    return f"+91******{local[-4:]}"


def _otp_key(tenant_code: str, username: str) -> str:
    return f"admin_reset:{tenant_code.upper()}:{username.strip().lower()}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _rate_check(bucket: str) -> None:
    now = time.time()
    arr = [t for t in _admin_otp_rate.get(bucket, []) if now - t < OTP_RATE_WINDOW_SEC]
    if len(arr) >= OTP_RATE_MAX:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again later.")
    arr.append(now)
    _admin_otp_rate[bucket] = arr


def store_and_send_admin_reset_otp(
    *,
    tenant_code: str,
    username: str,
    phone_e164: str,
    business_name: str,
    client_ip: str,
) -> dict:
    _rate_check(f"admin:{tenant_code}:{username}")
    _rate_check(f"ip:{client_ip}")

    code = _dev_code() or f"{uuid.uuid4().int % 1000000:06d}"
    key = _otp_key(tenant_code, username)
    _admin_otp_store[key] = {
        "hash": _hash_code(code),
        "expires": time.time() + OTP_TTL_SEC,
        "attempts": 0,
        "phone": phone_e164,
    }
    _sms.send_otp(phone_e164, code, business_name)
    out: dict = {"ok": True, "message": "If an account exists with a phone on file, an OTP was sent."}
    if _dev_code():
        out["dev_otp"] = code
        out["dev_hint"] = f"Testing OTP: {code}"
    return out


def verify_admin_reset_otp(*, tenant_code: str, username: str, code: str) -> None:
    key = _otp_key(tenant_code, username)
    row = _admin_otp_store.get(key)
    if not row or time.time() > row["expires"]:
        _admin_otp_store.pop(key, None)
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    row["attempts"] = int(row.get("attempts") or 0) + 1
    if row["attempts"] > OTP_MAX_ATTEMPTS:
        _admin_otp_store.pop(key, None)
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new OTP.")
    if _hash_code(code.strip()) != row["hash"]:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    _admin_otp_store.pop(key, None)


def encrypt_totp_secret(plain_base32: str) -> str:
    return _encrypt_secret(plain_base32)


def decrypt_totp_secret(token: str) -> str:
    return _decrypt_secret(token)


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(*, secret: str, username: str, tenant_code: str, issuer: str = "Jeweler Admin") -> str:
    label = f"{tenant_code}:{username}"
    return pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    if not code or not re.fullmatch(r"\d{6}", code.strip()):
        return False
    return bool(pyotp.TOTP(secret).verify(code.strip(), valid_window=1))


def qr_png_data_url(otpauth_url: str) -> str:
    import qrcode

    img = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


# Keep customer set_sms_provider import used if tests swap providers for both
__all__ = [
    "validate_admin_password",
    "normalize_staff_phone",
    "mask_phone",
    "store_and_send_admin_reset_otp",
    "verify_admin_reset_otp",
    "encrypt_totp_secret",
    "decrypt_totp_secret",
    "new_totp_secret",
    "totp_uri",
    "verify_totp",
    "qr_png_data_url",
    "set_admin_sms_provider",
]
