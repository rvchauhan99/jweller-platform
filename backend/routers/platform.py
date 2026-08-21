"""Platform console API — JWT aud=platform. No Redis."""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt as _pyjwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

import provision as prov

JWT_ALG = "HS256"
JWT_AUD_PLATFORM = "platform"
JWT_EXPIRE_MIN = 60 * 12

router = APIRouter(prefix="/api/platform", tags=["platform"])

_registry = None
_client = None
_jwt_secret = None
_hash_password = None
_verify_password = None


def bind(*, registry, client, jwt_secret: str, hash_password, verify_password):
    global _registry, _client, _jwt_secret, _hash_password, _verify_password
    _registry = registry
    _client = client
    _jwt_secret = jwt_secret
    _hash_password = hash_password
    _verify_password = verify_password


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
            continue
        if hasattr(v, "__class__") and v.__class__.__name__ == "ObjectId":
            out[k] = str(v)
        else:
            out[k] = v
    return out


class PlatformLoginIn(BaseModel):
    email: str
    password: str


class ThemeIn(BaseModel):
    preset_id: str = "classic-gold"
    colors: Optional[dict[str, str]] = None


class CreateTenantIn(BaseModel):
    business_name: str
    tenant_code: str
    subdomain: str
    plan: str = "basic"
    theme: ThemeIn = Field(default_factory=ThemeIn)
    owner_username: str = "owner"
    owner_password: str
    tagline: Optional[str] = None


class SuspendIn(BaseModel):
    reason: Optional[str] = None


class SiteIn(BaseModel):
    hostname: str
    kind: str = "custom"
    is_primary: bool = False


def _issue_platform_token(admin: dict) -> str:
    now = datetime.now(timezone.utc)
    return _pyjwt.encode(
        {
            "sub": admin.get("email"),
            "email": admin.get("email"),
            "name": admin.get("name") or admin.get("email"),
            "aud": JWT_AUD_PLATFORM,
            "iat": now,
            "exp": now + timedelta(minutes=JWT_EXPIRE_MIN),
        },
        _jwt_secret,
        algorithm=JWT_ALG,
    )


async def get_platform_ctx(authorization: Optional[str] = Header(None)):
    err = HTTPException(status_code=401, detail="Invalid or expired session")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise err
    token = authorization.split(" ", 1)[1]
    try:
        claims = _pyjwt.decode(
            token,
            _jwt_secret,
            algorithms=[JWT_ALG],
            audience=JWT_AUD_PLATFORM,
            options={"require": ["exp", "iat", "aud", "email"]},
        )
    except Exception:
        raise err
    row = await _registry.platform_super_admins.find_one({"email": claims["email"].lower()})
    if not row or row.get("disabled"):
        raise err
    return {"email": row["email"], "name": row.get("name"), "admin": row}


@router.post("/auth/login")
async def platform_login(body: PlatformLoginIn):
    email = body.email.strip().lower()
    row = await _registry.platform_super_admins.find_one({"email": email})
    if not row or row.get("disabled") or not _verify_password(body.password, row.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _issue_platform_token(row)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MIN * 60,
        "email": row["email"],
        "name": row.get("name") or row["email"],
    }


@router.get("/me")
async def platform_me(ctx=Depends(get_platform_ctx)):
    return {"email": ctx["email"], "name": ctx["name"]}


@router.get("/tenants")
async def list_tenants(ctx=Depends(get_platform_ctx)):
    rows = await _registry.tenants.find({}).sort("created_at", -1).to_list(500)
    out = []
    for t in rows:
        primary = await _registry.tenant_sites.find_one({"tenant_id": t["_id"], "is_primary": True})
        if not primary:
            primary = await _registry.tenant_sites.find_one({"tenant_id": t["_id"]})
        out.append(
            {
                "id": t["_id"],
                "tenant_code": t.get("tenant_code"),
                "business_name": t.get("business_name"),
                "subdomain": t.get("subdomain"),
                "status": t.get("status"),
                "plan": t.get("plan"),
                "primary_hostname": (primary or {}).get("hostname"),
                "created_at": t.get("created_at"),
            }
        )
    return out


@router.post("/tenants")
async def create_tenant(body: CreateTenantIn, ctx=Depends(get_platform_ctx)):
    try:
        result = await prov.provision_tenant(
            registry=_registry,
            client=_client,
            hash_password=_hash_password,
            business_name=body.business_name,
            tenant_code=body.tenant_code,
            subdomain=body.subdomain,
            plan=body.plan,
            theme=body.theme.model_dump(),
            owner_username=body.owner_username,
            owner_password=body.owner_password,
            tagline=body.tagline or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provision failed: {e}")
    return result


@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, ctx=Depends(get_platform_ctx)):
    t = await _registry.tenants.find_one({"_id": tenant_id.upper()})
    if not t:
        t = await _registry.tenants.find_one({"_id": tenant_id})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    sites = await _registry.tenant_sites.find({"tenant_id": t["_id"]}).to_list(50)
    job = await _registry.provisioning_jobs.find_one({"idempotency_key": f"provision:{t['_id']}"})
    return {
        **{k: v for k, v in t.items() if k != "payment_gateway" and k != "_id"},
        "id": t["_id"],
        "sites": [_clean(dict(s)) for s in sites],
        "job": _clean(dict(job)) if job else None,
        "has_gateway": bool((t.get("payment_gateway") or {}).get("enabled")),
    }


@router.get("/tenants/{tenant_id}/jobs")
async def get_jobs(tenant_id: str, ctx=Depends(get_platform_ctx)):
    tid = tenant_id.upper()
    jobs = await _registry.provisioning_jobs.find({"tenant_id": tid}).sort("created_at", -1).to_list(20)
    return [_clean(dict(j)) for j in jobs]


@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(tenant_id: str, body: Optional[SuspendIn] = None, ctx=Depends(get_platform_ctx)):
    tid = tenant_id.upper()
    t = await _registry.tenants.find_one({"_id": tid})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    reason = (body.reason if body else None)
    await _registry.tenants.update_one(
        {"_id": tid},
        {"$set": {"status": "suspended", "suspended_reason": reason, "updated_at": _now_iso()}},
    )
    return {"id": tid, "status": "suspended"}


@router.post("/tenants/{tenant_id}/activate")
async def activate_tenant(tenant_id: str, ctx=Depends(get_platform_ctx)):
    tid = tenant_id.upper()
    t = await _registry.tenants.find_one({"_id": tid})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await _registry.tenants.update_one(
        {"_id": tid},
        {"$set": {"status": "active", "suspended_reason": None, "updated_at": _now_iso()}},
    )
    return {"id": tid, "status": "active"}


@router.get("/tenants/{tenant_id}/sites")
async def list_sites(tenant_id: str, ctx=Depends(get_platform_ctx)):
    tid = tenant_id.upper()
    sites = await _registry.tenant_sites.find({"tenant_id": tid}).to_list(50)
    return [_clean(dict(s)) for s in sites]


@router.post("/tenants/{tenant_id}/sites")
async def add_site(tenant_id: str, body: SiteIn, ctx=Depends(get_platform_ctx)):
    tid = tenant_id.upper()
    t = await _registry.tenants.find_one({"_id": tid})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    host = body.hostname.strip().lower()
    host = re.sub(r"^https?://", "", host).split("/")[0].split(":")[0]
    if not host or "." not in host:
        raise HTTPException(status_code=400, detail="Invalid hostname")
    taken = await _registry.tenant_sites.find_one({"hostname": host})
    if taken:
        raise HTTPException(status_code=409, detail="Hostname already registered")
    kind = body.kind if body.kind in ("subdomain", "custom", "preview") else "custom"
    status = "active" if kind == "subdomain" else "pending_dns"
    if body.is_primary:
        await _registry.tenant_sites.update_many({"tenant_id": tid}, {"$set": {"is_primary": False}})
    doc = {
        "hostname": host,
        "tenant_id": tid,
        "kind": kind,
        "status": status,
        "is_primary": bool(body.is_primary),
        "created_at": _now_iso(),
    }
    await _registry.tenant_sites.insert_one(doc)
    return {
        "hostname": host,
        "tenant_id": tid,
        "kind": kind,
        "status": status,
        "is_primary": bool(body.is_primary),
    }


async def seed_platform_super_admin(registry, hash_password):
    email = (os.environ.get("PLATFORM_ADMIN_EMAIL") or "ops@luxejewel.app").strip().lower()
    password = (os.environ.get("PLATFORM_ADMIN_PASSWORD") or "Platform@123").strip()
    name = (os.environ.get("PLATFORM_ADMIN_NAME") or "Platform Ops").strip()
    await registry.platform_super_admins.update_one(
        {"email": email},
        {
            "$setOnInsert": {
                "email": email,
                "password_hash": hash_password(password),
                "name": name,
                "disabled": False,
                "created_at": _now_iso(),
            }
        },
        upsert=True,
    )
