import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000"
const COOKIE = "admin_token"

export async function POST(request: Request) {
  let body: { tenant_code?: string; username?: string; password?: string; totp?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 })
  }

  const res = await fetch(`${BACKEND_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_code: body.tenant_code,
      username: body.username,
      password: body.password,
      totp: body.totp || undefined,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status })
  }

  // QuickerPay-style challenge: password OK but TOTP still required — no session cookie.
  if (data?.two_fa_required === true) {
    return NextResponse.json({ two_fa_required: true })
  }

  if (!data?.access_token) {
    return NextResponse.json({ detail: "Login failed" }, { status: 500 })
  }

  const jar = await cookies()
  jar.set(COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: typeof data.expires_in === "number" ? data.expires_in : 60 * 60 * 12,
  })

  return NextResponse.json({
    business_name: data.business_name,
    tenant_code: data.tenant_code,
    role: data.role,
    username: data.username,
    two_fa_enabled: Boolean(data.two_fa_enabled),
  })
}
