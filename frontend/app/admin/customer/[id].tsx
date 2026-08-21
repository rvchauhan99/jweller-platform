import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A, money, STATUS_COLOR } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminCustomerDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id || ""));
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setError(null);
      adminFetch(`/admin/customers/${encodeURIComponent(id)}`)
        .then(setData)
        .catch((e: any) => setError(e?.message ?? "Customer not found"));
    }, [id])
  );

  if (error) {
    return (
      <AdminShell title="Customer" action={<BackBtn onPress={() => router.back()} />}>
        <Text style={{ fontFamily: A.font, color: A.danger }}>{error}</Text>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell title="Customer" action={<BackBtn onPress={() => router.back()} />}>
        <Text style={{ fontFamily: A.font, color: A.muted }}>Loading…</Text>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={data.name}
      subtitle={`${data.phone}${data.email ? ` · ${data.email}` : ""}`}
      action={<BackBtn onPress={() => router.push("/admin/customers" as any)} />}
    >
      <View style={styles.stats}>
        <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted }}>
          <Text style={{ fontFamily: A.fontMed, color: A.text }}>{data.order_count}</Text> orders
        </Text>
        <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted }}>
          <Text style={{ fontFamily: A.fontMed, color: A.text }}>{data.sip_count}</Text> SIP
        </Text>
      </View>

      <Text style={styles.section}>Orders</Text>
      <View style={styles.panel}>
        {!data.orders?.length ? (
          <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 13 }}>No orders.</Text>
        ) : (
          data.orders.map((o: any, idx: number) => (
            <View key={o.id} style={[styles.rowItem, idx > 0 && { borderTopWidth: 1, borderTopColor: A.border }]} testID={`cust-order-${o.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{o.order_no}</Text>
                <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted, marginTop: 1 }}>
                  {o.created_at ? new Date(o.created_at).toLocaleString("en-IN") : ""}
                </Text>
              </View>
              <Text style={{ fontFamily: A.font, fontSize: 12, color: STATUS_COLOR[o.status] ?? A.muted, textTransform: "capitalize", marginRight: 12 }}>
                {o.status}
              </Text>
              <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{money(o.subtotal)}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.section}>SIP enrollments</Text>
      <View style={styles.panel}>
        {!data.sip_enrollments?.length ? (
          <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 13 }}>No SIP enrollments.</Text>
        ) : (
          data.sip_enrollments.map((e: any, idx: number) => (
            <View key={e.id} style={[styles.rowItem, idx > 0 && { borderTopWidth: 1, borderTopColor: A.border }]} testID={`cust-sip-${e.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{e.plan_name || "SIP"}</Text>
                <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted, marginTop: 1, textTransform: "capitalize" }}>
                  {e.status || "—"}
                </Text>
              </View>
              <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginRight: 12 }}>
                {(e.summary?.grams_accrued || 0).toFixed(3)} g
              </Text>
              <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>
                {money(e.summary?.total_paid ?? e.summary?.current_value ?? 0)}
              </Text>
            </View>
          ))
        )}
      </View>
    </AdminShell>
  );
}

const BackBtn = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    testID="customer-back"
    accessibilityRole="button"
    accessibilityLabel="Back to customers"
    onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 8 }}
  >
    <Feather name="arrow-left" size={16} color={A.accent} />
    <Text style={{ fontFamily: A.font, fontSize: 13, color: A.accent }}>Customers</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 20, marginBottom: 4 },
  section: { fontFamily: A.fontMed, fontSize: 14, color: A.text, marginTop: 18, marginBottom: 6 },
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, paddingHorizontal: 16 },
  rowItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
});
