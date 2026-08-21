import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import {
  getRates,
  getSipEnrollments,
  getSipPlans,
  Rates,
  sipPay,
  SipEnrollment,
  SipPlan,
} from "@/src/api/client";
import { useStore } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { getGuestId } from "@/src/utils/guest";
import { LoadingView } from "@/src/components/StateViews";
import { useSipReminders } from "@/src/context/SipRemindersContext";

export default function SipScreen() {
  const { code, theme } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [enrollments, setEnrollments] = useState<SipEnrollment[]>([]);
  const [plans, setPlans] = useState<SipPlan[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { next: dueReminder, refresh: refreshReminders } = useSipReminders();

  const load = useCallback(async () => {
    try {
      const gid = await getGuestId();
      const [en, pl] = await Promise.all([getSipEnrollments(code, gid), getSipPlans(code)]);
      setEnrollments(en);
      setPlans(pl);
      try {
        setRates(await getRates(code));
      } catch {}
    } catch {
      setEnrollments([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshReminders();
    }, [load, refreshReminders])
  );

  const pay = async (id: string) => {
    setPayingId(id);
    try {
      const gid = await getGuestId();
      const updated = await sipPay(code, id, gid);
      setEnrollments((prev) => prev.map((e) => (e.id === id ? updated : e)));
      refreshReminders();
    } catch {}
    setPayingId(null);
  };

  if (loading) return <LoadingView label="Loading your plans" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="sip-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.headerBg, borderBottomColor: theme.colors.border }]}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
          SAVINGS
        </Text>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["3xl"], color: theme.colors.headerText }}>
          Gold SIP
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }} showsVerticalScrollIndicator={false}>
        {rates ? (
          <View style={[styles.rateBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Feather name="trending-up" size={14} color={theme.colors.secondary} />
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginLeft: 6 }}>
              Live gold rate
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.sm }}>
              {formatMoney(rates.gold.inr_per_gram)} / g{rates.stale ? " (delayed)" : ""}
            </Text>
          </View>
        ) : null}

        {/* Due reminder banner */}
        {dueReminder ? (
          <View testID="sip-due-banner" style={[styles.dueBanner, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, marginTop: theme.spacing.md }]}>
            <Feather name="bell" size={16} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.sm, marginLeft: 8, flex: 1 }}>
              {dueReminder.plan_name} installment of {formatMoney(dueReminder.amount)} is due now.
            </Text>
          </View>
        ) : null}

        {/* Active plans */}
        {enrollments.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { fontFamily: theme.fonts.heading, color: theme.colors.text, fontSize: theme.fontSize["2xl"], marginTop: theme.spacing.lg }]}>
              Your plans
            </Text>
            {enrollments.map((e) => {
              const s = e.summary;
              const progress = s.total_installments ? s.paid_installments / s.total_installments : 0;
              const done = e.status === "matured";
              return (
                <View key={e.id} testID={`sip-enrollment-${e.id}`} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.lg }}>{e.plan_name}</Text>
                    <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{formatMoney(e.monthly_amount)}/mo</Text>
                  </View>

                  {/* progress */}
                  <View style={[styles.track, { backgroundColor: theme.colors.border, marginTop: theme.spacing.md }]}>
                    <View style={{ width: `${Math.round(progress * 100)}%`, height: "100%", backgroundColor: theme.colors.primary, borderRadius: 999 }} />
                  </View>
                  <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 6 }}>
                    {s.paid_installments} of {s.total_installments} installments paid
                  </Text>

                  <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing.lg }}>
                    <Stat label="Saved" value={formatMoney(s.total_paid)} />
                    <Stat label="Gold" value={`${s.grams_accrued.toFixed(3)} g`} />
                    <Stat label="Value" value={s.current_value != null ? formatMoney(s.current_value) : "—"} />
                  </View>

                  {done ? (
                    <View style={[styles.matured, { borderColor: theme.colors.primary }]}>
                      <Feather name="check-circle" size={15} color={theme.colors.primary} />
                      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.sm }}>Matured — visit store to redeem</Text>
                    </View>
                  ) : (
                    <Pressable
                      testID={`sip-pay-${e.id}`}
                      disabled={payingId === e.id}
                      onPress={() => pay(e.id)}
                      style={[styles.payBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, opacity: payingId === e.id ? 0.5 : 1 }]}
                    >
                      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
                        {payingId === e.id ? "Processing…" : `Pay installment · ${formatMoney(e.monthly_amount)}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        ) : null}

        {/* Available plans */}
        <Text style={[styles.sectionTitle, { fontFamily: theme.fonts.heading, color: theme.colors.text, fontSize: theme.fontSize["2xl"], marginTop: theme.spacing.xl }]}>
          {enrollments.length ? "Start another plan" : "Start saving"}
        </Text>
        {plans.map((p) => (
          <View key={p.id} testID={`sip-plan-${p.id}`} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.lg }}>{p.name}</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: 2 }}>{p.tagline}</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base, marginTop: theme.spacing.sm, lineHeight: 22 }}>
              {p.benefit_text}
            </Text>
            <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing.lg }}>
              <Stat label="From" value={`${formatMoney(p.monthly_amount)}/mo`} />
              <Stat label="Tenure" value={`${p.tenure_months} mo`} />
              {p.bonus_months ? <Stat label="Bonus" value={`+${p.bonus_months} mo`} /> : null}
            </View>
            <Pressable
              testID={`sip-enrol-${p.id}`}
              onPress={() => router.push(`/sip/enroll?planId=${p.id}`)}
              style={[styles.enrolBtn, { borderColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
            >
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.base }}>Enrol now</Text>
              <Feather name="arrow-right" size={15} color={theme.colors.primary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useStore();
  return (
    <View>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  rateBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: StyleSheet.hairlineWidth },
  dueBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1 },
  sectionTitle: { marginBottom: 12 },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  track: { height: 6, borderRadius: 999, overflow: "hidden" },
  payBtn: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 16 },
  enrolBtn: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, marginTop: 16 },
  matured: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginTop: 16, alignSelf: "flex-start" },
});
