import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getRates, Rates } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { useWishlist } from "@/src/context/WishlistContext";
import { useCustomerAuth } from "@/src/context/CustomerAuthContext";

export default function AccountScreen() {
  const { code, theme, businessName, tagline, cms } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count: wishCount } = useWishlist();
  const { ready, token, customer, updateProfile, logout } = useCustomerAuth();
  const [rates, setRates] = useState<Rates | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getRates(code).then(setRates).catch(() => setRates(null));
      if (customer) {
        setName(customer.name || "");
        setEmail(customer.email || "");
      }
    }, [code, customer])
  );

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setSaveMsg("Profile updated");
    } catch (e: any) {
      setSaveErr(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    marginTop: 6,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="account-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
          {(businessName || "").toUpperCase()}
        </Text>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["3xl"], color: theme.colors.headerText }}>
          Account
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }} showsVerticalScrollIndicator={false}>
        {ready && token && customer ? (
          <View testID="account-profile" style={[styles.rateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg }]}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
              PROFILE
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 13, marginTop: 6 }}>{customer.phone}</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, marginTop: 12 }}>Name</Text>
            <TextInput testID="profile-name" value={name} onChangeText={setName} style={inputStyle} accessibilityLabel="Name" />
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, marginTop: 12 }}>Email</Text>
            <TextInput
              testID="profile-email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle}
              accessibilityLabel="Email"
            />
            {saveMsg ? <Text style={{ color: theme.colors.primary, marginTop: 8, fontSize: 13 }}>{saveMsg}</Text> : null}
            {saveErr ? <Text style={{ color: "#DC2626", marginTop: 8, fontSize: 13 }}>{saveErr}</Text> : null}
            <Pressable
              testID="profile-save"
              disabled={saving}
              onPress={handleSaveProfile}
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, opacity: saving ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
            >
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary || "#fff" }}>{saving ? "Saving…" : "Save profile"}</Text>
            </Pressable>
            <Pressable
              testID="profile-sign-out"
              onPress={() => {
                logout();
                setSaveMsg(null);
              }}
              style={{ marginTop: 14, alignItems: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14 }}>Sign out</Text>
            </Pressable>
          </View>
        ) : ready ? (
          <Pressable
            testID="account-sign-in"
            onPress={() => router.push("/login?next=/(tabs)/store")}
            style={[styles.rateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg }]}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: 16 }}>Sign in with mobile OTP</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 13, marginTop: 4 }}>Orders, SIP, and profile need a signed-in account.</Text>
          </Pressable>
        ) : null}

        {rates ? (
          <View style={[styles.rateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]} testID="account-rate-card">
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
              TODAY&apos;S RATE{rates.stale ? " · DELAYED" : ""}
            </Text>
            <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing["2xl"] }}>
              <View>
                <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>Gold / g</Text>
                <Text style={{ fontFamily: theme.fonts.headingBold, color: theme.colors.secondary, fontSize: theme.fontSize["2xl"] }}>{formatMoney(rates.gold.inr_per_gram)}</Text>
              </View>
              <View>
                <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>Silver / g</Text>
                <Text style={{ fontFamily: theme.fonts.headingBold, color: theme.colors.text, fontSize: theme.fontSize["2xl"] }}>{formatMoney(rates.silver.inr_per_gram)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <LinkRow icon="clipboard" label="My orders" onPress={() => router.push("/orders")} />
          <LinkRow icon="heart" label="Wishlist" badge={wishCount} onPress={() => router.push("/wishlist")} />
          <LinkRow icon="shopping-bag" label="Your bag" onPress={() => router.push("/cart")} />
        </View>

        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary, marginTop: theme.spacing["2xl"] }}>
          THE HOUSE
        </Text>
        {tagline ? (
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.text, marginTop: theme.spacing.sm, lineHeight: 30 }}>
            {tagline}
          </Text>
        ) : null}
        {cms?.about_text ? (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.muted, lineHeight: 24, marginTop: theme.spacing.md }}>
            {cms.about_text}
          </Text>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
          <Trust icon="shield" label="Hallmarked & certified purity" />
          <Trust icon="gift" label="Ethically sourced stones" />
          <Trust icon="map-pin" label="Visit us in-store for a private viewing" />
        </View>
      </ScrollView>
    </View>
  );
}

function LinkRow({ icon, label, badge, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; badge?: number; onPress: () => void }) {
  const { theme } = useStore();
  return (
    <Pressable testID={`account-link-${label.toLowerCase().replace(/\s/g, "-")}`} onPress={onPress} style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.linkIcon, { borderColor: theme.colors.border }]}>
        <Feather name={icon} size={17} color={theme.colors.primary} />
      </View>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base, flex: 1 }}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bodyMedium, fontSize: theme.fontSize.sm }}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={18} color={theme.colors.muted} />
    </Pressable>
  );
}

function Trust({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  const { theme } = useStore();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <View style={[styles.linkIcon, { borderColor: theme.colors.border }]}>
        <Feather name={icon} size={16} color={theme.colors.primary} />
      </View>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  rateCard: { padding: 18, borderWidth: StyleSheet.hairlineWidth },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  linkIcon: { width: 40, height: 40, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, borderRadius: 999, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  saveBtn: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 16 },
});
