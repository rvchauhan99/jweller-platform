import React, { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import {
  ApiError,
  Category,
  getCategories,
  getMetalWallet,
  getRates,
  getSavingsSummary,
  getSipEnrollments,
  getSipPlans,
  Rates,
  SavingsSummary,
  SipPlan,
} from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { BrandMark } from "@/src/components/BrandMark"
import { FadeInView } from "@/src/components/FadeInView"
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

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export default function HomeScreen() {
  const { code, status, theme, businessName, sections, errorMessage, reload } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token, ready } = useCustomerAuth()
  const { next: dueReminder, refresh: refreshReminders } = useSipReminders()
  const { width: screenW } = useWindowDimensions()

  const [rates, setRates] = useState<Rates | null>(null)
  const [plans, setPlans] = useState<SipPlan[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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
      const [ratesRes, plansRes, catsRes] = await Promise.all([
        getRates(code).catch(() => null),
        getSipPlans(code).catch(() => []),
        getCategories(code).catch(() => []),
      ])
      setRates(ratesRes)
      setPlans(plansRes)
      setCategories(catsRes)
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
          setSummaryError(
            fallbackErr instanceof Error ? fallbackErr.message : "Could not load savings",
          )
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
    }, [status, loadData, loadSummary, refreshReminders]),
  )

  const filteredPlans = useMemo(
    () => plans.filter((p) => (p.metal || "gold") === metal),
    [plans, metal],
  )
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

  const sipPlanCardWidth = screenW * 0.78

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] + 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Immersive Header ─── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl + 4,
            backgroundColor: theme.colors.headerBg,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View testID="home-wordmark" style={{ flex: 1 }}>
            <BrandMark compact />
          </View>
          <HeaderIcons />
        </View>

        {/* Greeting */}
        <FadeInView delay={100} direction="up" duration={450}>
          <Text
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: theme.fontSize["4xl"],
              color: theme.colors.headerText,
              marginTop: theme.spacing.xl,
              lineHeight: theme.fontSize["4xl"] + 6,
            }}
          >
            {getGreeting()}
          </Text>
        </FadeInView>

        {/* Accent line */}
        <View
          style={{
            width: 40,
            height: 2.5,
            backgroundColor: theme.colors.primary,
            marginTop: theme.spacing.md,
            borderRadius: 2,
          }}
        />

        <FadeInView delay={200} direction="fade" duration={400}>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSize.base,
              color: theme.colors.muted,
              marginTop: theme.spacing.sm,
              lineHeight: 22,
            }}
          >
            Today&apos;s rates & your savings at{" "}
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary }}>
              {businessName}
            </Text>
          </Text>
        </FadeInView>
      </View>

      {/* ─── Content ─── */}
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
        {/* Live rates */}
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

        {/* Savings summary */}
        <SavingsSummaryPanel
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          signedIn={!!token}
          onRetry={loadSummary}
        />

        {/* Primary CTAs */}
        <FadeInView delay={250} direction="up">
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <AnimatedPressable
              testID="home-start-sip"
              onPress={() => router.push("/sip")}
              style={[
                styles.primaryCta,
                {
                  flex: 1,
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                  ...Platform.select({
                    ios: {
                      shadowColor: theme.colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                    },
                    android: { elevation: 4 },
                  }),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start SIP"
              pressScale={0.96}
            >
              <Feather name="trending-up" size={17} color={theme.colors.onPrimary} />
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.onPrimary,
                  fontSize: theme.fontSize.base,
                }}
              >
                Start SIP
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              testID="home-onetime-buy"
              onPress={() => handleOneTimeBuy(metal)}
              style={[
                styles.primaryCta,
                {
                  flex: 1,
                  borderColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1.5,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="One-time metal purchase"
              pressScale={0.96}
            >
              <Feather name="shopping-bag" size={17} color={theme.colors.primary} />
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.primary,
                  fontSize: theme.fontSize.base,
                }}
              >
                One-time buy
              </Text>
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* SIP Reminder */}
        {dueReminder && !reminderDismissed ? (
          <FadeInView direction="up" delay={300}>
            <AnimatedPressable
              testID="sip-reminder-card"
              onPress={() => router.push("/sip")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: theme.spacing.md + 2,
                borderRadius: theme.radius.lg,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
                ...Platform.select({
                  ios: {
                    shadowColor: theme.colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                  },
                  android: { elevation: 2 },
                }),
              }}
              accessibilityRole="button"
              accessibilityLabel="Pay due SIP installment"
              pressScale={0.98}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: `${theme.colors.primary}14`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="bell" size={17} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.text,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Installment due
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    color: theme.colors.muted,
                    fontSize: theme.fontSize.sm,
                    marginTop: 2,
                  }}
                >
                  {dueReminder.plan_name} · {formatMoney(dueReminder.amount)} — tap to pay
                </Text>
              </View>
              <Pressable
                testID="sip-reminder-dismiss"
                onPress={() => setReminderDismissed(true)}
                hitSlop={10}
                style={{ padding: 6 }}
              >
                <Feather name="x" size={18} color={theme.colors.muted} />
              </Pressable>
            </AnimatedPressable>
          </FadeInView>
        ) : null}

        {/* ─── SIP Plans — Horizontal Carousel ─── */}
        {showSip ? (
          <FadeInView delay={350} direction="up">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: theme.fontSize["2xl"],
                  color: theme.colors.text,
                }}
              >
                Metal SIP plans
              </Text>
              <AnimatedPressable
                testID="home-view-all-plans"
                onPress={() => router.push("/sip")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                accessibilityRole="button"
                accessibilityLabel="View all SIP plans"
                haptic={false}
                pressScale={0.95}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.primary,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  View all
                </Text>
                <Feather name="arrow-right" size={14} color={theme.colors.primary} />
              </AnimatedPressable>
            </View>

            <View style={{ marginTop: theme.spacing.md }}>
              <MetalFilterToggle value={metal} onChange={setMetal} />
            </View>
          </FadeInView>
        ) : null}
      </View>

      {/* SIP plan cards — horizontal snap scroll (outside padding container) */}
      {showSip ? (
        <View style={{ marginTop: theme.spacing.md }}>
          {filteredPlans.length === 0 ? (
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.muted,
                  fontSize: 14,
                }}
              >
                No {metalTitle.toLowerCase()} plans available yet.
              </Text>
            </View>
          ) : filteredPlans.length === 1 ? (
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              <SipPlanCard
                plan={filteredPlans[0]}
                onEnrol={handleEnrol}
                testID={`sip-plan-preview-${filteredPlans[0].id}`}
                compact
              />
            </View>
          ) : (
            <FlatList
              testID="home-sip-carousel"
              horizontal
              data={filteredPlans}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={sipPlanCardWidth + theme.spacing.md}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.lg,
                gap: theme.spacing.md,
              }}
              renderItem={({ item }) => (
                <View style={{ width: sipPlanCardWidth }}>
                  <SipPlanCard
                    plan={item}
                    onEnrol={handleEnrol}
                    testID={`sip-plan-preview-${item.id}`}
                    compact
                  />
                </View>
              )}
            />
          )}
        </View>
      ) : null}

      {/* ─── Quick Browse Strip ─── */}
      {categories.length > 0 ? (
        <FadeInView delay={400} direction="up" style={{ marginTop: theme.spacing.xl }}>
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: theme.fontSize["2xl"],
                  color: theme.colors.text,
                }}
              >
                Browse jewellery
              </Text>
              <AnimatedPressable
                testID="home-shop-collections"
                onPress={() => router.push("/collections")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Shop jewellery collections"
                haptic={false}
                pressScale={0.95}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.primary,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  Shop all
                </Text>
                <Feather name="arrow-right" size={14} color={theme.colors.primary} />
              </AnimatedPressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              gap: theme.spacing.sm + 2,
              marginTop: theme.spacing.md,
            }}
          >
            {categories.slice(0, 8).map((c) => (
              <AnimatedPressable
                key={c.id}
                testID={`home-browse-${c.slug}`}
                onPress={() => router.push(`/category/${c.slug}`)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                }}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                haptic={false}
                pressScale={0.95}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.text,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {c.name}
                </Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </FadeInView>
      ) : (
        <FadeInView delay={400} direction="up" style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg }}>
          <AnimatedPressable
            testID="home-shop-collections"
            onPress={() => router.push("/collections")}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
            accessibilityRole="button"
            accessibilityLabel="Shop jewellery collections"
            haptic={false}
            pressScale={0.95}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
                fontSize: theme.fontSize.base,
              }}
            >
              Browse jewellery
            </Text>
            <Feather name="arrow-right" size={15} color={theme.colors.primary} />
          </AnimatedPressable>
        </FadeInView>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: {},
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
  },
})
