import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { A, money } from "@/src/admin/theme";
import { adminFetch } from "@/src/admin/AdminContext";
import { AdminShell, PrimaryButton } from "@/src/admin/AdminShell";

const PURITIES = ["24K", "22K", "18K", "14K"];
const EMPTY = {
  name: "", category_id: "", purity: "22K", weight_grams: "", making_charge: "", making_charge_type: "flat",
  stock_qty: "", images: "", description: "", listed_online: true, featured: false, price: "0",
};

export default function AdminInventory() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([adminFetch("/admin/products"), adminFetch("/admin/categories")]);
    setProducts(p);
    setCategories(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, category_id: categories[0]?.id ?? "" });
    setModal(true);
  };
  const openEdit = (p: any) => {
    setEditing(p.id);
    setForm({
      name: p.name, category_id: p.category_id, purity: p.purity, weight_grams: String(p.weight_grams ?? ""),
      making_charge: String(p.making_charge ?? ""), making_charge_type: p.making_charge_type ?? "flat",
      stock_qty: String(p.stock_qty ?? ""), images: (p.images?.[0] ?? ""), description: p.description ?? "",
      listed_online: !!p.listed_online, featured: !!p.featured, price: String(p.price ?? 0),
    });
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    const body = {
      name: form.name, category_id: form.category_id, purity: form.purity,
      weight_grams: parseFloat(form.weight_grams) || 0, making_charge: parseFloat(form.making_charge) || 0,
      making_charge_type: form.making_charge_type, stock_qty: parseInt(form.stock_qty) || 0,
      images: form.images ? [form.images] : [], description: form.description,
      listed_online: form.listed_online, featured: form.featured, price: parseFloat(form.price) || 0, metal: "gold",
    };
    try {
      if (editing) await adminFetch(`/admin/products/${editing}`, { method: "PUT", body: JSON.stringify(body) });
      else await adminFetch("/admin/products", { method: "POST", body: JSON.stringify(body) });
      setModal(false);
      await load();
    } catch {}
    setSaving(false);
  };

  const remove = async (id: string) => {
    await adminFetch(`/admin/products/${id}`, { method: "DELETE" });
    await load();
  };

  const toggleListed = async (p: any) => {
    await adminFetch(`/admin/products/${p.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...productBody(p), listed_online: !p.listed_online }),
    });
    await load();
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <AdminShell title="Inventory" subtitle={`${products.length} products`} action={<PrimaryButton testID="add-product-btn" label="Add product" icon="plus" onPress={openNew} />}>
      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Product</Text>
          {wide ? <Text style={[styles.th, { flex: 1 }]}>Category</Text> : null}
          {wide ? <Text style={[styles.th, { width: 70 }]}>Purity</Text> : null}
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Live price</Text>
          <Text style={[styles.th, { width: 60, textAlign: "center" }]}>Stock</Text>
          <Text style={[styles.th, { width: 70, textAlign: "center" }]}>Online</Text>
          <Text style={[styles.th, { width: 74, textAlign: "right" }]}>Actions</Text>
        </View>
        {products.map((p) => (
          <View key={p.id} style={styles.tr} testID={`inv-row-${p.id}`}>
            <View style={{ flex: 2 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.text }} numberOfLines={1}>{p.name}</Text>
              <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted }}>{p.sku} · {p.weight_grams}g</Text>
            </View>
            {wide ? <Text style={[styles.td, { flex: 1 }]}>{catName(p.category_id)}</Text> : null}
            {wide ? <Text style={[styles.td, { width: 70 }]}>{p.purity}</Text> : null}
            <Text style={[styles.td, { width: 90, textAlign: "right", fontFamily: A.fontMed }]}>{money(p.live_price ?? p.price)}</Text>
            <Text style={[styles.td, { width: 60, textAlign: "center", color: p.stock_qty <= 2 ? A.danger : A.text }]}>{p.stock_qty}</Text>
            <View style={{ width: 70, alignItems: "center" }}>
              <Switch testID={`inv-listed-${p.id}`} value={!!p.listed_online} onValueChange={() => toggleListed(p)} trackColor={{ true: A.accent }} />
            </View>
            <View style={{ width: 74, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable testID={`inv-edit-${p.id}`} onPress={() => openEdit(p)} hitSlop={6}><Feather name="edit-2" size={16} color={A.accent} /></Pressable>
              <Pressable testID={`inv-delete-${p.id}`} onPress={() => remove(p.id)} hitSlop={6}><Feather name="trash-2" size={16} color={A.danger} /></Pressable>
            </View>
          </View>
        ))}
        {products.length === 0 ? <Text style={{ fontFamily: A.font, color: A.muted, padding: 16 }}>No products yet. Tap “Add product”.</Text> : null}
      </View>

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontFamily: A.fontMed, fontSize: 18, color: A.text, flex: 1 }}>{editing ? "Edit product" : "New product"}</Text>
              <Pressable testID="modal-close" onPress={() => setModal(false)} hitSlop={8}><Feather name="x" size={20} color={A.muted} /></Pressable>
            </View>
            <FieldRow label="Name"><TInput testID="pf-name" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} /></FieldRow>
            <FieldRow label="Category">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} active={form.category_id === c.id} onPress={() => setForm({ ...form, category_id: c.id })} testID={`pf-cat-${c.id}`} />
                ))}
              </View>
            </FieldRow>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <FieldRow label="Purity" style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {PURITIES.map((p) => <Chip key={p} label={p} active={form.purity === p} onPress={() => setForm({ ...form, purity: p })} testID={`pf-purity-${p}`} />)}
                </View>
              </FieldRow>
              <FieldRow label="Weight (g)" style={{ width: 110 }}><TInput testID="pf-weight" keyboardType="decimal-pad" value={form.weight_grams} onChangeText={(v: string) => setForm({ ...form, weight_grams: v })} /></FieldRow>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <FieldRow label="Making charge" style={{ flex: 1 }}><TInput testID="pf-making" keyboardType="decimal-pad" value={form.making_charge} onChangeText={(v: string) => setForm({ ...form, making_charge: v })} /></FieldRow>
              <FieldRow label="Type" style={{ width: 140 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Chip label="Flat ₹" active={form.making_charge_type === "flat"} onPress={() => setForm({ ...form, making_charge_type: "flat" })} testID="pf-mc-flat" />
                  <Chip label="%" active={form.making_charge_type === "percent"} onPress={() => setForm({ ...form, making_charge_type: "percent" })} testID="pf-mc-pct" />
                </View>
              </FieldRow>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <FieldRow label="Stock qty" style={{ width: 110 }}><TInput testID="pf-stock" keyboardType="number-pad" value={form.stock_qty} onChangeText={(v: string) => setForm({ ...form, stock_qty: v })} /></FieldRow>
              <FieldRow label="Image URL" style={{ flex: 1 }}><TInput testID="pf-image" autoCapitalize="none" value={form.images} onChangeText={(v: string) => setForm({ ...form, images: v })} /></FieldRow>
            </View>
            <FieldRow label="Description"><TInput testID="pf-desc" multiline value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} /></FieldRow>
            <View style={{ flexDirection: "row", gap: 24, marginTop: 8 }}>
              <ToggleRow label="Listed online" value={form.listed_online} onValueChange={(v) => setForm({ ...form, listed_online: v })} />
              <ToggleRow label="Featured" value={form.featured} onValueChange={(v) => setForm({ ...form, featured: v })} />
            </View>
            <Pressable testID="pf-save" disabled={saving || !form.name || !form.category_id} onPress={save} style={[styles.saveBtn, { opacity: saving || !form.name || !form.category_id ? 0.5 : 1 }]}>
              <Text style={{ fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 }}>{saving ? "Saving…" : "Save product"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

function productBody(p: any) {
  return {
    name: p.name, category_id: p.category_id, purity: p.purity, weight_grams: p.weight_grams,
    making_charge: p.making_charge, making_charge_type: p.making_charge_type, stock_qty: p.stock_qty,
    images: p.images ?? [], description: p.description ?? "", listed_online: p.listed_online,
    featured: p.featured, price: p.price ?? 0, metal: p.metal ?? "gold", sku: p.sku,
  };
}

const FieldRow = ({ label, children, style }: any) => (
  <View style={[{ marginTop: 12 }, style]}>
    <Text style={{ fontFamily: A.fontMed, fontSize: 12, color: A.text, marginBottom: 4 }}>{label}</Text>
    {children}
  </View>
);
const TInput = (props: any) => (
  <TextInput placeholderTextColor={A.muted} {...props} style={[{ borderWidth: 1, borderColor: A.border, borderRadius: A.radiusSm, backgroundColor: A.surface, color: A.text, fontFamily: A.font, minHeight: 42, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 }, props.multiline && { minHeight: 64 }]} />
);
const Chip = ({ label, active, onPress, testID }: any) => (
  <Pressable testID={testID} onPress={onPress} style={{ paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, borderColor: active ? A.accent : A.border, backgroundColor: active ? A.accentSoft : A.surface, justifyContent: "center" }}>
    <Text style={{ fontFamily: A.font, fontSize: 12, color: active ? A.accent : A.text }}>{label}</Text>
  </Pressable>
);
const ToggleRow = ({ label, value, onValueChange }: any) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: A.accent }} />
    <Text style={{ fontFamily: A.font, fontSize: 13, color: A.text }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  table: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: A.radius, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: A.border },
  thead: { borderTopWidth: 0, backgroundColor: A.surfaceAlt },
  th: { fontFamily: A.fontMed, fontSize: 11, color: A.muted, textTransform: "uppercase" },
  td: { fontFamily: A.font, fontSize: 13, color: A.text },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 560, maxHeight: "90%", backgroundColor: A.surface, borderRadius: A.radius, padding: 20 },
  saveBtn: { height: 46, borderRadius: A.radiusSm, backgroundColor: A.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
});
