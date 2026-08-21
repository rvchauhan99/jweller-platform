import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";

import { A } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell, PrimaryButton } from "@/src/admin/AdminShell";

const COLOR_FIELDS: { key: string; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "headerBg", label: "Header bg" },
  { key: "footerBg", label: "Footer bg" },
];

const FONTS = ["Cormorant Garamond", "Playfair Display", "Source Serif 4", "DM Sans", "Inter"];

const PRESETS: Record<string, any> = {
  "classic-gold": { mode: "light", colors: { primary: "#BFA75D", onPrimary: "#FFFFFF", secondary: "#8C7738", accent: "#BFA75D", background: "#FAFAF7", surface: "#FFFFFF", text: "#1A1A18", muted: "#6B6B64", border: "#E0DCD1", headerBg: "#FAFAF7", headerText: "#1A1A18", footerBg: "#1A1A18", footerText: "#FAFAF7" }, fonts: { heading: "Cormorant Garamond", body: "DM Sans" } },
  "dark-royal": { mode: "dark", colors: { primary: "#D4AF37", onPrimary: "#0D0F12", secondary: "#B8912E", accent: "#D4AF37", background: "#0D0F12", surface: "#16191F", text: "#F2F0EA", muted: "#9A968C", border: "#2A2E36", headerBg: "#0D0F12", headerText: "#F2F0EA", footerBg: "#000000", footerText: "#D4AF37" }, fonts: { heading: "Playfair Display", body: "Inter" } },
  "modern-minimal": { mode: "light", colors: { primary: "#111827", onPrimary: "#FFFFFF", secondary: "#374151", accent: "#111827", background: "#FFFFFF", surface: "#F7F7F8", text: "#111827", muted: "#6B7280", border: "#E5E7EB", headerBg: "#FFFFFF", headerText: "#111827", footerBg: "#111827", footerText: "#FFFFFF" }, fonts: { heading: "Source Serif 4", body: "Inter" } },
  "high-contrast": { mode: "light", colors: { primary: "#0A7D4B", onPrimary: "#FFFFFF", secondary: "#065F3B", accent: "#0A7D4B", background: "#FFFFFF", surface: "#F3FAF6", text: "#08130D", muted: "#4B5B52", border: "#D6E6DD", headerBg: "#08130D", headerText: "#FFFFFF", footerBg: "#08130D", footerText: "#FFFFFF" }, fonts: { heading: "Playfair Display", body: "DM Sans" } },
};

export default function AdminBranding() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [theme, setTheme] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => { adminFetch("/admin/theme").then((t) => setTheme(normalize(t))).catch(() => {}); }, []));

  const applyPreset = (id: string) => setTheme({ ...PRESETS[id], preset_id: id, colors: { ...PRESETS[id].colors }, fonts: { ...PRESETS[id].fonts } });
  const setColor = (k: string, v: string) => setTheme((t: any) => ({ ...t, colors: { ...t.colors, [k]: v } }));
  const setFont = (which: "heading" | "body", v: string) => setTheme((t: any) => ({ ...t, fonts: { ...t.fonts, [which]: v } }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await adminFetch("/admin/theme", { method: "PUT", body: JSON.stringify({ preset_id: theme.preset_id, mode: theme.mode, colors: theme.colors, fonts: theme.fonts }) });
      setSaved(true);
    } catch {}
    setSaving(false);
  };

  if (!theme) return <AdminShell title="Branding"><Text style={{ fontFamily: A.font, color: A.muted }}>Loading…</Text></AdminShell>;
  const c = theme.colors;

  return (
    <AdminShell
      title="Branding"
      subtitle="Live theme — saving updates your storefront on next load"
      action={<PrimaryButton testID="save-theme-btn" label={saving ? "Saving…" : saved ? "Saved ✓" : "Save theme"} icon="save" onPress={save} tone="accent" />}
    >
      <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>
        {/* Editor */}
        <View style={{ flex: 1 }}>
          <Text style={styles.section}>Preset</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Object.keys(PRESETS).map((id) => (
              <Pressable key={id} testID={`preset-${id}`} onPress={() => applyPreset(id)} style={[styles.presetChip, theme.preset_id === id && { borderColor: A.accent, backgroundColor: A.accentSoft }]}>
                <Text style={{ fontFamily: A.font, fontSize: 12, color: theme.preset_id === id ? A.accent : A.text }}>{id}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Colors</Text>
          <View style={styles.panel}>
            {COLOR_FIELDS.map((f) => (
              <View key={f.key} style={styles.colorRow}>
                <Text style={{ fontFamily: A.font, fontSize: 13, color: A.text, flex: 1 }}>{f.label}</Text>
                <View style={[styles.swatch, { backgroundColor: c[f.key] || "#fff" }]} />
                <TextInput
                  testID={`color-${f.key}`}
                  value={c[f.key] || ""}
                  onChangeText={(v) => setColor(f.key, v)}
                  autoCapitalize="characters"
                  style={styles.hexInput}
                />
              </View>
            ))}
          </View>

          <Text style={styles.section}>Fonts</Text>
          <View style={styles.panel}>
            <Text style={styles.fontLabel}>Heading</Text>
            <View style={styles.fontWrap}>
              {FONTS.map((f) => <FontChip key={f} label={f} active={theme.fonts.heading === f} onPress={() => setFont("heading", f)} />)}
            </View>
            <Text style={[styles.fontLabel, { marginTop: 12 }]}>Body</Text>
            <View style={styles.fontWrap}>
              {FONTS.map((f) => <FontChip key={f} label={f} active={theme.fonts.body === f} onPress={() => setFont("body", f)} />)}
            </View>
          </View>
        </View>

        {/* Live preview */}
        <View style={{ flex: 1 }}>
          <Text style={styles.section}>Storefront preview</Text>
          <View style={[styles.preview, { backgroundColor: c.background, borderColor: A.border }]}>
            <View style={{ backgroundColor: c.headerBg, padding: 14 }}>
              <Text style={{ color: c.headerText, fontSize: 13, letterSpacing: 2 }}>{theme?.business_name?.toUpperCase?.() || "YOUR STORE"}</Text>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={{ color: c.text, fontSize: 26, fontWeight: "600" }}>Timeless pieces</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>Crafted for a lifetime</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 12, backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: c.onPrimary || "#fff", fontSize: 13 }}>Shop now</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10 }}>
                    <View style={{ height: 70, backgroundColor: c.background, borderRadius: 6 }} />
                    <Text style={{ color: c.text, fontSize: 12, marginTop: 8 }}>Gold Ring</Text>
                    <Text style={{ color: c.secondary, fontSize: 12, marginTop: 2 }}>₹ 59,000</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ backgroundColor: c.footerBg, padding: 14 }}>
              <Text style={{ color: c.footerText, fontSize: 12 }}>Hallmarked · Since 1974</Text>
            </View>
          </View>
        </View>
      </View>
    </AdminShell>
  );
}

function normalize(t: any) {
  if (!t || !t.colors) return { preset_id: "classic-gold", ...PRESETS["classic-gold"], colors: { ...PRESETS["classic-gold"].colors }, fonts: { ...PRESETS["classic-gold"].fonts } };
  return t;
}

const FontChip = ({ label, active, onPress }: any) => (
  <Pressable onPress={onPress} testID={`font-${label.replace(/\s/g, "-")}`} style={{ paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, borderColor: active ? A.accent : A.border, backgroundColor: active ? A.accentSoft : A.surface, justifyContent: "center" }}>
    <Text style={{ fontFamily: A.font, fontSize: 12, color: active ? A.accent : A.text }}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  section: { fontFamily: A.fontMed, fontSize: 13, color: A.text, marginTop: 16, marginBottom: 8 },
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 12 },
  presetChip: { paddingHorizontal: 14, height: 36, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface, justifyContent: "center" },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  swatch: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: A.border },
  hexInput: { width: 110, borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, paddingHorizontal: 10, height: 36, fontFamily: A.font, fontSize: 13, color: A.text },
  fontLabel: { fontFamily: A.fontMed, fontSize: 12, color: A.muted },
  fontWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  preview: { borderRadius: A.radius, borderWidth: 1, overflow: "hidden" },
});
