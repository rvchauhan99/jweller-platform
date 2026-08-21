export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

interface ApiOpts {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

const buildUrl = (path: string, query?: ApiOpts["query"]) => {
  const base = path.startsWith("/") ? path : `/${path}`
  const url = new URL(`/api/admin${base}`, typeof window !== "undefined" ? window.location.origin : "http://localhost")
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.pathname + url.search
}

export const api = async <T>(path: string, opts: ApiOpts = {}): Promise<T> => {
  const { method = "GET", body, query } = opts
  const res = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || "Request failed"
    throw new ApiError(res.status, detail, data)
  }

  return data as T
}

export interface LoginBody {
  tenant_code: string
  username: string
  password: string
}

export interface LoginResult {
  business_name: string
  tenant_code: string
  role: string
  username: string
}

export interface MeResult {
  tenant_code: string
  business_name: string
  role: string
  status?: string
  username?: string
}

export const login = async (body: LoginBody): Promise<LoginResult> => {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || data?.error || "Login failed", data)
  }
  return data as LoginResult
}

export const logout = async (): Promise<void> => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
}

export const me = async (): Promise<MeResult> => {
  const res = await fetch("/api/auth/me", { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || "Unauthorized", data)
  }
  return data as MeResult
}

export interface UploadResult {
  key: string
  url: string
  filename: string
  mime_type: string
  size_bytes: number
}

/** Multipart product image → R2 (field name `file`). */
export const uploadProductImage = async (file: File): Promise<UploadResult> => {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || "Upload failed"
    throw new ApiError(res.status, detail, data)
  }
  return data as UploadResult
}

export const downloadCsv = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
