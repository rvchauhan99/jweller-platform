import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { A, money, STATUS_COLOR } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

const FLOW = ["reserved", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(() => { adminFetch("/admin/orders").then(setOrders).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (id: string, status: string) => {
    const updated = await adminFetch(`/admin/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
  };

  return (
    <AdminShell title="Orders" subtitle={`${orders.length} reservations`}>
      {orders.length === 0 ? (
        <View style={styles.panel}><Text style={{ fontFamily: A.font, color: A.muted }}>No online reservations yet.</Text></View>
      ) : (
        orders.map((o) => (
          <View key={o.id} style={styles.card} testID={`order-${o.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: A.fontMed, fontSize: 14, color: A.text }}>{o.order_no}</Text>
                <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginTop: 2 }}>
                  {o.contact?.name} · {o.contact?.phone} · {o.address?.city} {o.address?.pincode}
                </Text>
              </View>
              <Text style={{ fontFamily: A.fontMed, fontSize: 15, color: A.text }}>{money(o.subtotal)}</Text>
            </View>

            <View style={{ marginTop: 10 }}>
              {o.items?.map((it: any) => (
                <Text key={it.product_id} style={{ fontFamily: A.font, fontSize: 12, color: A.muted }}>
                  • {it.name} × {it.qty} — {money(it.price * it.qty)}
                </Text>
              ))}
            </View>

            {/* Status pipeline */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
              {FLOW.map((s) => {
                const active = o.status === s;
                return (
                  <Pressable
                    key={s}
                    testID={`order-status-${o.id}-${s}`}
                    onPress={() => setStatus(o.id, s)}
                    style={{
                      paddingHorizontal: 12, height: 32, borderRadius: 999, justifyContent: "center",
                      borderWidth: 1, borderColor: active ? (STATUS_COLOR[s] ?? A.accent) : A.border,
                      backgroundColor: active ? (STATUS_COLOR[s] ?? A.accent) : A.surface,
                    }}
                  >
                    <Text style={{ fontFamily: A.font, fontSize: 12, color: active ? A.onPrimary : A.muted, textTransform: "capitalize" }}>{s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16 },
  card: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16, marginBottom: 12 },
});
