import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Category, getCategories } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { LoadingView } from "@/src/components/StateViews";
import { Skeleton } from "@/src/components/Skeleton";
import { HeaderIcons } from "@/src/components/HeaderIcons";

export default function CollectionsScreen() {
  const { code, status, theme, businessName } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await getCategories(code));
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status === "loading") return <LoadingView />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="collections-screen">
      {/* Sticky header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
              {(businessName || "").toUpperCase()}
            </Text>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["3xl"], color: theme.colors.headerText }}>
              Collections
            </Text>
          </View>
          <HeaderIcons />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"], gap: theme.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={180} radius={theme.radius.lg} />
            ))
          : categories.map((c) => (
              <Pressable
                key={c.id}
                testID={`collection-card-${c.slug}`}
                onPress={() => router.push(`/category/${c.slug}`)}
                style={[styles.card, { borderRadius: theme.radius.lg }]}
              >
                <Image source={{ uri: c.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFillObject} />
                <Text style={{ fontFamily: theme.fonts.headingBold, fontSize: theme.fontSize["2xl"], color: "#FFFFFF" }}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  card: { height: 180, overflow: "hidden", justifyContent: "flex-end", padding: 18 },
});
