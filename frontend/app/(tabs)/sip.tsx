import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated"

import {
  getMetalWallet,
  getRates,
  getSipEnrollments,
  getSipPlans,
  MetalWallet,
  Rates,
  sipMandateCharge,
  sipMandateConfirm,
  sipMandateDevConfirm,
  sipMandateSetup,
  sipPay,
  sipPayConfirm,
  sipPayDevConfirm,
  SipEnrollment,
  SipPlan,
} from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { FadeInView } from "@/src/components/FadeInView"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"
import { LoadingView } from "@/src/components/StateViews"
import { LiveRatesPanel } from "@/src/components/storefront/LiveRatesPanel"
import { MetalFilter, MetalFilterToggle } from "@/src/components/storefront/MetalFilterToggle"
import { SipPlanCard } from "@/src/components/storefront/SipPlanCard"
import { useSipReminders } from "@/src/context/SipRemindersContext"
import { useCustomerAuth } from "@/src/context/CustomerAuthContext"
import { RazorpayCheckoutModal, RazorpayCheckoutOptions } from "@/src/payments/RazorpayCheckoutModal"

/** Pulsing border for due banner. */
function PulsingBorder({ color, children }: { color: string; children: React.ReactNode }) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [opacity])

  const style = useAnimatedStyle(() => ({ borderColor: color, opacity: opacity.value }))

  return <Animated.View style={style}>{children}</Animated.View>
}

export default function SipScreen() {
  const { code, theme, businessName } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token, ready } = useCustomerAuth()

  const [metal, setMetal] = useState<MetalFilter>("gold")
  const [enrollments, setEnrollments] = useState<SipEnrollment[]>([])
  const [plans, setPlans] = useState<SipPlan[]>([])
  const [rates, setRates] = useState<Rates | null>(null)
  const [wallet, setWallet] = useState<MetalWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [pendingSipId, setPendingSipId] = useState<string | null>(null)
  const [pendingMandateId, setPendingMandateId] = useState<string | null>(null)
  const [checkoutOpts, setCheckoutOpts] = useState<RazorpayCheckoutOptions | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const { next: dueReminder, refresh: refreshReminders } = useSipReminders()

  const load = useCallback(async () => {
    try {
      const pl = await getSipPlans(code)
      setPlans(pl)
      if (token) {
        setEnrollments(await getSipEnrollments(code))
        try {
          setWallet(await getMetalWallet(code))
        } catch {
          setWallet(null)
        }
      } else {
        setEnrollments([])
        setWallet(null)
      }
      try {
        setRates(await getRates(code))
      } catch {}
    } catch {
      setEnrollments([])
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [code, token])

  useFocusEffect(
    useCallback(() => {
      if (!ready) return
      load()
      refreshReminders()
    }, [load, refreshReminders, ready]),
  )

  const filteredPlans = useMemo(() => plans.filter((p) => (p.metal || "gold") === metal), [plans, metal])
  const filteredEnrollments = useMemo(
    () => enrollments.filter((e) => (e.metal || "gold") === metal),
    [enrollments, metal],
  )

  const handleEnrol = (planId: string) => {
    if (!token) {
      router.push(`/login?next=/sip/enroll?planId=${planId}`)
      return
    }
    router.push(`/sip/enroll?planId=${planId}`)
  }

  const pay = async (id: string) => {
    if (!token) {
      router.push("/login?next=/(tabs)/sip")
      return
    }
    setPayingId(id)
    setPayError(null)
    try {
      const payRes = await sipPay(code, id)
      if (payRes.mock) {
        const updated = await sipPayDevConfirm(code, id)
        setEnrollments((prev) => prev.map((e) => (e.id === id ? updated : e)))
        refreshReminders()
        setPayingId(null)
        return
      }
      setCheckoutOpts({
        keyId: payRes.key_id,
        orderId: payRes.razorpay_order_id,
        amountPaise: payRes.amount,
        currency: payRes.currency || "INR",
        name: businessName || "Metal SIP",
        description: "SIP installment",
        prefill: {},
      })
      setPendingSipId(id)
      setPendingMandateId(null)
    } catch (e: any) {
      setPayError(e?.message ?? "Could not start payment")
      setPayingId(null)
    }
  }

  const setupMandate = async (id: string) => {
    if (!token) {
      router.push("/login?next=/(tabs)/sip")
      return
    }
    setPayingId(id)
    setPayError(null)
    try {
      const setup = await sipMandateSetup(code, id)
      if (setup.mock) {
        const updated = await sipMandateDevConfirm(code, id)
        setEnrollments((prev) => prev.map((e) => (e.id === id ? updated : e)))
        refreshReminders()
        setPayingId(null)
        return
      }
      setCheckoutOpts({
        keyId: setup.key_id,
        orderId: setup.razorpay_order_id,
        amountPaise: setup.amount,
        currency: setup.currency || "INR",
        name: businessName || "Metal SIP",
        description: "Authorize UPI Autopay",
        prefill: {},
      })
      setPendingMandateId(id)
      setPendingSipId(null)
    } catch (e: any) {
      setPayError(e?.message ?? "Could not start Autopay setup")
      setPayingId(null)
    }
  }

  const chargeMandate = async (id: string) => {
    setPayingId(id)
    setPayError(null)
    try {
      const res = await sipMandateCharge(code, id)
      if (res && "id" in res) {
        setEnrollments((prev) => prev.map((e) => (e.id === id ? (res as SipEnrollment) : e)))
        refreshReminders()
      } else if (res && "message" in res) {
        setPayError(String(res.message))
        await load()
      }
    } catch (e: any) {
      setPayError(e?.message ?? "Autopay charge failed — try Pay installment")
    } finally {
      setPayingId(null)
    }
  }

  const handleCheckoutSuccess = async (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => {
    try {
      if (pendingMandateId) {
        const updated = await sipMandateConfirm(code, pendingMandateId, payload)
        setEnrollments((prev) => prev.map((e) => (e.id === pendingMandateId ? updated : e)))
        refreshReminders()
      } else if (pendingSipId) {
        const updated = await sipPayConfirm(code, pendingSipId, payload)
        setEnrollments((prev) => prev.map((e) => (e.id === pendingSipId ? updated : e)))
        refreshReminders()
      }
    } catch {}
    setCheckoutOpts(null)
    setPendingSipId(null)
    setPendingMandateId(null)
    setPayingId(null)
  }

  if (loading) return <LoadingView label="Loading your plans" />

  const metalTitle = metal === "silver" ? "Silver" : "Gold"

  const cardShadow = Platform.select({
    ios: {
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
  })

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="sip-screen">
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            backgroundColor: theme.colors.headerBg,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.sm,
            letterSpacing: 2.5,
            color: theme.colors.secondary,
          }}
        >
          SAVINGS
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: theme.fontSize["3xl"],
            color: theme.colors.headerText,
          }}
        >
          Metal SIP
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView direction="up" duration={400}>
          <View style={{ marginBottom: theme.spacing.md }}>
            <MetalFilterToggle value={metal} onChange={setMetal} />
          </View>
        </FadeInView>

        {rates ? (
          <FadeInView direction="up" delay={50}>
            <LiveRatesPanel rates={rates} variant="compact" metal={metal} testID="sip-rate-banner" />
          </FadeInView>
        ) : null}

        {rates && metal === "gold" && rates.silver ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.muted,
              fontSize: 12,
              marginTop: 6,
            }}
          >
            Silver also {formatMoney(rates.silver.inr_per_gram)} / g — switch tab to buy or enrol
            silver.
          </Text>
        ) : null}

        {/* Metal wallet card */}
        {token && wallet ? (
          <FadeInView delay={100} direction="up">
            <View
              style={[
                styles.walletRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.md,
                  ...cardShadow,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    backgroundColor: `${theme.colors.accent}14`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="briefcase" size={16} color={theme.colors.accent} />
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.text,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Your metal wallet
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: theme.spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: theme.colors.background,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.colors.accent,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    Gold {wallet.gold_grams.toFixed(3)} g
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: theme.colors.background,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.colors.muted,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: theme.fonts.body,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    Silver {wallet.silver_grams.toFixed(3)} g
                  </Text>
                </View>
              </View>
            </View>
          </FadeInView>
        ) : null}

        <AnimatedPressable
          testID="sip-onetime-buy"
          onPress={() => {
            if (!token) {
              router.push("/login?next=/metal/buy")
              return
            }
            router.push(`/metal/buy?metal=${metal}`)
          }}
          style={[
            styles.enrolBtn,
            {
              borderColor: theme.colors.primary,
              borderRadius: theme.radius.pill,
              marginTop: theme.spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="One-time metal purchase"
          pressScale={0.96}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.colors.primary,
              fontSize: theme.fontSize.base,
            }}
          >
            One-time {metalTitle.toLowerCase()} buy
          </Text>
          <Feather name="shopping-bag" size={15} color={theme.colors.primary} />
        </AnimatedPressable>

        {payError ? (
          <Text
            testID="sip-pay-error"
            style={{
              fontFamily: theme.fonts.body,
              color: "#DC2626",
              fontSize: 13,
              marginTop: theme.spacing.md,
            }}
          >
            {payError}
          </Text>
        ) : null}

        {/* Due banner with pulsing attention */}
        {dueReminder && filteredEnrollments.some((e) => e.id === dueReminder.enrollment_id) ? (
          <FadeInView direction="up" delay={150}>
            <View
              testID="sip-due-banner"
              style={[
                styles.dueBanner,
                {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.md,
                  ...cardShadow,
                },
              ]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: `${theme.colors.primary}14`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="bell" size={16} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {dueReminder.plan_name} installment of {formatMoney(dueReminder.amount)} is due
                  now.
                </Text>
                <AnimatedPressable
                  testID="sip-due-pay-cta"
                  disabled={payingId === dueReminder.enrollment_id}
                  onPress={() => pay(dueReminder.enrollment_id)}
                  style={{
                    marginTop: 10,
                    alignSelf: "flex-start",
                    paddingHorizontal: 16,
                    height: 36,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.primary,
                    justifyContent: "center",
                    opacity: payingId === dueReminder.enrollment_id ? 0.5 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Pay due installment"
                  pressScale={0.95}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyMedium,
                      color: theme.colors.onPrimary || "#fff",
                      fontSize: 13,
                    }}
                  >
                    {payingId === dueReminder.enrollment_id ? "Opening…" : "Pay now"}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {/* Enrolled plans */}
        {filteredEnrollments.length > 0 ? (
          <>
            <FadeInView direction="up" delay={200}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    fontFamily: theme.fonts.heading,
                    color: theme.colors.text,
                    fontSize: theme.fontSize["2xl"],
                    marginTop: theme.spacing.xl,
                  },
                ]}
              >
                Your {metalTitle.toLowerCase()} plans
              </Text>
            </FadeInView>
            {filteredEnrollments.map((e, idx) => {
              const s = e.summary
              const progress = s.total_installments ? s.paid_installments / s.total_installments : 0
              const done = e.status === "matured"
              const gramsLabel = e.metal === "silver" ? "Silver" : "Gold"
              return (
                <FadeInView key={e.id} delay={250 + idx * 60} direction="up">
                  <View
                    testID={`sip-enrollment-${e.id}`}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.lg,
                        ...cardShadow,
                      },
                    ]}
                  >
                    <View
                      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Text
                        style={{
                          fontFamily: theme.fonts.bodyMedium,
                          color: theme.colors.text,
                          fontSize: theme.fontSize.lg,
                        }}
                      >
                        {e.plan_name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: theme.fonts.body,
                          color: theme.colors.muted,
                          fontSize: theme.fontSize.sm,
                        }}
                      >
                        {formatMoney(e.monthly_amount)}/mo
                      </Text>
                    </View>
                    {e.preferred_day ? (
                      <Text
                        style={{
                          fontFamily: theme.fonts.body,
                          color: theme.colors.muted,
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        Debit day: {e.preferred_day}
                      </Text>
                    ) : null}

                    {/* Animated progress bar */}
                    <View
                      style={[
                        styles.track,
                        { backgroundColor: theme.colors.border, marginTop: theme.spacing.md },
                      ]}
                    >
                      <View
                        style={{
                          width: `${Math.round(progress * 100)}%`,
                          height: "100%",
                          backgroundColor: theme.colors.primary,
                          borderRadius: 999,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: theme.fonts.body,
                        color: theme.colors.muted,
                        fontSize: theme.fontSize.sm,
                        marginTop: 6,
                      }}
                    >
                      {s.paid_installments} of {s.total_installments} installments paid
                    </Text>

                    <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing.lg }}>
                      <Stat label="Saved" value={formatMoney(s.total_paid)} />
                      <Stat label={gramsLabel} value={`${s.grams_accrued.toFixed(3)} g`} />
                      <Stat
                        label="Value"
                        value={s.current_value != null ? formatMoney(s.current_value) : "—"}
                      />
                    </View>

                    {done ? (
                      <View style={[styles.matured, { borderColor: theme.colors.primary }]}>
                        <Feather name="check-circle" size={15} color={theme.colors.primary} />
                        <Text
                          style={{
                            fontFamily: theme.fonts.bodyMedium,
                            color: theme.colors.primary,
                            fontSize: theme.fontSize.sm,
                          }}
                        >
                          Matured — visit store to redeem
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text
                          style={{
                            fontFamily: theme.fonts.body,
                            color: theme.colors.muted,
                            fontSize: 12,
                            marginTop: theme.spacing.md,
                          }}
                        >
                          Autopay: {e.mandate_status || "none"}
                        </Text>
                        {(e.mandate_status === "none" ||
                          e.mandate_status === "cancelled" ||
                          e.mandate_status === "failed" ||
                          !e.mandate_status) && (
                          <AnimatedPressable
                            testID={`sip-mandate-setup-${e.id}`}
                            disabled={payingId === e.id}
                            onPress={() => setupMandate(e.id)}
                            style={[
                              styles.enrolBtn,
                              {
                                borderColor: theme.colors.primary,
                                borderRadius: theme.radius.pill,
                                marginTop: 10,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Set up UPI Autopay"
                            pressScale={0.96}
                          >
                            <Text
                              style={{
                                fontFamily: theme.fonts.bodyMedium,
                                color: theme.colors.primary,
                                fontSize: theme.fontSize.base,
                              }}
                            >
                              {payingId === e.id ? "Setting up…" : "Set up UPI Autopay"}
                            </Text>
                            <Feather name="zap" size={15} color={theme.colors.primary} />
                          </AnimatedPressable>
                        )}
                        {e.mandate_status === "active" ? (
                          <AnimatedPressable
                            testID={`sip-mandate-charge-${e.id}`}
                            disabled={payingId === e.id}
                            onPress={() => chargeMandate(e.id)}
                            style={[
                              styles.payBtn,
                              {
                                backgroundColor: theme.colors.primary,
                                borderRadius: theme.radius.pill,
                                opacity: payingId === e.id ? 0.5 : 1,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Charge via Autopay"
                            pressScale={0.96}
                          >
                            <Text
                              style={{
                                fontFamily: theme.fonts.bodyMedium,
                                color: theme.colors.onPrimary,
                                fontSize: theme.fontSize.base,
                              }}
                            >
                              {payingId === e.id ? "Charging…" : `Autopay · ${formatMoney(e.monthly_amount)}`}
                            </Text>
                          </AnimatedPressable>
                        ) : null}
                        <AnimatedPressable
                          testID={`sip-pay-${e.id}`}
                          disabled={payingId === e.id}
                          onPress={() => pay(e.id)}
                          style={[
                            styles.payBtn,
                            {
                              backgroundColor: theme.colors.primary,
                              borderRadius: theme.radius.pill,
                              opacity: payingId === e.id ? 0.5 : 1,
                              marginTop: e.mandate_status === "active" ? 8 : 12,
                            },
                          ]}
                          pressScale={0.96}
                        >
                          <Text
                            style={{
                              fontFamily: theme.fonts.bodyMedium,
                              color: theme.colors.onPrimary,
                              fontSize: theme.fontSize.base,
                            }}
                          >
                            {payingId === e.id
                              ? "Processing…"
                              : `Pay installment · ${formatMoney(e.monthly_amount)}`}
                          </Text>
                        </AnimatedPressable>
                      </>
                    )}
                  </View>
                </FadeInView>
              )
            })}
          </>
        ) : null}

        <FadeInView direction="up" delay={300}>
          <Text
            style={[
              styles.sectionTitle,
              {
                fontFamily: theme.fonts.heading,
                color: theme.colors.text,
                fontSize: theme.fontSize["2xl"],
                marginTop: theme.spacing.xl,
              },
            ]}
          >
            {filteredEnrollments.length
              ? `Start another ${metalTitle.toLowerCase()} plan`
              : `Start saving in ${metalTitle.toLowerCase()}`}
          </Text>
        </FadeInView>
        {filteredPlans.length === 0 ? (
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14 }}>
            No {metalTitle.toLowerCase()} plans available yet.
          </Text>
        ) : (
          filteredPlans.map((p, idx) => (
            <FadeInView key={p.id} delay={350 + idx * 60} direction="up">
              <SipPlanCard plan={p} onEnrol={handleEnrol} testID={`sip-plan-${p.id}`} />
            </FadeInView>
          ))
        )}
      </ScrollView>

      <RazorpayCheckoutModal
        visible={!!checkoutOpts}
        options={checkoutOpts}
        onSuccess={handleCheckoutSuccess}
        onDismiss={(reason) => {
          setCheckoutOpts(null)
          setPendingSipId(null)
          setPendingMandateId(null)
          setPayingId(null)
          if (reason) setPayError(reason)
        }}
      />
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useStore()
  return (
    <View>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          color: theme.colors.text,
          fontSize: theme.fontSize.base,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  walletRow: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  dueBanner: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderWidth: 1.5 },
  sectionTitle: { marginBottom: 12 },
  card: { padding: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  track: { height: 6, borderRadius: 999, overflow: "hidden" },
  payBtn: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 16 },
  enrolBtn: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    marginTop: 16,
  },
  matured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 16,
    alignSelf: "flex-start",
  },
})
