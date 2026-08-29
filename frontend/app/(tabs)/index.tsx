import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import { ApiError, getMetalWallet, getRates, getSavingsSummary, getSipEnrollments, getSipPlans, Rates, SavingsSummary, SipPlan } from "@/src/api/client"
import { BrandMark } from "@/src/components/BrandMark"
import { HeaderIcons } from "@/src/components/HeaderIcons"
import { LoadingView, MessageView } from "@/src/components/StateViews"
import { LiveRatesPanel } from "@/src/components/storefront/LiveRatesPanel"
import { MetalFilter, MetalFilterToggle } from "@/src/components/storefront/MetalFilterToggle"
import { SavingsSummaryPanel } from "@/src/components/storefront/SavingsSummaryPanel"
import { SipPlanCard } from "@/src/components/storefront/SipPlanCard"
import { useCustomerAuth } from "@/src/context/CustomerAuthContext"
import { useSipReminders } from "@/src/context/SipRemindersContext"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"
import { computeSavingsSummary } from "@/src/utils/computeSavingsSummary"

export default function HomeScreen() {
  const { code, status, theme, businessName, sections, errorMessage, reload } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token, ready } = useCustomerAuth()
  const { next: dueReminder, refresh: refreshReminders } = useSipReminders()

  const [rates, setRates] = useState<Rates | null>(null)
  const [plans, setPlans] = useState<SipPlan[]>([])
  const [summary, setSummary] = useState<SavingsSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [metal, setMetal] = useState<MetalFilter>("gold")
  const [loading, setLoading] = useState(true)
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const hasSection = (t: string) => sections.some((s) => s.type === t)
  const showRates = hasSection("rate_ticker")
  const showSip = hasSection("sip_cta")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ratesRes, plansRes] = await Promise.all([
        getRates(code).catch(() => null),
        getSipPlans(code).catch(() => []),
      ])
      setRates(ratesRes)
      setPlans(plansRes)
    } finally {
      setLoading(false)
    }
  }, [code])

  const loadSummary = useCallback(async () => {
    if (!token) {
      setSummary(null)
      setSummaryError(null)
      return
    }
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setSummary(await getSavingsSummary(code))
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 404) {
        try {
          const [enrollments, wallet, ratesRes] = await Promise.all([
            getSipEnrollments(code),
            getMetalWallet(code),
            getRates(code),
          ])
          setSummary(computeSavingsSummary(enrollments, wallet, ratesRes))
        } catch (fallbackErr: unknown) {
          setSummary(null)
          setSummaryError(fallbackErr instanceof Error ? fallbackErr.message : "Could not load savings")
        }
      } else {
        setSummary(null)
        setSummaryError(e instanceof Error ? e.message : "Could not load savings")
      }
    } finally {
      setSummaryLoading(false)
    }
  }, [code, token])

  useEffect(() => {
    if (status === "ready") loadData()
  }, [status, loadData])

  useEffect(() => {
    if (status === "ready" && ready) loadSummary()
  }, [status, ready, loadSummary])

  useFocusEffect(
    useCallback(() => {
      if (status === "ready") {
        loadData()
        loadSummary()
        refreshReminders()
      }
    }, [status, loadData, loadSummary, refreshReminders])
  )

  const filteredPlans = useMemo(() => plans.filter((p) => (p.metal || "gold") === metal), [plans, metal])
  const metalTitle = metal === "silver" ? "Silver" : "Gold"

  const handleEnrol = (planId: string) => {
    if (!token) {
      router.push(`/login?next=/sip/enroll?planId=${planId}`)
      return
    }
    router.push(`/sip/enroll?planId=${planId}`)
  }

  const handleOneTimeBuy = (buyMetal: MetalFilter) => {
    if (!token) {
      router.push(`/login?next=/metal/buy?metal=${buyMetal}`)
      return
    }
    router.push(`/metal/buy?metal=${buyMetal}`)
  }

  if (status === "loading") return <LoadingView label="Opening store" />
  if (status !== "ready") {
    return (
      <MessageView
        testID="store-unavailable-view"
        icon={status === "notfound" ? "help-circle" : "alert-triangle"}
        title={status === "notfound" ? "Store not found" : "Temporarily unavailable"}
        subtitle={errorMessage}
        actionLabel="Retry"
        onAction={reload}
      />
    )
  }

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.headerBg,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View testID="home-wordmark" style={{ flex: 1 }}>
            <BrandMark compact />
          </View>
          <HeaderIcons />
        </View>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary, marginTop: theme.spacing.sm }}>
          {(businessName || "").toUpperCase()}
        </Text>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["3xl"], color: theme.colors.headerText, marginTop: 2 }}>
          Today&apos;s rates & savings
        </Text>
      </View>

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {loading && !rates ? (
          <LoadingView label="Loading rates" />
        ) : showRates && rates ? (
          <LiveRatesPanel
            rates={rates}
            variant="full"
            onGoldPress={() => handleOneTimeBuy("gold")}
            onSilverPress={() => handleOneTimeBuy("silver")}
          />
        ) : null}

        <SavingsSummaryPanel
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          signedIn={!!token}
          onRetry={loadSummary}
        />

        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <Pressable
            testID="home-start-sip"
            onPress={() => router.push("/sip")}
            style={[styles.primaryAction, { flex: 1, backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
            accessibilityRole="button"
            accessibilityLabel="Start SIP"
          >
            <Feather name="trending-up" size={16} color={theme.colors.onPrimary} />
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.sm }}>
              Start SIP
            </Text>
          </Pressable>
          <Pressable
            testID="home-onetime-buy"
            onPress={() => handleOneTimeBuy(metal)}
            style={[styles.primaryAction, { flex: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.pill, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="One-time metal purchase"
          >
            <Feather name="shopping-bag" size={16} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.sm }}>
              One-time buy
            </Text>
          </Pressable>
        </View>

        {dueReminder && !reminderDismissed ? (
          <Pressable
            testID="sip-reminder-card"
            onPress={() => router.push("/sip")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.surface,
            }}
            accessibilityRole="button"
            accessibilityLabel="Pay due SIP installment"
          >
            <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Feather name="bell" size={16} color={theme.colors.onPrimary} />
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>
                Installment due
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 1 }}>
                {dueReminder.plan_name} · {formatMoney(dueReminder.amount)} — tap to pay
              </Text>
            </View>
            <Pressable testID="sip-reminder-dismiss" onPress={() => setReminderDismissed(true)} hitSlop={10} style={{ padding: 4 }}>
              <Feather name="x" size={18} color={theme.colors.muted} />
            </Pressable>
          </Pressable>
        ) : null}

        {showSip ? (
          <>
            <View>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.text, marginBottom: theme.spacing.md }}>
                Metal SIP plans
              </Text>
              <MetalFilterToggle value={metal} onChange={setMetal} />
            </View>

            {filteredPlans.length === 0 ? (
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14 }}>
                No {metalTitle.toLowerCase()} plans available yet.
              </Text>
            ) : (
              filteredPlans.map((p) => (
                <SipPlanCard
                  key={p.id}
                  plan={p}
                  onEnrol={handleEnrol}
                  testID={`sip-plan-preview-${p.id}`}
                  compact
                />
              ))
            )}

            <Pressable
              testID="home-view-all-plans"
              onPress={() => router.push("/sip")}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
              accessibilityRole="button"
              accessibilityLabel="View all SIP plans"
            >
              <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.base }}>
                View all plans
              </Text>
              <Feather name="arrow-right" size={16} color={theme.colors.primary} />
            </Pressable>
          </>
        ) : null}

        <Pressable
          testID="home-shop-collections"
          onPress={() => router.push("/collections")}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: theme.spacing.xs }}
          accessibilityRole="button"
          accessibilityLabel="Shop jewellery collections"
        >
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>
            Browse jewellery
          </Text>
          <Feather name="arrow-right" size={14} color={theme.colors.muted} />
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
  },
})
