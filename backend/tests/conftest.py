"""Shared pytest fixtures for jewelers-platform backend tests."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load frontend env (EXPO_PUBLIC_BACKEND_URL) then backend/.env if present.
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / "frontend" / ".env")
load_dotenv(_ROOT / "backend" / ".env")

# Defaults for local mock gate (overridden by real .env when present).
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("OTP_DEV_CODE", "123456")
os.environ.setdefault("MOCK_RAZORPAY", "1")
os.environ.setdefault("ALLOW_PAY_DEV_CONFIRM", "1")
os.environ.setdefault("MOCK_R2", "1")
os.environ.setdefault("JWT_SECRET", os.environ.get("JWT_SECRET", "test-jwt-secret-do-not-use-prod"))
os.environ.setdefault("MONGO_URL", os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017"))
os.environ.setdefault("REGISTRY_DB", os.environ.get("REGISTRY_DB", "platform_registry"))

AURELIA_HOST = "aurelia.luxejewel.app"
NOIR_HOST = "noir.luxejewel.app"
OTP_DEV_CODE = os.environ.get("OTP_DEV_CODE", "123456")


def tenant_headers(host: str, token: str | None = None) -> dict:
    h = {"X-Tenant-Host": host, "Accept": "application/json", "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


@pytest.fixture
def aurelia_headers():
    return tenant_headers(AURELIA_HOST)


@pytest.fixture
def noir_headers():
    return tenant_headers(NOIR_HOST)


@pytest.fixture
def base_url() -> str:
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    return url


@pytest.fixture
def otp_dev_code() -> str:
    return OTP_DEV_CODE
