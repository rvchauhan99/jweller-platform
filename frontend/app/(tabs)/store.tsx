import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { AnimatedPressable } from "@/src/components/AnimatedPressable";
import { FadeInView } from "@/src/components/FadeInView";
import { useStore } from "@/src/theme/StoreProvider";
import { useWishlist } from "@/src/context/WishlistContext";
import { useCustomerAuth } from "@/src/context/CustomerAuthContext";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AccountScreen() {
  const { theme, businessName, tagline, cms } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count: wishCount } = useWishlist();
  const { ready, token, customer, updateProfile, logout } = useCustomerAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setEmail(customer.email || "");
    }
  }, [customer]);

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
    borderRadius: theme.radius.lg,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    marginTop: 6,
  };

  const cardShadow = Platform.select({
    ios: {
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
  });

  const displayName = customer?.name || customer?.phone || "";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="account-screen">
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            backgroundColor: theme.colors.headerBg,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.sm,
            letterSpacing: 2.5,
            color: theme.colors.secondary,
          }}
        >
          {(businessName || "").toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: theme.fontSize["3xl"],
            color: theme.colors.headerText,
          }}
        >
          Account
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {ready && token && customer ? (
          <FadeInView direction="up" duration={400}>
            <View
              testID="account-profile"
              style={[
                styles.rateCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  marginBottom: theme.spacing.lg,
                  ...cardShadow,
                },
              ]}
            >
              {/* Avatar + name header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.lg }}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: `${theme.colors.primary}14`,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.headingBold,
                      color: theme.colors.primary,
                      fontSize: 20,
                    }}
                  >
                    {initials(displayName)}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyMedium,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.lg,
                    }}
                  >
                    {customer.name || "Customer"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      color: theme.colors.muted,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {customer.phone}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSize.sm,
                  letterSpacing: 2,
                  color: theme.colors.secondary,
                  marginBottom: theme.spacing.md,
                }}
              >
                EDIT PROFILE
              </Text>

              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text }}>Name</Text>
              <TextInput
                testID="profile-name"
                value={name}
                onChangeText={setName}
                style={inputStyle}
                accessibilityLabel="Name"
              />
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, marginTop: 14 }}>
                Email
              </Text>
              <TextInput
                testID="profile-email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={inputStyle}
                accessibilityLabel="Email"
              />
              {saveMsg ? (
                <Text style={{ color: theme.colors.primary, marginTop: 8, fontSize: 13 }}>
                  {saveMsg}
                </Text>
              ) : null}
              {saveErr ? (
                <Text style={{ color: "#DC2626", marginTop: 8, fontSize: 13 }}>{saveErr}</Text>
              ) : null}

              <AnimatedPressable
                testID="profile-save"
                disabled={saving}
                onPress={handleSaveProfile}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radius.pill,
                    opacity: saving ? 0.5 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Save profile"
                pressScale={0.96}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.onPrimary || "#fff",
                  }}
                >
                  {saving ? "Saving…" : "Save profile"}
                </Text>
              </AnimatedPressable>

              <Pressable
                testID="profile-sign-out"
                onPress={() => {
                  logout();
                  setSaveMsg(null);
                }}
                style={{ marginTop: 16, alignItems: "center" }}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14 }}>
                  Sign out
                </Text>
              </Pressable>
            </View>
          </FadeInView>
        ) : ready ? (
          <FadeInView direction="up" duration={400}>
            <AnimatedPressable
              testID="account-sign-in"
              onPress={() => router.push("/login?next=/(tabs)/store")}
              style={[
                styles.rateCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  marginBottom: theme.spacing.lg,
                  ...cardShadow,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              pressScale={0.98}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View
                  style={[
                    styles.avatar,
                    {
                      width: 48,
                      height: 48,
                      backgroundColor: `${theme.colors.primary}14`,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Feather name="user" size={22} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyMedium,
                      color: theme.colors.text,
                      fontSize: 16,
                    }}
                  >
                    Sign in with mobile OTP
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      color: theme.colors.muted,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    Orders, SIP, and profile need a signed-in account.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={theme.colors.muted} />
              </View>
            </AnimatedPressable>
          </FadeInView>
        ) : null}

        <FadeInView delay={100} direction="up">
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <LinkRow icon="trending-up" label="Today's rates" onPress={() => router.push("/")} />
            <LinkRow icon="clipboard" label="My orders" onPress={() => router.push("/orders")} />
            <LinkRow
              icon="heart"
              label="Wishlist"
              badge={wishCount}
              onPress={() => router.push("/wishlist")}
            />
            <LinkRow
              icon="shopping-bag"
              label="Your bag"
              onPress={() => router.push("/cart")}
            />
          </View>
        </FadeInView>

        <FadeInView delay={200} direction="up">
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSize.sm,
              letterSpacing: 2.5,
              color: theme.colors.secondary,
              marginTop: theme.spacing["2xl"],
            }}
          >
            THE HOUSE
          </Text>
          {tagline ? (
            <Text
              style={{
                fontFamily: theme.fonts.heading,
                fontSize: theme.fontSize["2xl"],
                color: theme.colors.text,
                marginTop: theme.spacing.sm,
                lineHeight: 30,
              }}
            >
              {tagline}
            </Text>
          ) : null}
          {cms?.about_text ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSize.base,
                color: theme.colors.muted,
                lineHeight: 24,
                marginTop: theme.spacing.md,
              }}
            >
              {cms.about_text}
            </Text>
          ) : null}
        </FadeInView>

        <FadeInView delay={300} direction="up">
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.lg }}>
            <Trust icon="shield" label="Hallmarked & certified purity" />
            <Trust icon="gift" label="Ethically sourced stones" />
            <Trust icon="map-pin" label="Visit us in-store for a private viewing" />
          </View>
        </FadeInView>
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  const { theme } = useStore();
  return (
    <AnimatedPressable
      testID={`account-link-${label.toLowerCase().replace(/\s/g, "-")}`}
      onPress={onPress}
      style={[
        styles.linkRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          ...Platform.select({
            ios: {
              shadowColor: theme.colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            },
            android: { elevation: 1 },
          }),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic={false}
      pressScale={0.98}
    >
      <View style={[styles.linkIcon, { backgroundColor: `${theme.colors.primary}0A`, borderColor: theme.colors.border }]}>
        <Feather name={icon} size={17} color={theme.colors.primary} />
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          color: theme.colors.text,
          fontSize: theme.fontSize.base,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.fontSize.sm,
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={18} color={theme.colors.muted} />
    </AnimatedPressable>
  );
}

function Trust({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  const { theme } = useStore();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <View
        style={[
          styles.trustIcon,
          {
            backgroundColor: `${theme.colors.primary}0A`,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Feather name={icon} size={16} color={theme.colors.primary} />
      </View>
      <Text
        style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  rateCard: { padding: 20, borderWidth: StyleSheet.hairlineWidth },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  trustIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 18 },
});
