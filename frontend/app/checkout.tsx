import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { createOrder, orderPay, orderPayConfirm, orderPayDevConfirm } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { useCart } from "@/src/context/CartContext";
import { useCustomerAuth } from "@/src/context/CustomerAuthContext";
import { RazorpayCheckoutModal, RazorpayCheckoutOptions } from "@/src/payments/RazorpayCheckoutModal";

export default function CheckoutScreen() {
  const { code, theme, businessName } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, clear } = useCart();
  const { token, customer, ready } = useCustomerAuth();

  const [f, setF] = useState({ name: "", phone: "", email: "", line1: "", city: "", state: "", pincode: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [checkoutOpts, setCheckoutOpts] = useState<RazorpayCheckoutOptions | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login?next=/checkout");
      return;
    }
    if (customer) {
      setF((prev) => ({
        ...prev,
        name: prev.name || customer.name || "",
        phone: prev.phone || customer.phone || "",
        email: prev.email || customer.email || "",
      }));
    }
  }, [ready, token, customer, router]);

  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const valid = useMemo(
    () => f.name.trim().length > 1 && f.phone.trim().length >= 10 && f.line1.trim() && f.city.trim() && f.pincode.trim().length >= 5,
    [f]
  );

  const finishPaid = () => {
    clear();
    setCheckoutOpts(null);
    setPendingOrderId(null);
    setBusy(false);
    router.replace("/orders?justPlaced=1");
  };

  const submit = async () => {
    if (!valid || items.length === 0 || !token) return;
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder(code, {
        items: items.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
        contact: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined },
        address: { line1: f.line1.trim(), city: f.city.trim(), state: f.state.trim() || undefined, pincode: f.pincode.trim() },
        note: f.note.trim() || undefined,
      });
      const pay = await orderPay(code, order.id);
      if (pay.mock) {
        await orderPayDevConfirm(code, order.id);
        finishPaid();
        return;
      }
      setPendingOrderId(order.id);
      setCheckoutOpts({
        keyId: pay.key_id,
        orderId: pay.razorpay_order_id,
        amountPaise: pay.amount,
        currency: pay.currency || "INR",
        name: businessName || "Store",
        description: `Order ${order.order_no}`,
        prefill: { name: f.name.trim(), email: f.email.trim() || undefined, contact: f.phone.trim() },
      });
    } catch (e: any) {
      setError(e?.message ?? "Could not complete payment.");
      setBusy(false);
    }
  };

  const handleCheckoutSuccess = async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!pendingOrderId) return;
    try {
      await orderPayConfirm(code, pendingOrderId, payload);
      finishPaid();
    } catch (e: any) {
      setError(e?.message ?? "Payment verification failed.");
      setCheckoutOpts(null);
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

  if (!ready || !token) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="checkout-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Checkout & pay
        </Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }} bottomOffset={90} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 13, marginBottom: 12 }}>
          Total {formatMoney(subtotal)} · Razorpay Test Mode
        </Text>
        <Section title="Contact" />
        <Input placeholder="Full name" style={inputStyle} value={f.name} onChangeText={set("name")} testID="checkout-name" />
        <Input placeholder="Mobile number" keyboardType="phone-pad" style={inputStyle} value={f.phone} onChangeText={set("phone")} testID="checkout-phone" />
        <Input placeholder="Email (optional)" keyboardType="email-address" autoCapitalize="none" style={inputStyle} value={f.email} onChangeText={set("email")} testID="checkout-email" />

        <Section title="Address" />
        <Input placeholder="Address line" style={inputStyle} value={f.line1} onChangeText={set("line1")} testID="checkout-line1" />
        <Input placeholder="City" style={inputStyle} value={f.city} onChangeText={set("city")} testID="checkout-city" />
        <Input placeholder="State" style={inputStyle} value={f.state} onChangeText={set("state")} testID="checkout-state" />
        <Input placeholder="PIN code" keyboardType="number-pad" style={inputStyle} value={f.pincode} onChangeText={set("pincode")} testID="checkout-pincode" />
        <Input placeholder="Note (optional)" style={inputStyle} value={f.note} onChangeText={set("note")} testID="checkout-note" />

        {error ? (
          <View
            testID="checkout-error-banner"
            style={{
              marginTop: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "#FECACA",
              backgroundColor: "#FEF2F2",
              borderRadius: theme.radius.md,
            }}
            accessibilityLabel="Payment error"
          >
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: "#991B1B", fontSize: 14 }}>
              {error.includes("cancel") || error.toLowerCase().includes("cancelled")
                ? "Payment cancelled"
                : error.toLowerCase().includes("fail")
                  ? "Payment failed"
                  : "Payment issue"}
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, color: "#B91C1C", fontSize: 13, marginTop: 4 }}>{error}</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
              Your bag is unchanged. You can try again when ready.
            </Text>
          </View>
        ) : null}

        <Pressable
          testID="checkout-submit"
          disabled={!valid || busy}
          onPress={submit}
          style={[styles.btn, { backgroundColor: theme.colors.primary, opacity: !valid || busy ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Pay now"
        >
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.onPrimary || "#fff", fontSize: 16 }}>
            {busy ? "Processing…" : `Pay ${formatMoney(subtotal)}`}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <RazorpayCheckoutModal
        visible={!!checkoutOpts}
        options={checkoutOpts}
        onSuccess={handleCheckoutSuccess}
        onDismiss={(reason) => {
          setCheckoutOpts(null);
          setBusy(false);
          if (reason) setError(reason);
        }}
      />
    </View>
  );
}

const Section = ({ title }: { title: string }) => {
  const { theme } = useStore();
  return (
    <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text, marginTop: 18, marginBottom: 4 }}>{title}</Text>
  );
};

const Input = (props: any) => <TextInput placeholderTextColor="#94A3B8" {...props} />;

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 24 },
});
