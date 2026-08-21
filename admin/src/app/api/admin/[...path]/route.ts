import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000"
const COOKIE = "admin_token"

const proxy = async (request: NextRequest, pathSegments: string[]) => {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const path = pathSegments.join("/")
  const search = request.nextUrl.search
  const url = `${BACKEND_URL}/api/admin/${path}${search}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  const contentType = request.headers.get("content-type")
  const method = request.method
  let body: BodyInit | undefined

  if (method !== "GET" && method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      // Preserve boundary for multer / FastAPI UploadFile
      headers["Content-Type"] = contentType
      body = await request.arrayBuffer()
    } else {
      if (contentType) headers["Content-Type"] = contentType
      const text = await request.text()
      body = text || undefined
    }
  } else if (contentType) {
    headers["Content-Type"] = contentType
  }

  const res = await fetch(url, { method, headers, body, cache: "no-store" })
  const resCt = res.headers.get("content-type") || ""
  const outHeaders = new Headers()
  if (resCt) outHeaders.set("content-type", resCt)

  const isBinary =
    resCt.includes("application/pdf") ||
    resCt.includes("application/octet-stream") ||
    resCt.includes("image/") ||
    resCt.includes("multipart/")

  if (isBinary) {
    const buf = await res.arrayBuffer()
    const disp = res.headers.get("content-disposition")
    if (disp) outHeaders.set("content-disposition", disp)
    return new NextResponse(buf, { status: res.status, headers: outHeaders })
  }

  const resText = await res.text()
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
