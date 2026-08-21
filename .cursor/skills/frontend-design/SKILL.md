---
name: frontend-design
description: Applies the Jewelers Platform frontend constitution across storefront, jeweler admin, and platform console. Use when designing, reviewing, or implementing any UI, dashboard, theme, component, or Next.js screen.
---

# Jewelers Platform frontend

Monorepo: follow [docs/FRONTEND.md](../../../docs/FRONTEND.md), [docs/THEMING.md](../../../docs/THEMING.md), and [docs/PROGRESS.md](../../../docs/PROGRESS.md). Customer UI is Expo in `frontend/`.

## Operating model

1. Name the app: storefront, jeweler admin, or platform console.
2. Answer: who, primary goal, required action, what matters most, fastest workflow.
3. Match that app’s visual language. Do not mix them.
4. Prefer type, spacing, and hierarchy over color and cards.

## Visual languages

| App | Feel | Tokens |
|-----|------|--------|
| Storefront | Luxury retail, large imagery | Tenant CSS vars from THEMING.md |
| Jeweler admin | Dense ERP (Stripe / Linear / Shopify Admin) | Platform tokens; tenant logo for orientation only |
| Platform console | Control plane (Vercel / Railway) | Platform tokens |

## Hard rules

- No generic four-card KPI dashboards. Admin home is pending work, then metrics.
- No hardcoded brand color or font (`text-blue-600`, `#C9A227`).
- Storefront never looks like an admin table. Admin never looks like Cartier.
- Checkout and OTP read as the jeweler’s shop (Model B), not the platform.
- Components: loading, empty, error, accessible, responsive.
- Motion: restrained on storefront; almost none in admin. Honor `prefers-reduced-motion`.
- Dark mode: admin + console. Storefront follows `site_theme` (no v1 shopper theme toggle).

## Stack (when building)

Next.js App Router, TypeScript, Tailwind mapped to CSS variables, shadcn/Radix for admin and console, Lucide, Recharts only when a chart answers an operational question, Framer Motion with restraint.

Taste reference: [better-web-ui](https://github.com/aladicf/better-web-ui). Product rules in `docs/FRONTEND.md` win.
