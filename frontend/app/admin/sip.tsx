import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A, money } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell, PrimaryButton } from "@/src/admin/AdminShell";

const EMPTY_PLAN = {
  name: "",
  monthly_amount: "5000",
  tenure_months: "11",
  metal: "gold",
  min_amount: "0",
  bonus_months: "1",
};

export default function AdminSip() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [dueFilter, setDueFilter] = useState<"all" | "due">("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = dueFilter === "due" ? "?due=due" : "";
      const [e, p] = await Promise.all([
        adminFetch(`/admin/sip/enrollments${q}`),
        adminFetch("/admin/sip/plans"),
      ]);
      setRows(e);
      setPlans(p);
    } catch {}
  }, [dueFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dueCount = rows.filter((r) => r.is_due_now).length;
  const totalGrams = rows.reduce((s, r) => s + (r.summary?.grams_accrued || 0), 0);
  const liability = rows.reduce((s, r) => s + (r.summary?.current_value || 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_PLAN);
    setFormError(null);
    setModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p.id);
    setForm({
      name: p.name || "",
      monthly_amount: String(p.monthly_amount ?? ""),
      tenure_months: String(p.tenure_months ?? ""),
      metal: p.metal || "gold",
      min_amount: String(p.min_amount ?? 0),
      bonus_months: String(p.bonus_months ?? 0),
    });
    setFormError(null);
    setModal(true);
  };

  const savePlan = async () => {
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      monthly_amount: parseFloat(form.monthly_amount) || 0,
      tenure_months: parseInt(form.tenure_months, 10) || 0,
      metal: form.metal || "gold",
      min_amount: parseFloat(form.min_amount) || 0,
      bonus_months: parseInt(form.bonus_months, 10) || 0,
      active: true,
      rate_mode: "live",
    };
    try {
      if (editing) await adminFetch(`/admin/sip/plans/${editing}`, { method: "PUT", body: JSON.stringify(body) });
      else await adminFetch("/admin/sip/plans", { method: "POST", body: JSON.stringify(body) });
      setModal(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (id: string) => {
    try {
      await adminFetch(`/admin/sip/plans/${id}`, { method: "DELETE" });
      await load();
    } catch {}
  };

  return (
    <AdminShell
      title="Gold SIP"
      subtitle={`${rows.length} enrolments · ${dueCount} due now`}
      action={<PrimaryButton testID="add-sip-plan-btn" label="Add plan" icon="plus" onPress={openNew} />}
    >
      <View style={styles.grid}>
        <Metric label="Active enrolments" value={String(rows.filter((r) => r.status === "active").length)} />
        <Metric label="Due now" value={String(dueCount)} tone={dueCount ? A.warning : A.text} />
        <Metric label="Gold owed" value={`${totalGrams.toFixed(2)} g`} />
        <Metric label="Liability" value={money(liability)} />
      </View>

      <Text style={styles.section}>SIP plans</Text>
      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Plan</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Monthly</Text>
          <Text style={[styles.th, { width: 70, textAlign: "center" }]}>Tenure</Text>
          <Text style={[styles.th, { width: 60, textAlign: "center" }]}>Metal</Text>
          <Text style={[styles.th, { width: 74, textAlign: "right" }]}>Actions</Text>
        </View>
        {plans.map((p) => (
          <View key={p.id} style={styles.tr} testID={`sip-plan-${p.id}`}>
            <View style={{ flex: 2 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{p.name}</Text>
              <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted }}>
                min {money(p.min_amount || 0)} · bonus {p.bonus_months || 0} mo
              </Text>
            </View>
            <Text style={[styles.td, { width: 90, textAlign: "right" }]}>{money(p.monthly_amount)}</Text>
            <Text style={[styles.td, { width: 70, textAlign: "center" }]}>{p.tenure_months} mo</Text>
            <Text style={[styles.td, { width: 60, textAlign: "center", textTransform: "capitalize" }]}>{p.metal || "gold"}</Text>
            <View style={{ width: 74, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable testID={`sip-plan-edit-${p.id}`} onPress={() => openEdit(p)} hitSlop={6} accessibilityLabel={`Edit ${p.name}`}>
                <Feather name="edit-2" size={16} color={A.accent} />
              </Pressable>
              <Pressable testID={`sip-plan-delete-${p.id}`} onPress={() => removePlan(p.id)} hitSlop={6} accessibilityLabel={`Delete ${p.name}`}>
                <Feather name="trash-2" size={16} color={A.danger} />
              </Pressable>
            </View>
          </View>
        ))}
        {plans.length === 0 ? <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>No SIP plans yet.</Text> : null}
      </View>

      <Text style={styles.section}>Enrolments</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        {(["all", "due"] as const).map((f) => (
          <Pressable
            key={f}
            testID={`sip-due-filter-${f}`}
            onPress={() => setDueFilter(f)}
            style={{
              paddingHorizontal: 12,
              height: 32,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: dueFilter === f ? A.accent : A.border,
              backgroundColor: dueFilter === f ? A.accent : "transparent",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${f}`}
          >
            <Text style={{ fontFamily: A.font, fontSize: 12, color: dueFilter === f ? "#fff" : A.muted }}>
              {f === "all" ? "All" : "Due now"}
            </Text>
          </Pressable>
        ))}
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
              <Pressable
                onPress={() => {
                  if (r.customer_id) router.push(`/admin/customer/${r.customer_id}`);
                }}
                disabled={!r.customer_id}
                accessibilityRole="button"
                accessibilityLabel="Open customer"
              >
                <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }}>{r.member_name}</Text>
              </Pressable>
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

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 18, color: A.text, flex: 1 }}>{editing ? "Edit SIP plan" : "New SIP plan"}</Text>
              <Pressable testID="sip-plan-modal-close" onPress={() => setModal(false)} hitSlop={8}>
                <Feather name="x" size={20} color={A.muted} />
              </Pressable>
            </View>
            <Field label="Name">
              <Inp testID="sip-plan-name" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} />
            </Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field label="Monthly amount" style={{ flex: 1 }}>
                <Inp testID="sip-plan-monthly" keyboardType="decimal-pad" value={form.monthly_amount} onChangeText={(v: string) => setForm({ ...form, monthly_amount: v })} />
              </Field>
              <Field label="Tenure (months)" style={{ flex: 1 }}>
                <Inp testID="sip-plan-tenure" keyboardType="number-pad" value={form.tenure_months} onChangeText={(v: string) => setForm({ ...form, tenure_months: v })} />
              </Field>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field label="Metal" style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["gold", "silver"].map((m) => (
                    <Pressable
                      key={m}
                      testID={`sip-plan-metal-${m}`}
                      onPress={() => setForm({ ...form, metal: m })}
                      style={[styles.chip, form.metal === m && styles.chipActive]}
                    >
                      <Text style={{ fontFamily: A.font, fontSize: 12, color: form.metal === m ? A.accent : A.text, textTransform: "capitalize" }}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="Min amount" style={{ flex: 1 }}>
                <Inp testID="sip-plan-min" keyboardType="decimal-pad" value={form.min_amount} onChangeText={(v: string) => setForm({ ...form, min_amount: v })} />
              </Field>
            </View>
            <Field label="Bonus months">
              <Inp testID="sip-plan-bonus" keyboardType="number-pad" value={form.bonus_months} onChangeText={(v: string) => setForm({ ...form, bonus_months: v })} />
            </Field>
            {formError ? <Text style={{ fontFamily: A.font, fontSize: 13, color: A.danger, marginTop: 8 }}>{formError}</Text> : null}
            <Pressable
              testID="sip-plan-save"
              disabled={saving || !form.name.trim()}
              onPress={savePlan}
              style={[styles.saveBtn, { opacity: saving || !form.name.trim() ? 0.5 : 1 }]}
            >
              <Text style={{ fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 }}>{saving ? "Saving…" : "Save plan"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

const Field = ({ label, children, style }: any) => (
  <View style={[{ marginTop: 12 }, style]}>
    <Text style={{ fontFamily: A.fontMed, fontSize: 12, color: A.text, marginBottom: 4 }}>{label}</Text>
    {children}
  </View>
);
const Inp = (props: any) => (
  <TextInput placeholderTextColor={A.muted} {...props} style={{ borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, backgroundColor: A.surface, color: A.text, fontFamily: A.font, minHeight: 42, paddingHorizontal: 12, fontSize: 14 }} />
);

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, marginBottom: 6 },
  metric: { padding: 6, width: "50%" },
  metricInner: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, padding: 14 },
  section: { fontFamily: A.fontMed, fontSize: 14, color: A.text, marginTop: 18, marginBottom: 8 },
  table: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: A.border },
  thead: { borderTopWidth: 0, backgroundColor: A.surfaceAlt },
  th: { fontFamily: A.fontMed, fontSize: 11, color: A.muted, textTransform: "uppercase" },
  td: { fontFamily: A.font, fontSize: 13, color: A.text },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 520, backgroundColor: A.surface, borderRadius: A.radius, padding: 20 },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface, justifyContent: "center" },
  chipActive: { borderColor: A.accent, backgroundColor: A.accentSoft },
  saveBtn: { height: 46, borderRadius: A.radiusSm, backgroundColor: A.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
});
