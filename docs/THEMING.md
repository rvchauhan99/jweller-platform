# Theming — configurable look at tenant creation

**Last updated:** 2026-08-21  
**Status:** Tokens + snapshots **shipped** via seed + Expo admin editor. Platform create-tenant **wizard** still pending. Code: `backend/`, `frontend/`.

Locked rule: every jeweler’s customer app can look different. Theme is seeded (today: startup seed for AURELIA / NOIR) and editable in interim admin **Branding**. Target: configure at tenant create in the platform console wizard, then refine in admin.

This document is the **token and wizard contract**. How the three apps should look and behave is [FRONTEND.md](./FRONTEND.md). Tenant tokens apply to the **customer** surface only. Jeweler admin and the platform console use platform tokens.

CMS content (banners, about text, featured products) is **not** the theme. Theme is look-and-layout; CMS is copy and merchandising.

---

## Create-tenant wizard (platform console)

Order of steps:

1. **Business** — legal/display name, GSTIN (optional at create), plan (`basic` \| `pro` \| `enterprise`).
2. **Tenant code & site** — `tenant_code` (unique, human-typable) **or** auto from initials + sequence; required `subdomain` slug; optional custom hostname (stored `pending_dns`).
3. **Theme panel** — live preview of storefront chrome (header, hero placeholder, product card, footer) using CSS variables. Upload logo/favicon. Pick preset, then override colors/fonts/layout.
4. **Owner login** — username (email or phone), temp password (or send-reset).
5. **Confirm** — enqueue provisioning. UI polls job until `active`.

**v1: platform-console only** creates tenants (no public jeweler signup). **Today:** idempotent seed creates demo tenants + `theme_public_snapshots`. Wizard above is the target path; Expo admin Branding already edits `site_theme` and refreshes the snapshot.

---

## Presets

Presets are **named starting points**, not locked skins. Changing colors after picking a preset does not rename `preset_id` unless the user clicks “reset to preset”.

| `preset_id` | Intent |
|-------------|--------|
| `classic-gold` | Warm gold primary, cream surfaces, serif headings |
| `modern-minimal` | Near-black/white, lots of space, sans |
| `royal` | Deep maroon/navy, gold accent, formal |
| `high-contrast` | Accessible large type, strong borders |

Adding a preset is a storefront + docs change. Unknown `preset_id` falls back to `classic-gold`.

---

## `site_theme` document (tenant DB)

One document per tenant (singleton). Seeded by the worker from the wizard payload.

| Field | Purpose |
|-------|---------|
| `preset_id` | Layout component set + default tokens |
| `logo_r2_key` | `/{tenant_code}/site-assets/logo.png` |
| `favicon_r2_key` | |
| `og_image_r2_key` | Social share |
| `colors.primary` | Buttons, links |
| `colors.secondary` | |
| `colors.accent` | Price, gold highlights |
| `colors.background` | Page |
| `colors.surface` | Cards |
| `colors.text` | Body |
| `colors.muted` | Secondary text |
| `colors.header_bg` / `header_text` | |
| `colors.footer_bg` / `footer_text` | |
| `fonts.heading` | Whitelist only (see below) |
| `fonts.body` | |
| `layout.header` | `solid` \| `transparent` |
| `layout.product_card` | `grid` \| `list` |
| `layout.footer` | `simple` \| `rich` |
| `homepage_sections` | Ordered list from allowed set |
| `custom_css` | Empty string on `basic` plan; sanitized on save |
| `updated_at` | |

Allowed `homepage_sections` values:

- `hero`
- `featured`
- `categories`
- `rate_ticker`
- `about`
- `sip_cta`

Unknown section ids are ignored at render time.

---

## Public snapshot (Registry + Redis)

Storefront SSR should not depend on tenant DB being slow or mid-provision.

Registry collection `theme_public_snapshots`:

- `tenant_id`
- `payload` — safe subset of `site_theme` (no secrets)
- `updated_at`

Redis: `theme:{tenant_id}` TTL ~ 60s; delete on theme save.

`GET /api/public/bootstrap` returns snapshot + business display name + primary hostname. Enough to paint chrome before catalog loads.

---

## CSS variable contract (storefront)

The storefront injects on `<html>`:

```css
--color-primary
--color-secondary
--color-accent
--color-background
--color-surface
--color-text
--color-muted
--color-header-bg
--color-header-text
--color-footer-bg
--color-footer-text
--font-heading
--font-body
```

Components use these tokens only (plus Tailwind mapped to CSS vars). Do not hardcode jeweler brand colors in shared components (`text-blue-600`, `#C9A227`, arbitrary font names). See [FRONTEND.md](./FRONTEND.md).

Fonts: load **only** from a whitelist (e.g. Cormorant Garamond, Playfair Display, Inter, DM Sans, Source Serif 4). Arbitrary `@import` URLs are rejected.

`custom_css` is inserted last, scoped if possible. Strip `</script>`, `expression(`, `javascript:`. Enterprise/pro only.

---

## Logo and assets

Wizard upload → R2 `/{tenant_code}/site-assets/...` **after** tenant_code is allocated (worker or signed upload with prefix). Until then, preview uses a data-URL in the wizard only (not persisted).

Missing logo: show `business_name` wordmark in header.

---

## After create — jeweler theme editor

Admin **Settings → Branding** (owner/manager) edits the same `site_theme` fields, live preview, save → invalidate Redis + snapshot.

This is the same model as the create wizard so jewelers are not stuck with the onboarding choice.

Domain list is a separate settings page ([TENANT_SITES.md](./TENANT_SITES.md)).

---

## Plan gates

| Plan | Theme |
|------|--------|
| `basic` | Presets + colors + fonts + logo. No `custom_css`. One logo. |
| `pro` | + `custom_css`, OG image, section reorder |
| `enterprise` | + preview hostname, extra site-assets quota |

---

## Accessibility

Presets must ship with contrast that passes WCAG AA for body text on background. The wizard should warn (not hard-block) when a custom pair fails a simple contrast check.
