import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000"
const COOKIE = "admin_token"

export async function GET() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${BACKEND_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
