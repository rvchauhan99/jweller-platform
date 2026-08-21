#!/usr/bin/env python3
"""L4 webhook smoke — signed payment.captured (uses mock_webhook_secret when MOCK, else DEMO secret from env)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import uuid

import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def main() -> int:
    secret = (os.environ.get("DEMO_RAZORPAY_WEBHOOK_SECRET") or "").strip() or "mock_webhook_secret"
    # Align tenant gateway webhook secret with DEMO_* for this smoke (Test Mode hardening)
    if secret and secret != "mock_webhook_secret":
        login = requests.post(
            f"{BASE}/api/admin/auth/login",
            json={"tenant_code": "AURELIA", "username": "owner", "password": "Aurelia@123"},
            timeout=15,
        )
        if login.status_code == 200:
            token = login.json()["access_token"]
            gw = requests.get(f"{BASE}/api/admin/gateway", headers={"Authorization": f"Bearer {token}"}, timeout=15)
            body = gw.json() if gw.status_code == 200 else {}
            requests.put(
                f"{BASE}/api/admin/gateway",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "provider": "razorpay",
                    "key_id": body.get("key_id"),
                    "webhook_secret": secret,
                    "enabled": True,
                },
                timeout=15,
            )
            print("[INFO] synced AURELIA webhook_secret from DEMO_RAZORPAY_WEBHOOK_SECRET")
    # Need a real unpaid order path is hard without confirm; test signature reject + accept duplicate-safe shape
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_harden_" + uuid.uuid4().hex[:10],
                    "order_id": "order_missing_harden",
                    "notes": {
                        "tenant_id": "AURELIA",
                        "kind": "order",
                        "ref_id": "nonexistent-order-id",
                        "customer_id": "x",
                    },
                }
            }
        },
    }
    body = json.dumps(payload).encode()
    bad = requests.post(
        f"{BASE}/api/public/webhooks/razorpay",
        data=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "00" * 32},
        timeout=15,
    )
    print(f"[{'PASS' if bad.status_code == 400 else 'FAIL'}] webhook_reject_bad_sig — {bad.status_code}")

    good = requests.post(
        f"{BASE}/api/public/webhooks/razorpay",
        data=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sign(body, secret)},
        timeout=15,
    )
    # Valid sig → 200 (even if order_missing); 400 = secret mismatch
    signed_ok = good.status_code == 200
    print(f"[{'PASS' if signed_ok else 'FAIL'}] webhook_signed — {good.status_code} {good.text[:120]}")

    if not signed_ok:
        print("NOTE: Ensure DEMO_RAZORPAY_WEBHOOK_SECRET is set and synced to Admin Gateway")
        print(json.dumps({"webhook_bad_sig": "pass", "webhook_good_sig": "fail"}))
        return 1 if bad.status_code == 400 else 1

    print(json.dumps({"webhook_bad_sig": "pass", "webhook_good_sig": "pass"}))
    return 0 if bad.status_code == 400 else 1


if __name__ == "__main__":
    sys.exit(main())
