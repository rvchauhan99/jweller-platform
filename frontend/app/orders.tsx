import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getOrders, Order } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { getGuestId } from "@/src/utils/guest";
import { LoadingView, MessageView } from "@/src/components/StateViews";

export default function OrdersScreen() {
  const { justPlaced } = useLocalSearchParams<{ justPlaced?: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const gid = await getGuestId();
      setOrders(await getOrders(code, gid));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="orders-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="orders-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          My Reservations
        </Text>
      </View>

      {loading ? (
        <LoadingView />
      ) : orders.length === 0 ? (
        <MessageView testID="orders-empty" icon="clipboard" title="No reservations yet" subtitle="Pieces you reserve will appear here." actionLabel="Browse collections" onAction={() => router.replace("/collections")} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }} showsVerticalScrollIndicator={false}>
          {justPlaced ? (
            <View style={[styles.success, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]} testID="order-success-banner">
              <Feather name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base, marginLeft: 8, flex: 1 }}>
                Reservation placed — the store will call you to confirm.
              </Text>
            </View>
          ) : null}

          {orders.map((o) => (
            <View key={o.id} testID={`order-${o.id}`} style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{o.order_no}</Text>
                <View style={[styles.status, { borderColor: theme.colors.primary }]}>
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.sm, textTransform: "capitalize" }}>{o.status}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>{fmtDate(o.created_at)}</Text>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md }} />
              {o.items.map((it) => (
                <View key={it.product_id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.sm, flex: 1 }} numberOfLines={1}>{it.name} × {it.qty}</Text>
                  <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{formatMoney(it.price * it.qty)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.sm }}>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>Total</Text>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.base }}>{formatMoney(o.subtotal)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  success: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1, marginBottom: 16 },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  status: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});
