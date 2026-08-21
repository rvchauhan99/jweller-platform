import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { useCart } from "@/src/context/CartContext";
import { MessageView } from "@/src/components/StateViews";

export default function CartScreen() {
  const { theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, setQty, remove } = useCart();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="cart-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="cart-back" onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Your Bag
        </Text>
      </View>

      {items.length === 0 ? (
        <MessageView testID="cart-empty" icon="shopping-bag" title="Your bag is empty" subtitle="Add pieces you love and reserve them for an in-store viewing." actionLabel="Browse collections" onAction={() => router.replace("/collections")} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
            {items.map((it) => (
              <View key={it.product_id} testID={`cart-item-${it.product_id}`} style={[styles.item, { borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }]}>
                <Image source={{ uri: it.image }} style={{ width: 84, height: 100, borderRadius: theme.radius.md, backgroundColor: theme.colors.background }} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text numberOfLines={2} style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{it.name}</Text>
                  <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>{it.weight_grams}g · {it.purity}</Text>
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.base, marginTop: 4 }}>{formatMoney(it.price, undefined)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: theme.spacing.sm }}>
                    <Stepper value={it.qty} onDec={() => setQty(it.product_id, it.qty - 1)} onInc={() => setQty(it.product_id, it.qty + 1)} />
                    <View style={{ flex: 1 }} />
                    <Pressable testID={`cart-remove-${it.product_id}`} onPress={() => remove(it.product_id)} hitSlop={8}>
                      <Feather name="trash-2" size={18} color={theme.colors.muted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.bar, { paddingBottom: insets.bottom + theme.spacing.md, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.sm }}>
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base }}>Subtotal</Text>
              <Text testID="cart-subtotal" style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.lg }}>{formatMoney(subtotal)}</Text>
            </View>
            <Pressable testID="cart-checkout-button" onPress={() => router.push("/checkout")} style={[styles.cta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}>
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>Reserve these pieces</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  const { theme } = useStore();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill }}>
      <Pressable testID="qty-dec" onPress={onDec} hitSlop={6} style={styles.stepBtn}>
        <Feather name="minus" size={16} color={theme.colors.text} />
      </Pressable>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base, minWidth: 22, textAlign: "center" }}>{value}</Text>
      <Pressable testID="qty-inc" onPress={onInc} hitSlop={6} style={styles.stepBtn}>
        <Feather name="plus" size={16} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: "row", padding: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { height: 52, alignItems: "center", justifyContent: "center" },
});
