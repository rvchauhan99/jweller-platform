import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { createOrder } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { getGuestId } from "@/src/utils/guest";
import { useCart } from "@/src/context/CartContext";

export default function CheckoutScreen() {
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, clear } = useCart();

  const [f, setF] = useState({ name: "", phone: "", email: "", line1: "", city: "", state: "", pincode: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const valid = useMemo(
    () => f.name.trim().length > 1 && f.phone.trim().length >= 10 && f.line1.trim() && f.city.trim() && f.pincode.trim().length >= 5,
    [f]
  );

  const submit = async () => {
    if (!valid || items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const gid = await getGuestId();
      await createOrder(code, {
        guest_id: gid,
        items: items.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
        contact: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined },
        address: { line1: f.line1.trim(), city: f.city.trim(), state: f.state.trim() || undefined, pincode: f.pincode.trim() },
        note: f.note.trim() || undefined,
      });
      clear();
      router.replace("/orders?justPlaced=1");
    } catch (e: any) {
      setError(e?.message ?? "Could not place reservation.");
      setBusy(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 6,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="checkout-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Reservation details
        </Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }} bottomOffset={90} showsVerticalScrollIndicator={false}>
        <Section title="Contact" />
        <Input placeholder="Full name" style={inputStyle} value={f.name} onChangeText={set("name")} testID="checkout-name" />
        <Input placeholder="Mobile number" keyboardType="phone-pad" style={inputStyle} value={f.phone} onChangeText={set("phone")} testID="checkout-phone" />
        <Input placeholder="Email (optional)" keyboardType="email-address" autoCapitalize="none" style={inputStyle} value={f.email} onChangeText={set("email")} testID="checkout-email" />

        <Section title="Pickup / delivery address" />
        <Input placeholder="Address line" style={inputStyle} value={f.line1} onChangeText={set("line1")} testID="checkout-line1" />
        <Input placeholder="City" style={inputStyle} value={f.city} onChangeText={set("city")} testID="checkout-city" />
        <Input placeholder="State (optional)" style={inputStyle} value={f.state} onChangeText={set("state")} testID="checkout-state" />
        <Input placeholder="Pincode" keyboardType="number-pad" style={inputStyle} value={f.pincode} onChangeText={set("pincode")} testID="checkout-pincode" />
        <Input placeholder="Note for the jeweler (optional)" style={inputStyle} value={f.note} onChangeText={set("note")} testID="checkout-note" />

        {error ? (
          <Text testID="checkout-error" style={{ fontFamily: theme.fonts.body, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: theme.spacing.md }}>{error}</Text>
        ) : null}
      </KeyboardAwareScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + theme.spacing.md, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable
          testID="place-reservation-button"
          disabled={busy || !valid}
          onPress={submit}
          style={[styles.cta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, opacity: busy || !valid ? 0.5 : 1 }]}
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
            {busy ? "Placing…" : `Reserve · ${formatMoney(subtotal)}`}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, textAlign: "center", marginTop: 8 }}>
          No online payment — the store will contact you to confirm.
        </Text>
      </View>
    </View>
  );
}

function Section({ title }: { title: string }) {
  const { theme } = useStore();
  return (
    <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary, marginTop: theme.spacing.lg, marginBottom: 4 }}>
      {title.toUpperCase()}
    </Text>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useStore();
  return <TextInput placeholderTextColor={theme.colors.muted} autoCorrect={false} {...props} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { height: 52, alignItems: "center", justifyContent: "center" },
});
