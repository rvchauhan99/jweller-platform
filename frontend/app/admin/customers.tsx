import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell, PrimaryButton } from "@/src/admin/AdminShell";

export default function AdminCustomers() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const needle = (query ?? "").trim();
      const path = needle ? `/admin/customers?q=${encodeURIComponent(needle)}` : "/admin/customers";
      setRows(await adminFetch(path));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSearch = () => load(q);

  return (
    <AdminShell title="Customers" subtitle="Search within this tenant only">
      <View style={styles.searchRow}>
        <TextInput
          testID="customers-search"
          accessibilityLabel="Search customers"
          placeholder="Name, phone, or email"
          placeholderTextColor={A.muted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          style={styles.searchInput}
        />
        <PrimaryButton testID="customers-search-btn" label="Search" icon="search" onPress={handleSearch} />
      </View>

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Name</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>Phone</Text>
          <Text style={[styles.th, { width: 64, textAlign: "center" }]}>Orders</Text>
          <Text style={[styles.th, { width: 48, textAlign: "center" }]}>SIP</Text>
          <View style={{ width: 24 }} />
        </View>
        {loading ? (
          <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>Loading…</Text>
        ) : rows.length === 0 ? (
          <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>No customers found.</Text>
        ) : (
          rows.map((c) => (
            <Pressable
              key={c.id}
              testID={`customer-row-${c.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${c.name}`}
              onPress={() => router.push(`/admin/customer/${encodeURIComponent(c.id)}` as any)}
              style={styles.tr}
            >
              <View style={{ flex: 2 }}>
                <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }} numberOfLines={1}>{c.name}</Text>
                {c.email ? <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted }} numberOfLines={1}>{c.email}</Text> : null}
              </View>
              <Text style={[styles.td, { flex: 1.4 }]}>{c.phone}</Text>
              <Text style={[styles.td, { width: 64, textAlign: "center" }]}>{c.order_count ?? 0}</Text>
              <Text style={[styles.td, { width: 48, textAlign: "center" }]}>{c.sip_count ?? 0}</Text>
              <Feather name="chevron-right" size={16} color={A.muted} />
            </Pressable>
          ))
        )}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "center" },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, backgroundColor: A.surface,
    color: A.text, fontFamily: A.font, minHeight: 42, paddingHorizontal: 12, fontSize: 14,
  },
  table: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: A.border },
  thead: { borderTopWidth: 0, backgroundColor: A.surfaceAlt },
  th: { fontFamily: A.fontMed, fontSize: 11, color: A.muted, textTransform: "uppercase" },
  td: { fontFamily: A.font, fontSize: 13, color: A.text },
});
