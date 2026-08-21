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
}

const buildUrl = (path: string) => {
  const base = path.startsWith("/") ? path : `/${path}`
  return `/api/platform${base}`
}

export const api = async <T>(path: string, opts: ApiOpts = {}): Promise<T> => {
  const { method = "GET", body } = opts
  const res = await fetch(buildUrl(path), {
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

export const login = async (email: string, password: string) => {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data?.detail || "Login failed", data)
  return data as { email: string; name: string }
}

export const logout = async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
}

export const me = async () => {
  const res = await fetch("/api/auth/me", { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data?.detail || "Unauthorized", data)
  return data as { email: string; name: string }
}

export interface TenantRow {
  id: string
  tenant_code: string
  business_name: string
  subdomain?: string
  status?: string
  plan?: string
  primary_hostname?: string
  created_at?: string
}
