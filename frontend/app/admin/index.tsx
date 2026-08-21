import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A, money, STATUS_COLOR } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      adminFetch("/admin/dashboard").then(setData).catch(() => {});
    }, [])
  );

  const cols = width >= 900 ? 4 : 2;
  const Metric = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <View style={[styles.metric, { width: `${100 / cols}%` }]}>
      <View style={styles.metricInner}>
        <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted }}>{label}</Text>
        <Text style={{ fontFamily: A.fontMed, fontSize: 22, color: tone ?? A.text, marginTop: 4 }}>{value}</Text>
      </View>
    </View>
  );

  return (
    <AdminShell title="Dashboard" subtitle="Your work queue for today">
      {!data ? (
        <Text style={{ fontFamily: A.font, color: A.muted }}>Loading…</Text>
      ) : (
        <>
          {/* Pending work (queue first, not vanity KPIs) */}
          <View style={styles.grid}>
            <Metric label="Pending orders" value={String(data.pending_orders)} tone={data.pending_orders ? A.warning : A.text} />
            <Metric label="SIP due today" value={String(data.sip_due)} tone={data.sip_due ? A.warning : A.text} />
            <Metric label="Low stock" value={String(data.low_stock_count)} tone={data.low_stock_count ? A.danger : A.text} />
            <Metric label="Active SIP plans" value={String(data.sip_active)} />
          </View>

          {/* Rate health */}
          <View style={styles.panel}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="trending-up" size={16} color={A.accent} />
              <Text style={{ fontFamily: A.fontMed, fontSize: 14, color: A.text, marginLeft: 8, flex: 1 }}>Rate health</Text>
              {data.today_rate ? (
                <Text style={{ fontFamily: A.fontMed, fontSize: 14, color: A.text }}>
                  {money(data.today_rate.inr_per_gram)}/g gold
                </Text>
              ) : (
                <Text style={{ fontFamily: A.font, fontSize: 13, color: A.danger }}>feed unavailable</Text>
              )}
            </View>
            <Text style={{ fontFamily: A.font, fontSize: 12, color: data.rate_stale ? A.warning : A.muted, marginTop: 6 }}>
              {data.rate_stale ? "⚠ Rate feed is stale (older than 15 min)" : `Live · your margin ${data.today_rate?.margin_pct ?? 0}%`}
            </Text>
          </View>

          {/* Recent activity */}
          <Text style={styles.section}>Recent reservations</Text>
          <View style={styles.panel}>
            {data.recent_orders.length === 0 ? (
              <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 13 }}>No reservations yet.</Text>
            ) : (
              data.recent_orders.map((o: any, idx: number) => (
                <View key={o.id} style={[styles.rowItem, idx > 0 && { borderTopWidth: 1, borderTopColor: A.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{o.order_no}</Text>
                    <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginTop: 1 }}>{o.contact?.name} · {o.items?.length} item(s)</Text>
                  </View>
                  <Text style={{ fontFamily: A.font, fontSize: 12, color: STATUS_COLOR[o.status] ?? A.muted, textTransform: "capitalize", marginRight: 12 }}>{o.status}</Text>
                  <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{money(o.subtotal)}</Text>
                </View>
              ))
            )}
          </View>

          {data.low_stock_count > 0 ? (
            <>
              <Text style={styles.section}>Low stock</Text>
              <View style={styles.panel}>
                {data.low_stock.map((p: any, idx: number) => (
                  <View key={p.id} style={[styles.rowItem, idx > 0 && { borderTopWidth: 1, borderTopColor: A.border }]}>
                    <Text style={{ fontFamily: A.font, fontSize: 13, color: A.text, flex: 1 }}>{p.name}</Text>
                    <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.danger }}>{p.stock_qty} left</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  metric: { padding: 6 },
  metricInner: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16 },
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16, marginTop: 12 },
  section: { fontFamily: A.fontMed, fontSize: 14, color: A.text, marginTop: 22, marginBottom: 2 },
  rowItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
});
