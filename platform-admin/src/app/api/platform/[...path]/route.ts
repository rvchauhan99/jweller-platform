import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000"
const COOKIE = "platform_token"

const proxy = async (request: NextRequest, pathSegments: string[]) => {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const path = pathSegments.join("/")
  const search = request.nextUrl.search
  const url = `${BACKEND_URL}/api/platform/${path}${search}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  const contentType = request.headers.get("content-type")
  const method = request.method
  let body: BodyInit | undefined

  if (method !== "GET" && method !== "HEAD") {
    if (contentType) headers["Content-Type"] = contentType
    const text = await request.text()
    body = text || undefined
  }

  const res = await fetch(url, { method, headers, body, cache: "no-store" })
  const resText = await res.text()
  const outHeaders = new Headers()
  const resCt = res.headers.get("content-type")
  if (resCt) outHeaders.set("content-type", resCt)

  return new NextResponse(resText, { status: res.status, headers: outHeaders })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(request, path)
}
