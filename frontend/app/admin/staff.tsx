import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A } from "@/src/admin/theme";
import { adminFetch, useAdmin } from "@/src/admin/AdminContext";
import { AdminShell, PrimaryButton } from "@/src/admin/AdminShell";

const EMPTY = { username: "", password: "", role: "staff" };
const ROLES = ["owner", "manager", "staff"];

export default function AdminStaff() {
  const { admin } = useAdmin();
  const self = admin?.username;
  const [rows, setRows] = useState<any[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch("/admin/staff"));
      setForbidden(false);
    } catch (e: any) {
      if (e?.status === 403) setForbidden(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => {
    setForm(EMPTY);
    setFormError(null);
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await adminFetch("/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          active: true,
        }),
      });
      setModal(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: any) => {
    if (row.username === self) return;
    try {
      await adminFetch(`/admin/staff/${encodeURIComponent(row.username)}`, {
        method: "PUT",
        body: JSON.stringify({ username: row.username, role: row.role, active: !row.active }),
      });
      await load();
    } catch {}
  };

  const remove = async (username: string) => {
    if (username === self) return;
    try {
      await adminFetch(`/admin/staff/${encodeURIComponent(username)}`, { method: "DELETE" });
      await load();
    } catch {}
  };

  if (forbidden) {
    return (
      <AdminShell title="Staff" subtitle="Account access">
        <View style={styles.panel}>
          <Text style={{ fontFamily: A.fontMed, fontSize: 14, color: A.text }} testID="staff-owner-only">Owner only</Text>
          <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted, marginTop: 6 }}>
            Staff management is restricted to the store owner.
          </Text>
        </View>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Staff"
      subtitle={`${rows.length} accounts`}
      action={<PrimaryButton testID="add-staff-btn" label="Add staff" icon="plus" onPress={openCreate} />}
    >
      {loading ? (
        <Text style={{ fontFamily: A.font, color: A.muted }}>Loading…</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { flex: 2 }]}>Username</Text>
            <Text style={[styles.th, { flex: 1 }]}>Role</Text>
            <Text style={[styles.th, { width: 70, textAlign: "center" }]}>Active</Text>
            <Text style={[styles.th, { width: 44, textAlign: "right" }]}> </Text>
          </View>
          {rows.length === 0 ? (
            <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>No staff accounts.</Text>
          ) : (
            rows.map((r) => {
              const isSelf = r.username === self;
              return (
                <View key={r.username} style={styles.tr} testID={`staff-row-${r.username}`}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{r.username}</Text>
                    {isSelf ? <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted }}>you</Text> : null}
                  </View>
                  <Text style={[styles.td, { flex: 1, textTransform: "capitalize" }]}>{r.role}</Text>
                  <View style={{ width: 70, alignItems: "center" }}>
                    <Switch
                      testID={`staff-active-${r.username}`}
                      value={!!r.active}
                      disabled={isSelf}
                      onValueChange={() => toggleActive(r)}
                      trackColor={{ true: A.accent }}
                    />
                  </View>
                  <View style={{ width: 44, alignItems: "flex-end" }}>
                    {!isSelf ? (
                      <Pressable testID={`staff-delete-${r.username}`} onPress={() => remove(r.username)} hitSlop={8} accessibilityLabel={`Delete ${r.username}`}>
                        <Feather name="trash-2" size={16} color={A.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 18, color: A.text, flex: 1 }}>New staff</Text>
              <Pressable testID="staff-modal-close" onPress={() => setModal(false)} hitSlop={8}>
                <Feather name="x" size={20} color={A.muted} />
              </Pressable>
            </View>
            <Field label="Username">
              <Inp testID="staff-username" autoCapitalize="none" value={form.username} onChangeText={(v: string) => setForm({ ...form, username: v })} />
            </Field>
            <Field label="Password">
              <Inp testID="staff-password" secureTextEntry autoCapitalize="none" value={form.password} onChangeText={(v: string) => setForm({ ...form, password: v })} />
            </Field>
            <Field label="Role">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {ROLES.map((role) => (
                  <Pressable
                    key={role}
                    testID={`staff-role-${role}`}
                    onPress={() => setForm({ ...form, role })}
                    style={[styles.chip, form.role === role && styles.chipActive]}
                  >
                    <Text style={{ fontFamily: A.font, fontSize: 12, color: form.role === role ? A.accent : A.text, textTransform: "capitalize" }}>{role}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            {formError ? <Text style={{ fontFamily: A.font, fontSize: 13, color: A.danger, marginTop: 8 }}>{formError}</Text> : null}
            <Pressable
              testID="staff-save"
              disabled={saving || !form.username.trim() || !form.password}
              onPress={save}
              style={[styles.saveBtn, { opacity: saving || !form.username.trim() || !form.password ? 0.5 : 1 }]}
            >
              <Text style={{ fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 }}>{saving ? "Saving…" : "Create staff"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const Field = ({ label, children }: any) => (
  <View style={{ marginTop: 12 }}>
    <Text style={{ fontFamily: A.fontMed, fontSize: 12, color: A.text, marginBottom: 4 }}>{label}</Text>
    {children}
  </View>
);
const Inp = (props: any) => (
  <TextInput placeholderTextColor={A.muted} {...props} style={{ borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, backgroundColor: A.surface, color: A.text, fontFamily: A.font, minHeight: 42, paddingHorizontal: 12, fontSize: 14 }} />
);

const styles = StyleSheet.create({
  panel: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 16 },
  table: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: A.border },
  thead: { borderTopWidth: 0, backgroundColor: A.surfaceAlt },
  th: { fontFamily: A.fontMed, fontSize: 11, color: A.muted, textTransform: "uppercase" },
  td: { fontFamily: A.font, fontSize: 13, color: A.text },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 440, backgroundColor: A.surface, borderRadius: A.radius, padding: 20 },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface, justifyContent: "center" },
  chipActive: { borderColor: A.accent, backgroundColor: A.accentSoft },
  saveBtn: { height: 46, borderRadius: A.radiusSm, backgroundColor: A.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
});
