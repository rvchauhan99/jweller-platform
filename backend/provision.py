"""In-process tenant provisioning (no Redis / no worker). Shared by platform create + demo seed patterns."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from seed_data import (
    AURELIA_THEME,
    HERO_LIGHT,
    NOIR_THEME,
    SECTIONS,
    _categories,
    _products,
    _sip_plans,
    _tenant,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


PRESET_THEMES: dict[str, dict] = {
    "classic-gold": AURELIA_THEME,
    "modern-minimal": {
        "preset_id": "modern-minimal",
        "colors": {
            "primary": "#111111",
            "onPrimary": "#FFFFFF",
            "secondary": "#444444",
            "accent": "#111111",
            "background": "#FFFFFF",
            "surface": "#F7F7F7",
            "text": "#111111",
            "muted": "#666666",
            "border": "#E5E5E5",
            "headerBg": "#FFFFFF",
            "headerText": "#111111",
            "footerBg": "#111111",
            "footerText": "#FFFFFF",
        },
        "fonts": {"heading": "Inter", "body": "Inter"},
        "mode": "light",
    },
    "royal": {
        "preset_id": "royal",
        "colors": {
            "primary": "#5C0A1A",
            "onPrimary": "#F5E6C8",
            "secondary": "#1A2744",
            "accent": "#C9A227",
            "background": "#F8F4EC",
            "surface": "#FFFFFF",
            "text": "#1A1520",
            "muted": "#6B5E4E",
            "border": "#E2D6C4",
            "headerBg": "#1A2744",
            "headerText": "#F5E6C8",
            "footerBg": "#1A1520",
            "footerText": "#C9A227",
        },
        "fonts": {"heading": "Playfair Display", "body": "DM Sans"},
        "mode": "light",
    },
    "high-contrast": {
        "preset_id": "high-contrast",
        "colors": {
            "primary": "#000000",
            "onPrimary": "#FFFFFF",
            "secondary": "#000000",
            "accent": "#000000",
            "background": "#FFFFFF",
            "surface": "#FFFFFF",
            "text": "#000000",
            "muted": "#333333",
            "border": "#000000",
            "headerBg": "#FFFFFF",
            "headerText": "#000000",
            "footerBg": "#000000",
            "footerText": "#FFFFFF",
        },
        "fonts": {"heading": "Inter", "body": "Inter"},
        "mode": "light",
    },
    "dark-royal": NOIR_THEME,
}


def normalize_tenant_code(code: str) -> str:
    c = (code or "").strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{3,12}", c):
        raise ValueError("tenant_code must be 3–12 chars A-Z0-9")
    return c


def normalize_subdomain(slug: str) -> str:
    s = (slug or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?", s):
        raise ValueError("Invalid subdomain slug")
    return s


def merge_theme(preset_id: str, color_overrides: Optional[dict] = None) -> dict:
    base = PRESET_THEMES.get(preset_id) or PRESET_THEMES["classic-gold"]
    theme = {
        "preset_id": base.get("preset_id", preset_id),
        "colors": dict(base.get("colors") or {}),
        "fonts": dict(base.get("fonts") or {}),
        "mode": base.get("mode", "light"),
    }
    if color_overrides:
        theme["colors"].update({k: v for k, v in color_overrides.items() if v})
    return theme


async def provision_tenant(
    *,
    registry,
    client,
    hash_password,
    business_name: str,
    tenant_code: str,
    subdomain: str,
    plan: str = "basic",
    theme: Optional[dict] = None,
    owner_username: str = "owner",
    owner_password: str = "",
    tagline: str = "",
    primary_host_suffix: str = "luxejewel.app",
) -> dict[str, Any]:
    """Idempotent create: registry tenant + site + snapshot + tenant DB + owner admin + job."""
    code = normalize_tenant_code(tenant_code)
    sub = normalize_subdomain(subdomain)
    plan = (plan or "basic").lower()
    if plan not in ("basic", "pro", "enterprise"):
        plan = "basic"
    name = (business_name or code).strip()
    uname = (owner_username or "owner").strip().lower()
    if not owner_password or len(owner_password) < 8:
        raise ValueError("Owner password must be at least 8 characters")

    existing = await registry.tenants.find_one({"$or": [{"_id": code}, {"tenant_code": code}, {"subdomain": sub}]})
    if existing and existing.get("status") not in ("provisioning",):
        raise ValueError("tenant_code or subdomain already exists")

    hostname = f"{sub}.{primary_host_suffix}"
    host_taken = await registry.tenant_sites.find_one({"hostname": hostname})
    if host_taken and host_taken.get("tenant_id") != code:
        raise ValueError(f"Hostname {hostname} already registered")

    preset_id = (theme or {}).get("preset_id") or "classic-gold"
    colors = (theme or {}).get("colors") if theme else None
    theme_doc = merge_theme(preset_id, colors)
    tag = tagline or f"{name} — fine jewellery"
    site_theme, site_cms, snapshot = _tenant(
        code,
        name,
        sub,
        theme_doc,
        HERO_LIGHT,
        tag,
        f"{name} is a jeweler on the LuxeJewel platform.",
        {"metal": "Gold 22K", "value": "—", "note": "Live rates after margins"},
    )

    job_id = str(uuid.uuid4())
    tenant_doc = {
        "_id": code,
        "tenant_code": code,
        "business_name": name,
        "mongo_db_name": f"tenant_{code.lower()}",
        "r2_prefix": code.lower(),
        "subdomain": sub,
        "status": "provisioning",
        "plan": plan,
        "rate_margins": {
            "gold_pct": 6,
            "silver_pct": 9,
            "gold_inr_per_g": 100,
            "silver_inr_per_g": 33.5,
        },
        "rate_city": None,
        "rate_state": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await registry.tenants.update_one({"_id": code}, {"$set": tenant_doc}, upsert=True)

    await registry.provisioning_jobs.update_one(
        {"idempotency_key": f"provision:{code}"},
        {
            "$set": {
                "id": job_id,
                "tenant_id": code,
                "step": "seed_db",
                "status": "running",
                "error_log": None,
                "retry_count": 0,
                "idempotency_key": f"provision:{code}",
                "updated_at": _now(),
            },
            "$setOnInsert": {"created_at": _now()},
        },
        upsert=True,
    )

    try:
        site = {
            "hostname": hostname,
            "tenant_id": code,
            "kind": "subdomain",
            "status": "active",
            "is_primary": True,
        }
        await registry.tenant_sites.update_one({"hostname": hostname}, {"$set": site}, upsert=True)

        await registry.theme_public_snapshots.update_one(
            {"tenant_id": code}, {"$set": snapshot}, upsert=True
        )

        tdb = client[tenant_doc["mongo_db_name"]]
        await tdb.site_theme.update_one({"_id": "theme"}, {"$set": site_theme}, upsert=True)
        await tdb.site_cms.update_one({"_id": "cms"}, {"$set": site_cms}, upsert=True)
        for c in _categories():
            await tdb.categories.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        prefix = code.lower()[:3]
        for p in _products(prefix):
            await tdb.products.update_one({"id": p["id"]}, {"$set": p}, upsert=True)
        for plan_row in _sip_plans():
            await tdb.sip_plans.update_one({"id": plan_row["id"]}, {"$set": plan_row}, upsert=True)

        await registry.tenant_admins.update_one(
            {"tenant_code": code, "username": uname},
            {
                "$set": {
                    "tenant_code": code,
                    "tenant_id": code,
                    "username": uname,
                    "role": "owner",
                    "password_hash": hash_password(owner_password),
                    "disabled": False,
                    "updated_at": _now(),
                },
                "$setOnInsert": {"created_at": _now()},
            },
            upsert=True,
        )

        await registry.tenants.update_one(
            {"_id": code},
            {"$set": {"status": "active", "updated_at": _now()}},
        )
        await registry.provisioning_jobs.update_one(
            {"idempotency_key": f"provision:{code}"},
            {"$set": {"step": "activate", "status": "done", "updated_at": _now()}},
        )
    except Exception as exc:
        await registry.provisioning_jobs.update_one(
            {"idempotency_key": f"provision:{code}"},
            {
                "$set": {
                    "status": "failed",
                    "error_log": str(exc),
                    "updated_at": _now(),
                },
                "$inc": {"retry_count": 1},
            },
        )
        raise

    return {
        "tenant_id": code,
        "tenant_code": code,
        "status": "active",
        "hostname": hostname,
        "job_id": job_id,
    }
