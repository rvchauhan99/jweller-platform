# Frontend Design Constitution

**Last updated:** 2026-08-21  
**Status:** Binding. Customer UI **shipped** as Expo white-label in `frontend/`. Progress: [PROGRESS.md](./PROGRESS.md).

This is the visual and interaction law for the three product surfaces. Journeys live in [FUNCTIONAL.md](./FUNCTIONAL.md). Tenant look lives in [THEMING.md](./THEMING.md). Apps and Host vs JWT tenancy live in [ARCHITECTURE.md](./ARCHITECTURE.md).

Taste source for agents: [better-web-ui](https://github.com/aladicf/better-web-ui). Product rules in this file still win.

---

## One-line summary

Three products, three visual languages, one platform. Never ship a storefront that looks like an admin, or an admin that looks like a luxury brochure.

---

## Who is on which surface

| App | Today | Target | Audience | Design job |
|-----|-------|--------|----------|------------|
| Customer storefront | Expo white-label (baked tenant) | Same APIs; optional web later | Shoppers, phone-first | Luxury retail. Trust and conversion. |
| Jeweler admin | Interim Expo `/admin` | Next.js dense ERP | Owner, sales, inventory | Speed. Density. Few clicks. |
| Platform console | Not built | Next.js control plane | SaaS operators | Provisioning and health. |

Tenant branding applies to the **customer** surface via bootstrap theme tokens. Jeweler admin and platform console use **platform** tokens. Admin may show the jeweler logo/name for orientation only.

**White-label bake (shipped):** `EXPO_PUBLIC_TENANT_CODE`, `EXPO_PUBLIC_TENANT_HOST`, `EXPO_PUBLIC_TENANT_NAME`. No in-app store switcher.

---

## 1. Customer storefront

**Users:** jewelry customers on phone first, then desktop.

**Primary goals:** believe the shop, find a piece, start SIP or checkout on **this** jeweler’s gateway.

**Feel:** Apple / Cartier / Tiffany / Rolex / Tanishq. Large photography, strong type, white space, quiet motion. High trust.

**Do**

- Hero and product imagery dominate. Price and metal/purity are secondary, still readable.
- Typography and spacing carry hierarchy before color.
- Rate ticker, if shown, is a precise instrument — time-stamped, not a carnival widget.
- OTP, address, and pay flows stay calm. One primary action per view.
- Suspended tenant: themed “temporarily unavailable”, never a stack trace or generic 500.

**Do not**

- ERP tables, dense filters, metric card grids, sidebar-as-retail.
- shadcn-default cards wrapping every block.
- Hardcoded gold (`#C9A227`) or `text-blue-600`. Brand comes from [THEMING.md](./THEMING.md) tokens.

**Homepage** is assembled from allowed `homepage_sections` (`hero`, `featured`, `categories`, `rate_ticker`, `about`, `sip_cta`). Unknown ids are ignored.

**Primary actions by screen**

| Screen | What matters most | Primary action |
|--------|-------------------|----------------|
| Home | Brand + featured work | Browse catalog / SIP CTA |
| Category / catalog | Pieces, not chrome | Open product |
| Product | Image, weight, purity, making, live sell rate if commodity | Add to cart or start SIP |
| Cart → address → pay | Total, jeweler identity, rate lock warning | Pay on tenant gateway |
| Account / orders / SIP | Status of *this* shop only | View order / pay installment / set up UPI Autopay |
| OTP | Trust, this-site-only account | Request / verify OTP |

---

## 2. Jeweler admin

**Users:** people running a shop during business hours.

**Primary goals:** sell (POS), keep stock honest, clear online orders, collect SIP, file GST.

**Feel:** Stripe Dashboard / Linear / Shopify Admin / Notion. Information density. Keyboard-friendly. Minimal animation.

**Do**

- Tables are first-class: sticky headers, search, filters, column visibility, bulk actions.
- Status as text + quiet color (placed, packed, missed SIP) — not rainbow badges.
- Dashboard is **work to do**, not a vanity KPI wall.
- Forms do one job. POS is a fast path: scan / pick → weight → rate lock → tender → print.

**Do not**

- Dribbble dashboards, oversized metric cards, four “Revenue / Orders / Users / Growth” tiles.
- Storefront serif headings, gold gradients, or tenant `classic-gold` as the admin skin.
- Decorative charts that hide the queue.

**Dashboard composition (context first)**

1. **Pending actions** — open online orders, SIP missed/due today, low stock.
2. **Today’s sales** — online + offline, as one operational number with a split.
3. **Inventory status** — low / out, not a warehouse novel.
4. **Collections due** — SIP installments.
5. **Rate health** — feed age + this tenant’s sell rate; stale warning if blocked.
6. **Recent activity** — last bills and orders.

Metrics support those blocks. They are not the page.

**Primary actions by screen**

| Screen | Fastest workflow | Primary action |
|--------|------------------|----------------|
| Login | tenant_code + username | Sign in |
| Dashboard | Clear the queue | Open oldest pending order / due SIP |
| POS | Walk-in bill | Save & lock rate |
| Inventory | Find SKU | Edit stock / list online |
| Online orders | Pipeline | Advance status |
| Customers | Search this tenant only | Open ledger / KYC |
| SIP | Who is due; Autopay pause/resume/cancel | Record / charge / chase installment |
| Reports | GST / stock / SIP liability | Export CSV |
| Branding | Match the live site | Save theme (invalidate snapshot) |

---

## 3. Platform console

**Users:** internal operators.

**Primary goals:** create tenants, watch provisioning, suspend, billing status (software, not gold).

**Feel:** Vercel / Railway / Datadog / AWS Console. Health and control. Not retail. Not shop POS.

**Do**

- Tenant list with status (`provisioning` / `active` / `suspended`) as the hero, not a chart.
- Create-tenant wizard: business → site → **theme preview** → owner → confirm. Live storefront chrome in the theme step ([THEMING.md](./THEMING.md)).
- Provisioning job visibility and retry. Impersonate requires a reason (audit).

**Do not**

- Fake “platform GMV this month” as four gradient cards.
- Let the wizard feel like the jeweler POS.

**Primary actions**

| Screen | Primary action |
|--------|----------------|
| Tenant list | Open tenant / create tenant |
| Create wizard | Provision |
| Provisioning job | Retry if failed |
| Tenant detail | Suspend / impersonate (reason) |

---

## Stack

| Layer | Customer (shipped) | Jeweler admin (shipped dual) | Platform console (target) |
|-------|--------------------|------------------------------|---------------------------|
| Framework | Expo 54 + expo-router | Expo `/admin` **and** Next.js `admin/` | Next.js App Router |
| Language | TypeScript | TypeScript | TypeScript |
| Styling | Theme tokens from `/api/public/bootstrap` | Platform tokens (`src/admin/theme.ts` / admin CSS vars) | Platform tokens |
| Icons | Feather / Expo vector | Feather (Expo) / Lucide (web) | Lucide |
| Charts | — | Recharts only when operational | Operational only |
| Motion | Quiet; honor reduced motion | Almost none | Almost none |

Do **not** merge customer chrome into admin. Both Expo and Next.js admin use **platform** tokens — not the jeweler storefront preset.

**Locale:** English UI chrome only in v1.

**API:** Expo admin calls FastAPI with Bearer JWT (no Host tenancy). Next.js admin uses same-origin `/api` BFF that injects Bearer from httpOnly cookie.

**Surface split:** POS, purchases, and heavy CSV reports are **web-first** (Next.js). Expo keeps queue/ops and shows a desktop CTA for those flows.

---

## Design principles

1. Never generate a generic AI dashboard.
2. Never wrap every region in a card. Surfaces and spacing first; cards only when the content is a discrete object.
3. Typography before color.
4. Spacing before borders.
5. Hierarchy before decoration.
6. Color only with meaning (status, metal, destructive, tenant brand on storefront).
7. Tables are first-class in admin and console.
8. ERP screens stay dense. Luxury whitespace is for the storefront.
9. Mobile must work: storefront is mobile-first; admin POS and queues must work on a phone, even if dense.
10. Every screen has one clear primary action.
11. Admin and console support light and dark (system + user). Storefront follows `site_theme`; no shopper dark-mode toggle in v1 that fights the jeweler’s brand.
12. Accessibility is mandatory (WCAG AA for text/background; keyboard; visible focus; `prefers-reduced-motion`).
13. Consistency inside each app. Do not share storefront chrome with admin.
14. No one-off component styles. Extend the system.
15. Reuse existing primitives. New patterns need a name and a home.

---

## Multi-tenant tokens

Storefront injects the contract from [THEMING.md](./THEMING.md) on `<html>`:

`--color-primary`, `--color-secondary`, `--color-accent`, `--color-background`, `--color-surface`, `--color-text`, `--color-muted`, `--color-header-bg`, `--color-header-text`, `--color-footer-bg`, `--color-footer-text`, `--font-heading`, `--font-body`.

Tailwind theme maps to those variables. Components consume tokens only.

```txt
GOOD  bg-[var(--color-primary)]   or  bg-primary  (mapped)
BAD   text-blue-600   bg-[#C9A227]   font-[Playfair]  hardcoded
```

Fonts load only from the whitelist. Arbitrary `@import` URLs are rejected.

**Admin / console** use a separate platform token set (neutral surfaces, semantic status). Do not bind admin `--color-primary` to the tenant’s gold. Status colors (success, warning, destructive) are platform-semantic, not brand.

---

## Layout standards

| Rule | Storefront | Admin / console |
|------------------|-----------------|
| Width | Full-bleed imagery; content `max-w-7xl` centered | `max-w-7xl` for settings; tables may use full workspace width |
| Rhythm | 8px scale, generous | 8px scale, tight |
| Sections | Editorial breaks | Toolbars + tables |
| Forms | Short, one job (OTP, address, pay) | One job per dialog; POS is its own full view |
| Tables | Rare (order history) | Sticky header, search, filters, column picker |

Page shell: title, context (tenant name, rate timestamp, filters), **primary action**, then content. No orphan pages with only a heading.

---

## Component quality

Every reusable piece ships:

- Responsive layout
- Accessible name and keyboard path
- Loading (skeleton or honest spinner — not a blank hole)
- Empty (what to do next)
- Error (recoverable copy, retry where safe)

Storefront product cards and admin data tables both follow this. Empty catalog ≠ empty inventory table; write copy for the actor.

---

## Motion

| Surface | Motion |
|---------|--------|
| Storefront | Short fades / image crossfades. No bounce. Honor `prefers-reduced-motion`. |
| Admin | Instant. Row highlight, toast. No page parallax. |
| Console | Status pulses only if they encode health, and still respect reduced motion. |

---

## Before generating any UI

Answer in this order, then design:

1. Who is using this screen? (shopper / staff role / operator)
2. What is their primary goal?
3. What action must they take?
4. What information matters most?
5. What is the fastest workflow?

If the answers sound like “see all the metrics”, redesign until there is a queue or a purchase.

---

## Anti-patterns (reject on sight)

- Four equal statistic cards as a dashboard.
- Card-in-card-in-card.
- Purple gradients, glassmorphism, random blobs on jewelry or ERP.
- Mixing Host-branded storefront chrome into `admin.yourplatform.in`.
- Global customer identity UI (“log in once for all jewelers”).
- Platform payment branding on checkout (Model A). Checkout must read as the jeweler’s shop.

---

## Where better-web-ui is used

[better-web-ui](https://github.com/aladicf/better-web-ui) is an **agent taste library**, not a UI kit and not a runtime dependency. It does not ship in `storefront/`, `admin/`, or `platform-admin/`. Agents use it when generating or reviewing UI. This constitution and [THEMING.md](./THEMING.md) still win.

Install once into **Cursor project scope** (skills land in `.agents/skills/`, not `.cursor/skills/` — that folder already has this product’s constitution skill):

```bash
npx skills add aladicf/better-web-ui --agent cursor -y
```

Project context for those skills lives in [`.better-web-ui.md`](../.better-web-ui.md). Do not let `/setup` overwrite the three-app split or tenant-token rules.

### Always (any UI work)

| Skill | Use it for |
|-------|------------|
| `setup` | Already captured in `.better-web-ui.md`. Re-run only if stack or visual law changes. |
| `frontend-design` (better-web-ui) | Shared doctrine: hierarchy, spacing, type. Subordinate to this file. |
| `critique` | After a screen exists: cognitive load, IA, competing actions. |
| `audit` | Contrast, a11y, theming (tokens vs hardcoded), responsive, anti-patterns. |
| `a11y` | Keyboard, focus, ARIA, `prefers-reduced-motion`. |
| `harden` | Empty, error, overflow, stale rates, suspended tenant. |
| `polish` | Final alignment pass when structure is already right. |
| `normalize` / `extract` | After several screens: shared primitives, stop one-off styles. |

### Customer storefront (`storefront/`)

Luxury retail. Use motion and imagery skills here. Do **not** use `data-viz` for shopper home.

| Skill | Screens / moments |
|-------|-------------------|
| `add-ui` | Home sections (`hero`, `featured`, `categories`, `rate_ticker`, `about`, `sip_cta`), product, cart |
| `imagery` | Product photography, hero, catalog grid |
| `typeset` | Heading/body from tenant font tokens |
| `colorize` | Map components to `--color-*` only |
| `animate` | Quiet image fades — never bounce |
| `forms` | OTP, address, pay |
| `security-ux` | OTP trust, this-site-only account |
| `empty-state` | Empty catalog, no orders, no SIP |
| `onboard` | First visit / first SIP (Phase 3+) |
| `bolder` | If the shop feels like a default shadcn landing page |
| `quieter` | If a tenant theme or motion gets loud |
| `optimize` | LCP on product images (Phase 3) |

### Jeweler admin (`admin/`)

Dense ERP. Prefer `distill` over `delight`. Almost no `animate`.

| Skill | Screens / moments |
|-------|-------------------|
| `add-ui` | Login, dashboard (pending work first), POS, inventory, orders, SIP, reports |
| `hierarchy` | One primary action; queues over vanity KPIs |
| `arrange` | Toolbars + sticky tables, not card grids |
| `search` | SKU, customer, order findability |
| `forms` | POS, purchases, staff, gateway keys, theme editor |
| `empty-state` | No stock, no due SIP, no online orders |
| `distill` | When a screen accumulates filters and panels |
| `data-viz` | Only when a chart answers an operational question (sales register, SIP liability) — never four metric cards |
| `colorize` | Semantic status (placed / packed / missed), not tenant gold |

### Platform console (`platform-admin/`)

Control plane. Same density bias as admin.

| Skill | Screens / moments |
|-------|-------------------|
| `add-ui` | Tenant list, create-tenant wizard, job detail |
| `forms` | Wizard: business → site → **theme preview** → owner → confirm |
| `onboard` | Operator creating the first tenant |
| `data-viz` | Provisioning health, tenant status — not fake platform GMV cards |
| `harden` | Failed jobs, retry, impersonate-with-reason |
| `security-ux` | Super-admin login, impersonation audit |

### By build phase

| Phase | better-web-ui work |
|-------|-------------------|
| Shipped Expo storefront | Prefer `critique` / `polish` / `harden` / `imagery` on existing screens |
| Next OTP + Razorpay | `forms`, `security-ux` |
| Next.js admin migration | `search`, `arrange`, `hierarchy`, `distill` |
| Platform console | `forms`, `onboard`, `harden` |

### Do not use

- `showcase` to turn admin or POS into a demo.
- `delight` on ERP screens.
- `data-viz` as the default for any “dashboard”.
- One `add-ui` pass that produces a shared shell for customer + admin.

## Implementation status

Follow [BUILD_ORDER.md](./BUILD_ORDER.md) and [PROGRESS.md](./PROGRESS.md). Customer Expo storefront and interim admin already exist in the implementation repo — extend them; do not regenerate a greenfield “Phase 1 placeholder home” unless asked.
