import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const COOKIE = "admin_token"

export async function POST() {
  const jar = await cookies()
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  })
  return NextResponse.json({ ok: true })
}
