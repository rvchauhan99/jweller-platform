"""Cloudflare R2 (S3-compatible) storage — same env pattern as QuickerPay.

Env:
  BUCKET_ENDPOINT              e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  BUCKET_NAME
  BUCKET_ACCESS_KEY_ID
  BUCKET_SECRET_ACCESS_KEY
  BUCKET_REGION                default auto
  BUCKET_PUBLIC_BASE_URL       public CDN / r2.dev base for product images (required for storefront)
  MOCK_R2=1                    local/pytest: write under .r2_mock/ and serve via /api/public/media/
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
PRODUCT_IMAGE_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_MOCK_ROOT = Path(__file__).resolve().parent / ".r2_mock"


def use_mock_r2() -> bool:
    return os.environ.get("MOCK_R2", "").strip() in ("1", "true", "True", "yes")


def is_configured() -> bool:
    if use_mock_r2():
        return True
    return bool(
        os.environ.get("BUCKET_ENDPOINT", "").strip()
        and os.environ.get("BUCKET_NAME", "").strip()
        and os.environ.get("BUCKET_ACCESS_KEY_ID", "").strip()
        and os.environ.get("BUCKET_SECRET_ACCESS_KEY", "").strip()
    )


def assert_configured() -> None:
    if not is_configured():
        raise RuntimeError(
            "Object storage is not configured. Set BUCKET_ENDPOINT, BUCKET_NAME, "
            "BUCKET_ACCESS_KEY_ID, BUCKET_SECRET_ACCESS_KEY (or MOCK_R2=1 for local)."
        )


def _public_base() -> str:
    base = (os.environ.get("BUCKET_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if base:
        return base
    if use_mock_r2():
        api = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://127.0.0.1:8000").rstrip("/")
        return f"{api}/api/public/media"
    return ""


def public_url_for_key(key: str) -> str:
    base = _public_base()
    if not base:
        # Fall back to path-style R2 URL (works only if bucket is public)
        endpoint = os.environ.get("BUCKET_ENDPOINT", "").rstrip("/")
        name = os.environ.get("BUCKET_NAME", "")
        return f"{endpoint}/{name}/{key}"
    if use_mock_r2() and base.endswith("/api/public/media"):
        return f"{base}/{key}"
    return f"{base}/{key}"


def build_product_image_key(*, tenant_code: str, original_filename: str, content_type: str) -> str:
    ext = PRODUCT_IMAGE_MIME.get(content_type) or Path(original_filename).suffix.lower() or ".jpg"
    if not ext.startswith("."):
        ext = "." + ext
    safe_tenant = re.sub(r"[^A-Za-z0-9_-]", "", tenant_code) or "tenant"
    return f"{safe_tenant}/products/{uuid.uuid4().hex}{ext}"


def validate_product_image(*, content_type: str, size: int, filename: str) -> None:
    if content_type not in PRODUCT_IMAGE_MIME:
        raise ValueError("Allowed types: JPEG, PNG, WEBP")
    if size <= 0 or size > PRODUCT_IMAGE_MAX_BYTES:
        raise ValueError("File must be between 1 byte and 10MB")
    if not (filename or "").strip():
        raise ValueError("Filename is required")


def _s3_client():
    import boto3
    from botocore.client import Config

    return boto3.client(
        "s3",
        endpoint_url=os.environ["BUCKET_ENDPOINT"].strip(),
        aws_access_key_id=os.environ["BUCKET_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["BUCKET_SECRET_ACCESS_KEY"].strip(),
        region_name=(os.environ.get("BUCKET_REGION") or "auto").strip() or "auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def upload_product_image(
    *,
    tenant_code: str,
    data: bytes,
    content_type: str,
    filename: str,
) -> dict:
    """Server-side PutObject (QuickerPay pattern). Returns key + public url."""
    assert_configured()
    validate_product_image(content_type=content_type, size=len(data), filename=filename)
    key = build_product_image_key(
        tenant_code=tenant_code, original_filename=filename, content_type=content_type
    )

    if use_mock_r2():
        dest = _MOCK_ROOT / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        logger.info("[R2 mock] stored key=%s bytes=%s", key, len(data))
    else:
        try:
            _s3_client().put_object(
                Bucket=os.environ["BUCKET_NAME"].strip(),
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        except Exception as e:
            logger.exception("[R2] PutObject failed key=%s", key)
            raise RuntimeError(f"Could not upload image: {e}") from e

    url = public_url_for_key(key)
    return {
        "key": key,
        "url": url,
        "filename": filename,
        "mime_type": content_type,
        "size_bytes": len(data),
    }


def delete_object(key: str) -> None:
    if not key or not is_configured():
        return
    if use_mock_r2():
        path = _MOCK_ROOT / key
        if path.is_file():
            path.unlink()
        return
    try:
        _s3_client().delete_object(Bucket=os.environ["BUCKET_NAME"].strip(), Key=key)
    except Exception as e:
        logger.warning("[R2] DeleteObject failed key=%s: %s", key, e)


def mock_file_path(key: str) -> Optional[Path]:
    """Resolve a mock object for /public/media serving."""
    if not use_mock_r2():
        return None
    # Prevent path traversal
    if ".." in key or key.startswith("/"):
        return None
    path = (_MOCK_ROOT / key).resolve()
    root = _MOCK_ROOT.resolve()
    if not str(path).startswith(str(root)):
        return None
    return path if path.is_file() else None
