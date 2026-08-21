import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getProducts, Product } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { ProductCard } from "@/src/components/ProductCard";
import { ProductCardSkeleton } from "@/src/components/Skeleton";
import { MessageView } from "@/src/components/StateViews";

type PurityFilter = "all" | "22K" | "18K";
type SortFilter = "relevance" | "price_asc" | "price_desc";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");
  const [purity, setPurity] = useState<PurityFilter>("all");
  const [sort, setSort] = useState<SortFilter>("relevance");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setProducts([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      setProducts(
        await getProducts(code, {
          q,
          purity: purity === "all" ? undefined : purity,
          sort: sort === "relevance" ? undefined : sort,
        })
      );
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [code, query, purity, sort]);

  useEffect(() => {
    if (params.q) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searched) return;
    runSearch();
  }, [purity, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const gap = theme.spacing.md;
  const cardW = (width - theme.spacing.lg * 2 - gap) / 2;

  const chip = (active: boolean) => ({
    height: 34,
    paddingHorizontal: 14,
    justifyContent: "center" as const,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: active ? theme.colors.primary : theme.colors.border,
    backgroundColor: active ? theme.colors.primary : "transparent",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="search-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
          <Pressable testID="search-back" onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
          </Pressable>
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search pieces, SKU…"
            placeholderTextColor={theme.colors.muted}
            returnKeyType="search"
            style={{
              flex: 1,
              height: 44,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              paddingHorizontal: 12,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: 15,
            }}
            accessibilityLabel="Search products"
          />
          <Pressable
            testID="search-submit"
            onPress={runSearch}
            style={{ height: 44, paddingHorizontal: 14, justifyContent: "center", backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Feather name="search" size={18} color={theme.colors.onPrimary || "#fff"} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 }}>
          {(["all", "22K", "18K"] as PurityFilter[]).map((p) => (
            <Pressable key={p} testID={`search-purity-${p}`} onPress={() => setPurity(p)} style={chip(purity === p)} accessibilityRole="button">
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: purity === p ? theme.colors.onPrimary : theme.colors.muted }}>
                {p === "all" ? "All purity" : p}
              </Text>
            </Pressable>
          ))}
          {(["relevance", "price_asc", "price_desc"] as SortFilter[]).map((s) => (
            <Pressable key={s} testID={`search-sort-${s}`} onPress={() => setSort(s)} style={chip(sort === s)} accessibilityRole="button">
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: sort === s ? theme.colors.onPrimary : theme.colors.muted }}>
                {s === "relevance" ? "Best match" : s === "price_asc" ? "Price ↑" : "Price ↓"}
              </Text>
            </Pressable>
          ))}
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
      ) : !searched ? (
        <MessageView testID="search-prompt" icon="search" title="Find a piece" subtitle="Search by name or SKU across collections." />
      ) : products.length === 0 ? (
        <MessageView testID="search-empty" icon="feather" title="No matches" subtitle="Try another term or clear purity filters." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }}
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
});
