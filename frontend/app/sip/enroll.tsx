import React, { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import {
  getSipPlans,
  sipEnroll,
  sipPay,
  sipPayConfirm,
  sipPayDevConfirm,
  SipPlan,
} from "@/src/api/client"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"
import { LoadingView } from "@/src/components/StateViews"
import { useCustomerAuth } from "@/src/context/CustomerAuthContext"
import { PhoneInputIN, isValidInMobile10, digitsOnly10 } from "@/src/components/PhoneInputIN"
import { RazorpayCheckoutModal, RazorpayCheckoutOptions } from "@/src/payments/RazorpayCheckoutModal"

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

export default function SipEnrollScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const { code, theme, businessName } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token, customer, ready } = useCustomerAuth()

  const [plan, setPlan] = useState<SipPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState("")
  const [preferredDay, setPreferredDay] = useState(Math.min(28, new Date().getDate()) || 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpts, setCheckoutOpts] = useState<RazorpayCheckoutOptions | null>(null)
  const [pendingEnrollmentId, setPendingEnrollmentId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!token) {
      router.replace(`/login?next=/sip/enroll?planId=${planId}`)
      return
    }
    if (customer) {
      setName((n) => n || customer.name || "")
      setPhone((p) => p || digitsOnly10(customer.phone || ""))
    }
  }, [ready, token, customer, router, planId])

  useEffect(() => {
    ;(async () => {
      try {
        const plans = await getSipPlans(code)
        const p = plans.find((x) => x.id === planId) ?? null
        setPlan(p)
        if (p) setAmount(String(p.monthly_amount))
      } finally {
        setLoading(false)
      }
    })()
  }, [code, planId])

  const amountNum = useMemo(() => parseInt(amount || "0", 10), [amount])
  const valid =
    name.trim().length > 1 && isValidInMobile10(phone) && !!plan && amountNum >= (plan?.min_amount || 0)

  const finishToSip = () => {
    setBusy(false)
    setCheckoutOpts(null)
    setPendingEnrollmentId(null)
    router.replace("/(tabs)/sip")
  }

  const startFirstPayment = async (enrollmentId: string) => {
    const payRes = await sipPay(code, enrollmentId)
    if (payRes.mock) {
      await sipPayDevConfirm(code, enrollmentId)
      finishToSip()
      return
    }
    setPendingEnrollmentId(enrollmentId)
    setCheckoutOpts({
      keyId: payRes.key_id,
      orderId: payRes.razorpay_order_id,
      amountPaise: payRes.amount,
      currency: payRes.currency || "INR",
      name: businessName || "Metal SIP",
      description: "First SIP installment",
      prefill: {},
    })
    setBusy(false)
  }

  const submit = async () => {
    if (!plan || !valid || !token) {
      if (plan && amountNum < plan.min_amount) setError(`Minimum ${formatMoney(plan.min_amount)} per month.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const enrollment = await sipEnroll(code, {
        plan_id: plan.id,
        monthly_amount: amountNum,
        name: name.trim(),
        phone: phone.trim(),
        preferred_day: preferredDay,
      })
      await startFirstPayment(enrollment.id)
    } catch (e: any) {
      setError(e?.message ?? "Could not enrol. Please try again.")
      setBusy(false)
    }
  }

  const handleCheckoutSuccess = async (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => {
    if (!pendingEnrollmentId) return
    try {
      await sipPayConfirm(code, pendingEnrollmentId, payload)
    } catch {}
    finishToSip()
  }

  if (loading) return <LoadingView />
  if (!plan) return null

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
  }

  const metalLabel = plan.metal === "silver" ? "Silver" : "Gold"

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="sip-enroll-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="enroll-back" onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
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
        <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: 8 }}>
          {metalLabel} SIP · first payment required now
        </Text>

        <Field label="Your name">
          <TextInput testID="enroll-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.colors.muted} style={inputStyle} />
        </Field>
        <Field label="Mobile number">
          <PhoneInputIN testID="enroll-phone" value={phone} onChangeText={setPhone} style={{ marginTop: theme.spacing.sm }} />
        </Field>
        <Field label={`Monthly amount (min ${formatMoney(plan.min_amount)})`}>
          <TextInput testID="enroll-amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Amount" placeholderTextColor={theme.colors.muted} style={inputStyle} />
        </Field>

        <Field label="Monthly autopay day (1–28)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: theme.spacing.sm }}>
            {DAYS.map((d) => {
              const on = d === preferredDay
              return (
                <Pressable
                  key={d}
                  testID={`enroll-day-${d}`}
                  onPress={() => setPreferredDay(d)}
                  style={{
                    width: 40,
                    height: 40,
                    marginRight: 8,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: on ? theme.colors.primary : theme.colors.border,
                    backgroundColor: on ? theme.colors.primary : theme.colors.surface,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Debit day ${d}`}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={{ fontFamily: theme.fonts.bodyMedium, color: on ? theme.colors.onPrimary || "#fff" : theme.colors.text, fontSize: 13 }}>
                    {d}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
            First installment is due now. Later installments fall on day {preferredDay} each month.
          </Text>
        </Field>

        {error ? (
          <Text testID="enroll-error" style={{ fontFamily: theme.fonts.body, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: theme.spacing.md }}>
            {error}
          </Text>
        ) : null}

        <View style={[styles.summary, { borderColor: theme.colors.border, borderRadius: theme.radius.lg, marginTop: theme.spacing.xl }]}>
          <Row label="Plan tenure" value={`${plan.tenure_months} months`} />
          {plan.bonus_months ? <Row label="Bonus installments" value={`+${plan.bonus_months}`} /> : null}
          <Row label="Debit day" value={`Day ${preferredDay}`} />
          <Row label="Pay now" value={formatMoney(amountNum || plan.monthly_amount)} last />
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
          accessibilityRole="button"
          accessibilityLabel="Confirm enrolment and pay"
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
            {busy ? "Opening payment…" : `Enrol & pay ${formatMoney(amountNum || plan.monthly_amount)}`}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, textAlign: "center", marginTop: theme.spacing.md }}>
          Payment is compulsory to start your SIP. You will be redirected to Razorpay Checkout.
        </Text>
      </KeyboardAwareScrollView>

      <RazorpayCheckoutModal
        visible={!!checkoutOpts}
        options={checkoutOpts}
        onSuccess={handleCheckoutSuccess}
        onDismiss={(reason) => {
          setCheckoutOpts(null)
          setPendingEnrollmentId(null)
          setBusy(false)
          if (reason) setError(reason)
          else setError("Payment cancelled — pay the first installment from Savings.")
          router.replace("/(tabs)/sip")
        }}
      />
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useStore()
  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{label}</Text>
      {children}
    </View>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { theme } = useStore()
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.md, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, paddingHorizontal: theme.spacing.lg }}>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { borderWidth: StyleSheet.hairlineWidth },
})
