"""R2 product image upload (MOCK_R2)."""
from __future__ import annotations

import io
import os

import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def _admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/admin/auth/login",
        json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestR2Uploads:
    def test_upload_product_image_mock(self):
        token = _admin_token()
        # minimal PNG via Pillow
        buf = io.BytesIO()
        Image.new("RGB", (1, 1), color=(200, 160, 40)).save(buf, format="PNG")
        buf.seek(0)
        files = {"file": ("dot.png", buf, "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/uploads",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("key", "").startswith("AURELIA/products/")
        assert body.get("url")
        assert "media" in body["url"] or body["url"].startswith("http")

        media = requests.get(body["url"], timeout=15)
        assert media.status_code == 200
        assert media.content[:4] == b"\x89PNG"

    def test_reject_non_image(self):
        token = _admin_token()
        files = {"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/admin/uploads",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            timeout=15,
        )
        assert r.status_code == 400
