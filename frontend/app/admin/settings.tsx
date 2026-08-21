import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { A } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [cms, setCms] = useState<any>(null);
  const [gateway, setGateway] = useState<any>(null);
  const [gatewayForbidden, setGatewayForbidden] = useState(false);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([adminFetch("/admin/settings"), adminFetch("/admin/cms")]);
    setSettings(s);
    setCms(c);
    try {
      const gw = await adminFetch("/admin/gateway");
      setGateway(gw);
      setGatewayForbidden(false);
      setKeySecret("");
      setWebhookSecret("");
    } catch (e: any) {
      if (e?.status === 403) {
        setGatewayForbidden(true);
        setGateway(null);
      }
    }
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

  const saveGateway = async () => {
    if (!gateway) return;
    const body: any = {
      provider: gateway.provider || "razorpay",
      key_id: gateway.key_id || "",
      enabled: !!gateway.enabled,
    };
    if (keySecret.trim()) body.key_secret = keySecret.trim();
    if (webhookSecret.trim()) body.webhook_secret = webhookSecret.trim();
    const updated = await adminFetch("/admin/gateway", { method: "PUT", body: JSON.stringify(body) });
    setGateway(updated);
    setKeySecret("");
    setWebhookSecret("");
    flash("Gateway saved");
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

      {gatewayForbidden ? (
        <>
          <Text style={styles.section}>Payment gateway</Text>
          <View style={styles.panel}>
            <Text style={{ fontFamily: A.fontMed, fontSize: 14, color: A.text }} testID="gateway-owner-only">Owner only</Text>
            <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted, marginTop: 6 }}>
              Gateway keys can only be managed by the store owner.
            </Text>
          </View>
        </>
      ) : gateway ? (
        <>
          <Text style={styles.section}>Payment gateway (owner)</Text>
          <View style={styles.panel} testID="gateway-section">
            <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginBottom: 10 }}>
              Razorpay Model B — webhook URL: {"{API}"}/api/public/webhooks/razorpay
            </Text>
            <Field label="Key ID">
              <Inp
                testID="gateway-key-id"
                autoCapitalize="none"
                value={gateway.key_id || ""}
                onChangeText={(v: string) => setGateway({ ...gateway, key_id: v })}
              />
            </Field>
            <Field label={gateway.key_secret_set ? "Key secret (leave blank to keep)" : "Key secret"}>
              <Inp
                testID="gateway-key-secret"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
                placeholder={gateway.key_secret_set ? "•••••••• (set)" : ""}
                value={keySecret}
                onChangeText={setKeySecret}
              />
            </Field>
            <Field label={gateway.webhook_secret_set ? "Webhook secret (leave blank to keep)" : "Webhook secret"}>
              <Inp
                testID="gateway-webhook-secret"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
                placeholder={gateway.webhook_secret_set ? "•••••••• (set)" : ""}
                value={webhookSecret}
                onChangeText={setWebhookSecret}
              />
            </Field>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 8 }}>
              <Switch
                testID="gateway-enabled"
                value={!!gateway.enabled}
                onValueChange={(v) => setGateway({ ...gateway, enabled: v })}
                trackColor={{ true: A.accent }}
              />
              <Text style={{ fontFamily: A.font, fontSize: 13, color: A.text }}>Gateway enabled</Text>
            </View>
            <Pressable testID="save-gateway" onPress={saveGateway} style={styles.btn}><Text style={styles.btnText}>Save gateway</Text></Pressable>
          </View>
        </>
      ) : null}
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
