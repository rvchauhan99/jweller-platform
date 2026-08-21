import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { A } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [cms, setCms] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([adminFetch("/admin/settings"), adminFetch("/admin/cms")]);
    setSettings(s);
    setCms(c);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const flash = (m: string) => { setSavedMsg(m); setTimeout(() => setSavedMsg(null), 2000); };

  const saveProfile = async () => {
    await adminFetch("/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        business_name: settings.business_name,
        gstin: settings.gstin,
        invoice_prefix: settings.invoice_prefix,
        rate_margins: {
          gold_pct: parseFloat(settings.rate_margins?.gold_pct) || 0,
          silver_pct: parseFloat(settings.rate_margins?.silver_pct) || 0,
        },
      }),
    });
    flash("Settings saved");
  };

  const saveCms = async () => {
    await adminFetch("/admin/cms", {
      method: "PUT",
      body: JSON.stringify({
        hero_title: cms.hero_title, hero_subtitle: cms.hero_subtitle, hero_image: cms.hero_image,
        about_title: cms.about_title, about_text: cms.about_text,
      }),
    });
    flash("Storefront content saved");
  };

  if (!settings || !cms) return <AdminShell title="Settings"><Text style={{ fontFamily: A.font, color: A.muted }}>Loading…</Text></AdminShell>;

  const setS = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));
  const setMargin = (k: string, v: string) => setSettings((p: any) => ({ ...p, rate_margins: { ...p.rate_margins, [k]: v } }));
  const setC = (k: string, v: any) => setCms((p: any) => ({ ...p, [k]: v }));

  return (
    <AdminShell title="Settings" subtitle={savedMsg ?? "Business profile, rate margins & storefront content"}>
      <Text style={styles.section}>Rate margins</Text>
      <View style={styles.panel}>
        <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginBottom: 10 }}>
          Your sell price = live metal rate + this margin %. Applied to storefront pricing and SIP accrual.
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Gold margin %" style={{ flex: 1 }}><Inp testID="margin-gold" keyboardType="decimal-pad" value={String(settings.rate_margins?.gold_pct ?? 0)} onChangeText={(v: string) => setMargin("gold_pct", v)} /></Field>
          <Field label="Silver margin %" style={{ flex: 1 }}><Inp testID="margin-silver" keyboardType="decimal-pad" value={String(settings.rate_margins?.silver_pct ?? 0)} onChangeText={(v: string) => setMargin("silver_pct", v)} /></Field>
        </View>
      </View>

      <Text style={styles.section}>Business profile</Text>
      <View style={styles.panel}>
        <Field label="Business name"><Inp testID="set-name" value={settings.business_name || ""} onChangeText={(v: string) => setS("business_name", v)} /></Field>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="GSTIN" style={{ flex: 1 }}><Inp testID="set-gstin" autoCapitalize="characters" value={settings.gstin || ""} onChangeText={(v: string) => setS("gstin", v)} /></Field>
          <Field label="Invoice prefix" style={{ width: 140 }}><Inp testID="set-invoice" autoCapitalize="characters" value={settings.invoice_prefix || ""} onChangeText={(v: string) => setS("invoice_prefix", v)} /></Field>
        </View>
        <Pressable testID="save-settings" onPress={saveProfile} style={styles.btn}><Text style={styles.btnText}>Save settings</Text></Pressable>
      </View>

      <Text style={styles.section}>Storefront content (CMS)</Text>
      <View style={styles.panel}>
        <Field label="Hero title"><Inp testID="cms-hero-title" value={cms.hero_title || ""} onChangeText={(v: string) => setC("hero_title", v)} /></Field>
        <Field label="Hero subtitle"><Inp testID="cms-hero-sub" value={cms.hero_subtitle || ""} onChangeText={(v: string) => setC("hero_subtitle", v)} /></Field>
        <Field label="Hero image URL"><Inp testID="cms-hero-img" autoCapitalize="none" value={cms.hero_image || ""} onChangeText={(v: string) => setC("hero_image", v)} /></Field>
        <Field label="About title"><Inp testID="cms-about-title" value={cms.about_title || ""} onChangeText={(v: string) => setC("about_title", v)} /></Field>
        <Field label="About text"><Inp testID="cms-about-text" multiline value={cms.about_text || ""} onChangeText={(v: string) => setC("about_text", v)} /></Field>
        <Pressable testID="save-cms" onPress={saveCms} style={styles.btn}><Text style={styles.btnText}>Save content</Text></Pressable>
      </View>
    </AdminShell>
  );
}

const Field = ({ label, children, style }: any) => (
  <View style={[{ marginBottom: 12 }, style]}>
    <Text style={{ fontFamily: A.fontMed, fontSize: 12, color: A.text, marginBottom: 4 }}>{label}</Text>
    {children}
  </View>
);
const Inp = (props: any) => (
  <TextInput placeholderTextColor={A.muted} {...props} style={[{ borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, backgroundColor: A.surface, color: A.text, fontFamily: A.font, minHeight: 42, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 }, props.multiline && { minHeight: 80 }]} />
);

const styles = StyleSheet.create({
  section: { fontFamily: A.fontMed, fontSize: 13, color: A.text, marginTop: 16, marginBottom: 8 },
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16 },
  btn: { height: 42, borderRadius: A.radiusSm, backgroundColor: A.primary, alignItems: "center", justifyContent: "center", marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 24 },
  btnText: { fontFamily: A.fontMed, color: A.onPrimary, fontSize: 14 },
});
