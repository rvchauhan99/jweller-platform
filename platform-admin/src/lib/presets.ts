export interface ThemeColors {
  primary: string
  onPrimary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  border: string
  headerBg: string
  headerText: string
  footerBg: string
  footerText: string
}

export interface ThemeFonts {
  heading: string
  body: string
}

export interface ThemePreset {
  mode: "light" | "dark"
  colors: ThemeColors
  fonts: ThemeFonts
}

export const PRESETS: Record<string, ThemePreset> = {
  "classic-gold": {
    mode: "light",
    colors: {
      primary: "#BFA75D",
      onPrimary: "#FFFFFF",
      secondary: "#8C7738",
      accent: "#BFA75D",
      background: "#FAFAF7",
      surface: "#FFFFFF",
      text: "#1A1A18",
      muted: "#6B6B64",
      border: "#E0DCD1",
      headerBg: "#FAFAF7",
      headerText: "#1A1A18",
      footerBg: "#1A1A18",
      footerText: "#FAFAF7",
    },
    fonts: { heading: "Cormorant Garamond", body: "DM Sans" },
  },
  "dark-royal": {
    mode: "dark",
    colors: {
      primary: "#D4AF37",
      onPrimary: "#0D0F12",
      secondary: "#B8912E",
      accent: "#D4AF37",
      background: "#0D0F12",
      surface: "#16191F",
      text: "#F2F0EA",
      muted: "#9A968C",
      border: "#2A2E36",
      headerBg: "#0D0F12",
      headerText: "#F2F0EA",
      footerBg: "#000000",
      footerText: "#D4AF37",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
  },
  "modern-minimal": {
    mode: "light",
    colors: {
      primary: "#111827",
      onPrimary: "#FFFFFF",
      secondary: "#374151",
      accent: "#111827",
      background: "#FFFFFF",
      surface: "#F7F7F8",
      text: "#111827",
      muted: "#6B7280",
      border: "#E5E7EB",
      headerBg: "#FFFFFF",
      headerText: "#111827",
      footerBg: "#111827",
      footerText: "#FFFFFF",
    },
    fonts: { heading: "Source Serif 4", body: "Inter" },
  },
  "high-contrast": {
    mode: "light",
    colors: {
      primary: "#0A7D4B",
      onPrimary: "#FFFFFF",
      secondary: "#065F3B",
      accent: "#0A7D4B",
      background: "#FFFFFF",
      surface: "#F3FAF6",
      text: "#08130D",
      muted: "#4B5B52",
      border: "#D6E6DD",
      headerBg: "#08130D",
      headerText: "#FFFFFF",
      footerBg: "#08130D",
      footerText: "#FFFFFF",
    },
    fonts: { heading: "Playfair Display", body: "DM Sans" },
  },
}

export const PRESET_IDS = Object.keys(PRESETS)

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
  { key: "headerBg", label: "Header bg" },
  { key: "headerText", label: "Header text" },
  { key: "footerBg", label: "Footer bg" },
  { key: "footerText", label: "Footer text" },
]
