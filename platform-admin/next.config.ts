import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Auth + Bearer injection happens in app/api/admin/[...path] and auth routes.
  // Do not rewrite /api blindly — cookie → Authorization must stay in Next.
}

export default nextConfig
