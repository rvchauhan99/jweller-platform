import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { Product } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { useWishlist } from "@/src/context/WishlistContext";
import { useCart } from "@/src/context/CartContext";
import { MessageView } from "@/src/components/StateViews";

export default function WishlistScreen() {
  const { theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, remove } = useWishlist();
  const { add } = useCart();
  const { width } = useWindowDimensions();

  const gap = theme.spacing.md;
  const cardW = (width - theme.spacing.lg * 2 - gap) / 2;

  const toProduct = (i: (typeof items)[number]): Product =>
    ({ id: i.product_id, name: i.name, price: i.price, images: i.image ? [i.image] : [], weight_grams: i.weight_grams, purity: i.purity } as Product);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="wishlist-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="wishlist-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Wishlist
        </Text>
      </View>

      {items.length === 0 ? (
        <MessageView testID="wishlist-empty" icon="heart" title="No favourites yet" subtitle="Tap the heart on any piece to save it here." actionLabel="Browse collections" onAction={() => router.replace("/collections")} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {items.map((i) => (
              <View key={i.product_id} style={{ width: cardW }} testID={`wishlist-item-${i.product_id}`}>
                <Pressable onPress={() => router.push(`/product/${i.product_id}`)}>
                  <View style={[styles.imgWrap, { borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }]}>
                    <Image source={{ uri: i.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <Pressable testID={`wishlist-remove-${i.product_id}`} onPress={() => remove(i.product_id)} style={[styles.heart, { backgroundColor: theme.colors.surface }]} hitSlop={6}>
                      <Feather name="x" size={15} color={theme.colors.text} />
                    </Pressable>
                  </View>
                </Pressable>
                <Text numberOfLines={1} style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base, marginTop: theme.spacing.sm }}>{i.name}</Text>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.base, marginTop: 2 }}>{formatMoney(i.price)}</Text>
                <Pressable testID={`wishlist-add-${i.product_id}`} onPress={() => add(toProduct(i))} style={[styles.addBtn, { borderColor: theme.colors.primary, borderRadius: theme.radius.pill }]}>
                  <Feather name="shopping-bag" size={13} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.sm }}>Add to bag</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  imgWrap: { aspectRatio: 4 / 5, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  heart: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderWidth: 1, marginTop: theme_gap() },
});

function theme_gap() {
  return 10;
}
