import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { Category, getCategories, getProducts, Product } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { ProductCard } from "@/src/components/ProductCard";
import { ProductCardSkeleton } from "@/src/components/Skeleton";
import { LoadingView, MessageView } from "@/src/components/StateViews";
import { HeaderIcons } from "@/src/components/HeaderIcons";
import { BrandMark } from "@/src/components/BrandMark";
import { useSipReminders } from "@/src/context/SipRemindersContext";

export default function HomeScreen() {
  const { code, status, theme, businessName, sections, cms, errorMessage, reload } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { next: dueReminder, refresh: refreshReminders } = useSipReminders();
  const [reminderDismissed, setReminderDismissed] = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        getCategories(code),
        getProducts(code, { featured: true }),
      ]);
      setCategories(cats);
      setFeatured(prods);
    } catch {
      setCategories([]);
      setFeatured([]);
    } finally {
      setDataLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (status === "ready") loadData();
  }, [status, loadData]);

  useFocusEffect(
    useCallback(() => {
      refreshReminders();
    }, [refreshReminders])
  );

  if (status === "loading") return <LoadingView label="Opening store" />;
  if (status !== "ready") {
    return (
      <MessageView
        testID="store-unavailable-view"
        icon={status === "notfound" ? "help-circle" : "alert-triangle"}
        title={status === "notfound" ? "Store not found" : "Temporarily unavailable"}
        subtitle={errorMessage}
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }

  const hasSection = (t: string) => sections.some((s) => s.type === t);
  const heroImage = cms?.hero_image;
  const gap = theme.spacing.md;
  const cardW = (width - theme.spacing.lg * 2 - gap) / 2;

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={{ height: 480 }}>
        <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View testID="home-wordmark" style={{ flex: 1 }}>
              <BrandMark onDark compact />
            </View>
            <HeaderIcons tint="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }} />
          <Text
            style={{ fontFamily: theme.fonts.headingBold, fontSize: theme.fontSize["4xl"], color: "#FFFFFF", lineHeight: theme.fontSize["4xl"] + 6 }}
          >
            {cms?.hero_title ?? businessName}
          </Text>
          {cms?.hero_subtitle ? (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.lg, color: "#FFFFFF", opacity: 0.9, marginTop: theme.spacing.sm }}>
              {cms.hero_subtitle}
            </Text>
          ) : null}
          <Pressable
            testID="hero-explore-button"
            onPress={() => router.push("/collections")}
            style={[styles.heroButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, marginTop: theme.spacing.xl }]}
          >
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
              Explore Collections
            </Text>
            <Feather name="arrow-right" size={16} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Rate ticker (stubbed static rate) */}
      {hasSection("rate_ticker") && cms?.rate ? (
        <View style={[styles.ticker, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]} testID="rate-ticker">
          <Feather name="trending-up" size={14} color={theme.colors.secondary} />
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.sm, marginLeft: theme.spacing.sm }}>
            {cms.rate.metal}
          </Text>
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginLeft: theme.spacing.sm }}>
            {cms.rate.value}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>
            {cms.rate.note}
          </Text>
        </View>
      ) : null}

      {/* SIP due reminder nudge */}
      {dueReminder && !reminderDismissed ? (
        <Pressable
          testID="sip-reminder-card"
          onPress={() => router.push("/sip")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: theme.spacing.lg,
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Feather name="bell" size={16} color={theme.colors.onPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>
              Installment due
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 1 }}>
              {dueReminder.plan_name} · {formatMoney(dueReminder.amount)} — tap to pay
            </Text>
          </View>
          <Pressable testID="sip-reminder-dismiss" onPress={() => setReminderDismissed(true)} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={theme.colors.muted} />
          </Pressable>
        </Pressable>
      ) : null}

      {/* Categories */}
      {hasSection("categories") ? (
        <View style={{ marginTop: theme.spacing["2xl"] }}>
          <SectionTitle title="Collections" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}
          >
            {(dataLoading ? [] : categories).map((c) => (
              <Pressable
                key={c.id}
                testID={`home-category-${c.slug}`}
                onPress={() => router.push(`/category/${c.slug}`)}
                style={{ width: 130 }}
              >
                <Image
                  source={{ uri: c.image }}
                  style={{ width: 130, height: 160, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }}
                  contentFit="cover"
                  transition={300}
                />
                <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base, marginTop: theme.spacing.sm }}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Featured products */}
      {hasSection("featured") ? (
        <View style={{ marginTop: theme.spacing["2xl"], paddingHorizontal: theme.spacing.lg }}>
          <SectionTitle title="Featured Pieces" inset={0} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap, marginTop: theme.spacing.md }}>
            {dataLoading
              ? [0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ width: cardW }}>
                    <ProductCardSkeleton />
                  </View>
                ))
              : featured.map((p) => (
                  <View key={p.id} style={{ width: cardW }}>
                    <ProductCard product={p} />
                  </View>
                ))}
          </View>
        </View>
      ) : null}

      {/* About */}
      {hasSection("about") && cms?.about_text ? (
        <View style={{ marginTop: theme.spacing["3xl"], paddingHorizontal: theme.spacing.lg }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
            {(cms.about_title ?? "About").toUpperCase()}
          </Text>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.text, marginTop: theme.spacing.sm, lineHeight: 30 }}>
            {businessName}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.muted, marginTop: theme.spacing.md, lineHeight: 24 }}>
            {cms.about_text}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.footerBg, marginTop: theme.spacing["3xl"] }]}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize.xl, color: theme.colors.footerText }}>
          {businessName}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.footerText, opacity: 0.7, marginTop: theme.spacing.xs }}>
          Handcrafted · Hallmarked · Since 1974
        </Text>
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title, inset }: { title: string; inset?: number }) {
  const { theme } = useStore();
  return (
    <Text
      style={{
        fontFamily: theme.fonts.heading,
        fontSize: theme.fontSize["2xl"],
        color: theme.colors.text,
        paddingHorizontal: inset ?? theme.spacing.lg,
        marginBottom: theme.spacing.md,
      }}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  heroContent: { flex: 1, paddingBottom: 28 },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" },
});
