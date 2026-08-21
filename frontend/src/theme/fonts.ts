// Whitelisted brand fonts, loaded at runtime from a CDN so any tenant's chosen
// heading/body family is available without bundling @expo-google-fonts.
export const BRAND_FONTS: Record<string, string> = {
  Cormorant500:
    "https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-500-normal.ttf",
  Cormorant600:
    "https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-600-normal.ttf",
  DMSans400: "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-normal.ttf",
  DMSans500: "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-500-normal.ttf",
  Playfair600:
    "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-600-normal.ttf",
  Inter400: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
  Inter500: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf",
  SourceSerif400:
    "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-normal.ttf",
};
