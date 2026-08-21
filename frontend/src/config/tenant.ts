// White-label build config.
// Each jeweler ships as a SEPARATE app with its own tenant baked in — there is
// no in-app store switcher. The tenant's primary hostname is sent as
// X-Tenant-Host on every request (the backend never trusts a client tenant_id).
//
// To produce a different jeweler's build, set EXPO_PUBLIC_TENANT_CODE (and
// optionally EXPO_PUBLIC_TENANT_HOST) at build time.
const CODE = (process.env.EXPO_PUBLIC_TENANT_CODE ?? "AURELIA").trim().toUpperCase();
const HOST = (process.env.EXPO_PUBLIC_TENANT_HOST ?? `${CODE.toLowerCase()}.luxejewel.app`).trim();

export const TENANT_CODE = CODE;
export const TENANT_HOST = HOST;

// Display name baked into this build (also set app.json "name" and the app
// icon/splash assets per jeweler at build time). The live business name/logo
// still come from /api/public/bootstrap so in-app branding stays in sync.
export const TENANT_NAME = (process.env.EXPO_PUBLIC_TENANT_NAME ?? "Aurelia Fine Jewels").trim();
