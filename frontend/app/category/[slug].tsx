import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getProducts, Product } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { ProductCard } from "@/src/components/ProductCard";
import { ProductCardSkeleton } from "@/src/components/Skeleton";
import { MessageView } from "@/src/components/StateViews";

type Filter = "all" | "22K" | "18K" | "priceLow" | "priceHigh";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "22K", label: "22K" },
  { key: "18K", label: "18K" },
  { key: "priceLow", label: "Price ↑" },
  { key: "priceHigh", label: "Price ↓" },
];

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const purity = filter === "22K" || filter === "18K" ? filter : undefined;
      const sort = filter === "priceLow" ? "price_asc" : filter === "priceHigh" ? "price_desc" : undefined;
      setProducts(await getProducts(code, { category: slug, purity, sort }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [code, slug, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const title = String(slug ?? "");
  const titleNice = title.charAt(0).toUpperCase() + title.slice(1);

  const gap = theme.spacing.md;
  const cardW = (width - theme.spacing.lg * 2 - gap) / 2;
  const headerH = 56;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="category-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerRow}>
          <Pressable testID="category-back" onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
          </Pressable>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: theme.spacing.sm, flex: 1 }}>
            {titleNice}
          </Text>
          <Pressable testID="category-search" onPress={() => router.push("/search")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Search">
            <Feather name="search" size={20} color={theme.colors.headerText} />
          </Pressable>
        </View>
        <View style={{ height: headerH, justifyContent: "center" }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, alignItems: "center" }}
          >
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <Pressable
                  key={f.key}
                  testID={`filter-chip-${f.key}`}
                  onPress={() => setFilter(f.key)}
                  style={{
                    height: 36,
                    flexShrink: 0,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    borderRadius: theme.radius.pill,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? theme.colors.primary : "transparent",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={f.label}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSize.sm,
                      color: active ? theme.colors.onPrimary : theme.colors.muted,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap, padding: theme.spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: cardW }}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ) : failed ? (
        <MessageView testID="category-error" icon="alert-triangle" title="Couldn't load collection" subtitle="Please check your connection and try again." actionLabel="Retry" onAction={load} />
      ) : products.length === 0 ? (
        <MessageView testID="category-empty" icon="feather" title="No pieces match" subtitle="Try another purity or clear filters." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: cardW }}>
              <ProductCard product={item} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
});
