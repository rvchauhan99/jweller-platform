import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { getSipPlans, sipEnroll, SipPlan } from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { getGuestId } from "@/src/utils/guest";
import { LoadingView } from "@/src/components/StateViews";

export default function SipEnrollScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<SipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const plans = await getSipPlans(code);
        const p = plans.find((x) => x.id === planId) ?? null;
        setPlan(p);
        if (p) setAmount(String(p.monthly_amount));
      } finally {
        setLoading(false);
      }
    })();
  }, [code, planId]);

  const amountNum = useMemo(() => parseInt(amount || "0", 10), [amount]);
  const valid = name.trim().length > 1 && phone.trim().length >= 10 && plan && amountNum >= plan.min_amount;

  const submit = async () => {
    if (!plan || !valid) {
      if (plan && amountNum < plan.min_amount) setError(`Minimum ${formatMoney(plan.min_amount)} per month.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const gid = await getGuestId();
      await sipEnroll(code, { guest_id: gid, plan_id: plan.id, monthly_amount: amountNum, name: name.trim(), phone: phone.trim() });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Could not enrol. Please try again.");
      setBusy(false);
    }
  };

  if (loading) return <LoadingView />;
  if (!plan) return null;

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    marginTop: theme.spacing.sm,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="sip-enroll-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="enroll-back" onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Enrol · {plan.name}
        </Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing.lg }} bottomOffset={24} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base, lineHeight: 22 }}>
          {plan.benefit_text}
        </Text>

        <Field label="Your name">
          <TextInput testID="enroll-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.colors.muted} style={inputStyle} />
        </Field>
        <Field label="Mobile number">
          <TextInput testID="enroll-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" placeholderTextColor={theme.colors.muted} style={inputStyle} />
        </Field>
        <Field label={`Monthly amount (min ${formatMoney(plan.min_amount)})`}>
          <TextInput testID="enroll-amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Amount" placeholderTextColor={theme.colors.muted} style={inputStyle} />
        </Field>

        {error ? (
          <Text testID="enroll-error" style={{ fontFamily: theme.fonts.body, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: theme.spacing.md }}>
            {error}
          </Text>
        ) : null}

        <View style={[styles.summary, { borderColor: theme.colors.border, borderRadius: theme.radius.lg, marginTop: theme.spacing.xl }]}>
          <Row label="Plan tenure" value={`${plan.tenure_months} months`} />
          {plan.bonus_months ? <Row label="Bonus installments" value={`+${plan.bonus_months}`} /> : null}
          <Row label="Monthly" value={formatMoney(amountNum || plan.monthly_amount)} last />
        </View>

        <Pressable
          testID="enroll-submit"
          disabled={busy || !valid}
          onPress={submit}
          style={{
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
            opacity: busy || !valid ? 0.5 : 1,
            marginTop: theme.spacing.xl,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
            {busy ? "Enrolling…" : "Confirm enrolment"}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, textAlign: "center", marginTop: theme.spacing.md }}>
          No payment now — pay each installment from your dashboard.
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useStore();
  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { theme } = useStore();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.md, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, paddingHorizontal: theme.spacing.lg }}>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { borderWidth: StyleSheet.hairlineWidth },
});
