import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { A, money } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminSip() {
  const [rows, setRows] = useState<any[]>([]);
  useFocusEffect(useCallback(() => { adminFetch("/admin/sip/enrollments").then(setRows).catch(() => {}); }, []));

  const dueCount = rows.filter((r) => r.is_due_now).length;
  const totalGrams = rows.reduce((s, r) => s + (r.summary?.grams_accrued || 0), 0);
  const liability = rows.reduce((s, r) => s + (r.summary?.current_value || 0), 0);

  return (
    <AdminShell title="Gold SIP" subtitle={`${rows.length} enrolments · ${dueCount} due now`}>
      <View style={styles.grid}>
        <Metric label="Active enrolments" value={String(rows.filter((r) => r.status === "active").length)} />
        <Metric label="Due now" value={String(dueCount)} tone={dueCount ? A.warning : A.text} />
        <Metric label="Gold owed" value={`${totalGrams.toFixed(2)} g`} />
        <Metric label="Liability" value={money(liability)} />
      </View>

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Member</Text>
          <Text style={[styles.th, { flex: 1 }]}>Plan</Text>
          <Text style={[styles.th, { width: 80, textAlign: "center" }]}>Paid</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Gold</Text>
          <Text style={[styles.th, { width: 80, textAlign: "center" }]}>Status</Text>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={styles.tr} testID={`sip-row-${r.id}`}>
            <View style={{ flex: 2 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{r.member_name}</Text>
              <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted }}>{r.member_phone} · {money(r.monthly_amount)}/mo</Text>
            </View>
            <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{r.plan_name}</Text>
            <Text style={[styles.td, { width: 80, textAlign: "center" }]}>{r.summary?.paid_installments}/{r.summary?.total_installments}</Text>
            <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{(r.summary?.grams_accrued || 0).toFixed(3)} g</Text>
            <View style={{ width: 80, alignItems: "center" }}>
              <Text style={{ fontFamily: A.font, fontSize: 11, color: r.status === "matured" ? A.success : r.is_due_now ? A.warning : A.muted }}>
                {r.status === "matured" ? "matured" : r.is_due_now ? "due" : "on track"}
              </Text>
            </View>
          </View>
        ))}
        {rows.length === 0 ? <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>No SIP enrolments yet.</Text> : null}
      </View>
    </AdminShell>
  );
}

const Metric = ({ label, value, tone }: any) => (
  <View style={styles.metric}>
    <View style={styles.metricInner}>
      <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted }}>{label}</Text>
      <Text style={{ fontFamily: A.fontMed, fontSize: 20, color: tone ?? A.text, marginTop: 4 }}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, marginBottom: 6 },
  metric: { padding: 6, width: "50%" },
  metricInner: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 14 },
  table: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, overflow: "hidden", marginTop: 8 },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: A.border },
  thead: { borderTopWidth: 0, backgroundColor: A.surfaceAlt },
  th: { fontFamily: A.fontMed, fontSize: 11, color: A.muted, textTransform: "uppercase" },
  td: { fontFamily: A.font, fontSize: 13, color: A.text },
});
