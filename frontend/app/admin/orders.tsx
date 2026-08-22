import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { A, money, STATUS_COLOR } from "@/src/admin/theme";
import { adminDownloadPdf, adminFetch } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

const FLOW = ["reserved", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { adminFetch("/admin/orders").then(setOrders).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (id: string, status: string, reason?: string) => {
    setBusy(id + status);
    try {
      const body: { status: string; reason?: string } = { status };
      if (reason) body.reason = reason;
      const updated = await adminFetch(`/admin/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e: any) {
      Alert.alert("Status", e?.message ?? "Could not update status");
    } finally {
      setBusy(null);
    }
  };

  const handleReturn = (o: any) => {
    Alert.alert(
      "Return order",
      `Mark ${o.order_no} as returned? Stock will be restocked. Settle any refund offline.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Return",
          style: "destructive",
          onPress: () => {
            if (Platform.OS === "web" && typeof window !== "undefined") {
              const reason = window.prompt("Return reason (optional)", "") ?? undefined;
              setStatus(o.id, "returned", reason?.trim() || undefined);
              return;
            }
            setStatus(o.id, "returned");
          },
        },
      ]
    );
  };

  const handleInvoice = async (o: any) => {
    setBusy(o.id + "invoice");
    try {
      const { filename, base64 } = await adminDownloadPdf(`/admin/orders/${o.id}/invoice`);
      const safeName = (filename || `${o.order_no || o.id}.pdf`).replace(/[^\w.\-]+/g, "_");
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = `data:application/pdf;base64,${base64}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = safeName;
        a.click();
        return;
      }
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!dir) throw new Error("Storage unavailable on this device");
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
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell title="Orders" subtitle={`${orders.length} reservations`}>
      {orders.length === 0 ? (
        <View style={styles.panel}><Text style={{ fontFamily: A.font, color: A.muted }}>No online reservations yet.</Text></View>
      ) : (
        orders.map((o) => {
          const canReturn = o.status === "shipped" || o.status === "delivered";
          const isPaid = o.payment_status === "paid";
          return (
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

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: STATUS_COLOR[o.status] ?? A.muted,
                  }}
                >
                  <Text style={{ fontFamily: A.font, fontSize: 12, color: A.onPrimary, textTransform: "capitalize" }}>
                    {o.status}
                  </Text>
                </View>
                {isPaid ? (
                  <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted }}>paid</Text>
                ) : (
                  <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted }}>Invoice after payment</Text>
                )}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {isPaid ? (
                  <Pressable
                    testID={`order-invoice-${o.id}`}
                    onPress={() => handleInvoice(o)}
                    disabled={busy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Download invoice"
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>{busy === o.id + "invoice" ? "…" : "Invoice"}</Text>
                  </Pressable>
                ) : null}
                {canReturn ? (
                  <Pressable
                    testID={`order-return-${o.id}`}
                    onPress={() => handleReturn(o)}
                    disabled={busy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Return order"
                    style={[styles.actionBtn, { borderColor: A.danger }]}
                  >
                    <Text style={[styles.actionBtnText, { color: A.danger }]}>
                      {busy === o.id + "returned" ? "…" : "Return"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {o.status !== "returned" && o.status !== "cancelled" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
                  {FLOW.map((s) => {
                    const active = o.status === s;
                    return (
                      <Pressable
                        key={s}
                        testID={`order-status-${o.id}-${s}`}
                        onPress={() => setStatus(o.id, s)}
                        disabled={busy !== null}
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
              ) : null}
            </View>
          );
        })
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16 },
  card: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16, marginBottom: 12 },
  actionBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: A.radiusSm,
    borderWidth: 1,
    borderColor: A.border,
    justifyContent: "center",
    backgroundColor: A.surface,
  },
  actionBtnText: { fontFamily: A.fontMed, fontSize: 12, color: A.text },
});
