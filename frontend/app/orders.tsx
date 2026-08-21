import React, { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { downloadOrderInvoice, getOrders, Order } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { LoadingView, MessageView } from "@/src/components/StateViews";
import { useCustomerAuth } from "@/src/context/CustomerAuthContext";

export default function OrdersScreen() {
  const { justPlaced } = useLocalSearchParams<{ justPlaced?: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, ready, logout } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      setOrders(await getOrders(code));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [code, token]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      if (!token) {
        router.replace("/login?next=/orders");
        return;
      }
      setLoading(true);
      load();
    }, [load, ready, token, router])
  );

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  const handleInvoice = async (orderId: string) => {
    try {
      const { filename, base64 } = await downloadOrderInvoice(code, orderId);
      const safeName = (filename || `${orderId}.pdf`).replace(/[^\w.\-]+/g, "_");
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = `data:application/pdf;base64,${base64}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = safeName;
        a.click();
        return;
      }
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!dir) {
        throw new Error("Storage unavailable on this device");
      }
      const uri = `${dir}${safeName}`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Invoice saved", `Saved to ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: safeName,
        UTI: "com.adobe.pdf",
      });
    } catch (e: any) {
      Alert.alert("Invoice", e?.message ?? "Could not download invoice");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="orders-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="orders-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8, flex: 1 }}>
          My orders
        </Text>
        <Pressable onPress={logout} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sign out">
          <Feather name="log-out" size={20} color={theme.colors.muted} />
        </Pressable>
      </View>

      {loading ? (
        <LoadingView />
      ) : orders.length === 0 ? (
        <MessageView testID="orders-empty" icon="clipboard" title="No orders yet" subtitle="Pieces you buy will appear here." actionLabel="Browse collections" onAction={() => router.replace("/collections")} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }} showsVerticalScrollIndicator={false}>
          {justPlaced ? (
            <View style={[styles.success, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]} testID="order-success-banner">
              <Feather name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base, marginLeft: 8, flex: 1 }}>
                Payment received — the store will prepare your order.
              </Text>
            </View>
          ) : null}

          {orders.map((o) => (
            <View key={o.id} testID={`order-${o.id}`} style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{o.order_no}</Text>
                <View style={[styles.status, { borderColor: theme.colors.primary }]}>
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.sm, textTransform: "capitalize" }}>
                    {o.payment_status === "paid" ? "paid" : o.status}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>{fmtDate(o.created_at)}</Text>
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.lg, marginTop: 8 }}>{formatMoney(o.subtotal)}</Text>
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 4 }}>
                {o.items?.length || 0} item(s)
              </Text>
              {o.payment_status === "paid" ? (
                <Pressable
                  testID={`order-invoice-${o.id}`}
                  onPress={() => handleInvoice(o.id)}
                  style={{ marginTop: 12, flexDirection: "row", alignItems: "center" }}
                  accessibilityRole="button"
                  accessibilityLabel="Download invoice"
                >
                  <Feather name="download" size={16} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, marginLeft: 6, fontSize: 14 }}>
                    Download invoice
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  status: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  success: { flexDirection: "row", alignItems: "center", borderWidth: 1, padding: 14, marginBottom: 16 },
});
