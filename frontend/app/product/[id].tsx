import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getProduct, Product } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { useCart } from "@/src/context/CartContext";
import { useWishlist } from "@/src/context/WishlistContext";
import { LoadingView, MessageView } from "@/src/components/StateViews";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { add } = useCart();
  const { has, toggle } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setProduct(await getProduct(code, String(id)));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [code, id]);

  useEffect(() => {
    load();
  }, [load]);

  const BackButton = () => (
    <Pressable
      testID="product-back"
      onPress={() => router.back()}
      style={[styles.backBtn, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.35)" }]}
      hitSlop={10}
    >
      <Feather name="chevron-left" size={24} color="#FFFFFF" />
    </Pressable>
  );

  if (loading) return <LoadingView label="Loading piece" />;
  if (failed || !product) {
    return (
      <View style={{ flex: 1 }}>
        <BackButton />
        <MessageView testID="product-error" icon="alert-triangle" title="Product unavailable" subtitle="We couldn't load this piece." actionLabel="Retry" onAction={load} />
      </View>
    );
  }

  const imageH = width * 1.15;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="product-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ height: imageH }}>
          <Image source={{ uri: product.images?.[0] }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={350} accessibilityLabel={product.name} />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent"]} style={{ height: 120 }} />
        </View>
        <BackButton />
        <View style={[styles.topRight, { top: insets.top + 8 }]}>
          <Pressable
            testID="product-wishlist-button"
            onPress={() => product && toggle(product)}
            style={[styles.roundBtn, { backgroundColor: "rgba(0,0,0,0.35)" }]}
            hitSlop={8}
          >
            <Feather name="heart" size={20} color={product && has(product.id) ? theme.colors.primary : "#FFFFFF"} />
          </Pressable>
          <Pressable
            testID="product-cart-button"
            onPress={() => router.push("/cart")}
            style={[styles.roundBtn, { backgroundColor: "rgba(0,0,0,0.35)" }]}
            hitSlop={8}
          >
            <Feather name="shopping-bag" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={{ padding: theme.spacing.lg }}>
          {product.category_name ? (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
              {product.category_name.toUpperCase()}
            </Text>
          ) : null}
          <Text style={{ fontFamily: theme.fonts.headingBold, fontSize: theme.fontSize["3xl"], color: theme.colors.text, marginTop: theme.spacing.xs }}>
            {product.name}
          </Text>
          <Text testID="product-price" style={{ fontFamily: theme.fonts.bodyMedium, fontSize: theme.fontSize.xl, color: theme.colors.secondary, marginTop: theme.spacing.sm }}>
            {formatMoney(product.live_price ?? product.price, product.currency)}
          </Text>
          {product.pricing ? (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.muted, marginTop: 4 }}>
              @ today&apos;s {product.pricing.purity} rate · {formatMoney(product.pricing.rate_per_gram)}/g{product.pricing.stale ? " (delayed)" : ""}
            </Text>
          ) : null}

          {/* Purity chip */}
          <View style={[styles.chip, { borderColor: theme.colors.border, borderRadius: theme.radius.pill, marginTop: theme.spacing.md }]}>
            <Feather name="award" size={13} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.sm }}>{product.purity} Hallmarked</Text>
          </View>

          {/* Live price breakdown */}
          {product.pricing ? (
            <View style={{ marginTop: theme.spacing.xl }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 1.5, color: theme.colors.secondary, marginBottom: 4 }}>
                PRICE BREAKDOWN
              </Text>
              <SpecRow label={`Metal (${product.pricing.weight_grams}g · ${product.pricing.purity})`} value={formatMoney(product.pricing.metal_value)} />
              <SpecRow
                label={product.pricing.making_charge_type === "percent" ? "Making charge" : "Making charge (flat)"}
                value={formatMoney(product.pricing.making)}
              />
              <SpecRow label="SKU" value={product.sku} last />
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginTop: 4 }}>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, fontSize: theme.fontSize.lg, color: theme.colors.text }}>Live price</Text>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, fontSize: theme.fontSize.lg, color: theme.colors.secondary }}>{formatMoney(product.pricing.live_price)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Feather name="refresh-cw" size={12} color={theme.colors.muted} />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.muted }}>
                  Updates automatically with the live gold rate
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: theme.spacing.xl }}>
              <SpecRow label="Weight" value={`${product.weight_grams} g`} />
              <SpecRow label="Purity" value={product.purity} />
              <SpecRow label="Making charge" value={formatMoney(product.making_charge, product.currency)} />
              <SpecRow label="SKU" value={product.sku} last />
            </View>
          )}

          <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.muted, lineHeight: 24, marginTop: theme.spacing.xl }}>
            {product.description}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: insets.bottom + theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <Pressable
          testID="add-to-bag-button"
          style={[styles.actionButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
          onPress={() => {
            add(product);
            router.push("/cart");
          }}
        >
          <Feather name="shopping-bag" size={17} color={theme.colors.onPrimary} />
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
            Add to bag
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SpecRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { theme } = useStore();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, fontSize: theme.fontSize.base, color: theme.colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: { position: "absolute", right: 16, flexDirection: "row", gap: 10 },
  roundBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
