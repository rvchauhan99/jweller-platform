import React from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Feather from "@expo/vector-icons/Feather"
import { SavingsSummary } from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { FadeInView } from "@/src/components/FadeInView"
import { Skeleton } from "@/src/components/Skeleton"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"

interface SavingsSummaryPanelProps {
  summary: SavingsSummary | null
  loading?: boolean
  error?: string | null
  signedIn: boolean
  onRetry?: () => void
}


function StatBlock({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "up" | "down" | "neutral"
}) {
  const { theme } = useStore()
  const color =
    tone === "up" ? theme.colors.primary : tone === "down" ? theme.colors.muted : theme.colors.text
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.muted,
          fontSize: theme.fontSize.sm,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          color,
          fontSize: theme.fontSize.lg,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function MetalPill({ label, color }: { label: string; color: string }) {
  const { theme } = useStore()
  return (
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
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text
        style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export function SavingsSummaryPanel({
  summary,
  loading,
  error,
  signedIn,
  onRetry,
}: SavingsSummaryPanelProps) {
  const { theme } = useStore()
  const router = useRouter()

  const cardShadow = Platform.select({
    ios: {
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    android: { elevation: 3 },
  })

  if (!signedIn) {
    return (
      <FadeInView delay={100} direction="up">
        <AnimatedPressable
          testID="savings-sign-in-nudge"
          onPress={() => router.push("/login?next=/")}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              ...cardShadow,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign in to see metal savings"
          pressScale={0.98}
        >
          <View
            style={[
              styles.nudgeIcon,
              { backgroundColor: `${theme.colors.primary}14`, borderColor: theme.colors.border },
            ]}
          >
            <Feather name="pie-chart" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.text,
                fontSize: theme.fontSize.base,
              }}
            >
              Sign in to see your metal savings
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
                marginTop: 3,
                lineHeight: 18,
              }}
            >
              Track total saved, current value, and gain from SIP and one-time buys.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.muted} />
        </AnimatedPressable>
      </FadeInView>
    )
  }

  if (loading) {
    return (
      <View
        testID="savings-summary-loading"
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...cardShadow,
          },
        ]}
      >
        <Skeleton width="40%" height={12} />
        <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Skeleton width="60%" height={11} />
            <Skeleton width="80%" height={18} style={{ marginTop: 6 } as any} />
          </View>
          <View style={{ flex: 1 }}>
            <Skeleton width="60%" height={11} />
            <Skeleton width="80%" height={18} style={{ marginTop: 6 } as any} />
          </View>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View
        testID="savings-summary-error"
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...cardShadow,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            color: theme.colors.text,
            fontSize: theme.fontSize.base,
          }}
        >
          Could not load savings
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            color: theme.colors.muted,
            fontSize: theme.fontSize.sm,
            marginTop: theme.spacing.xs,
          }}
        >
          {error}
        </Text>
        {onRetry ? (
          <AnimatedPressable
            testID="savings-summary-retry"
            onPress={onRetry}
            style={{ marginTop: theme.spacing.md, alignSelf: "flex-start" }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading savings"
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
                fontSize: theme.fontSize.sm,
              }}
            >
              Retry
            </Text>
          </AnimatedPressable>
        ) : null}
      </View>
    )
  }

  if (!summary) {
    return null
  }

  const hasHoldings =
    summary.total_invested > 0 || summary.gold_grams > 0 || summary.silver_grams > 0
  if (!hasHoldings) {
    return (
      <FadeInView delay={100} direction="up">
        <View
          testID="savings-summary-empty"
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              ...cardShadow,
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
            YOUR METAL SAVINGS
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.muted,
              fontSize: theme.fontSize.sm,
              marginTop: theme.spacing.sm,
              lineHeight: 20,
            }}
          >
            Start a SIP or make a one-time buy to track savings here.
          </Text>
        </View>
      </FadeInView>
    )
  }

  const gainTone = summary.gain > 0 ? "up" : summary.gain < 0 ? "down" : "neutral"
  const gainPrefix = summary.gain > 0 ? "+" : ""
  const gainPercent =
    summary.total_invested > 0
      ? Math.round((summary.gain / summary.total_invested) * 100)
      : 0

  return (
    <FadeInView delay={150} direction="up">
      <View
        testID="savings-summary-panel"
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...cardShadow,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSize.sm,
              letterSpacing: 2.5,
              color: theme.colors.secondary,
            }}
          >
            YOUR METAL SAVINGS
          </Text>
          {gainPercent !== 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor:
                  gainTone === "up"
                    ? `${theme.colors.primary}14`
                    : theme.colors.background,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: theme.radius.pill,
              }}
            >
              <Feather
                name={gainTone === "up" ? "trending-up" : "trending-down"}
                size={12}
                color={gainTone === "up" ? theme.colors.primary : theme.colors.muted}
              />
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: gainTone === "up" ? theme.colors.primary : theme.colors.muted,
                  fontSize: 11,
                }}
              >
                {gainPrefix}{gainPercent}%
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
          <StatBlock label="Total saved" value={formatMoney(summary.total_invested)} />
          <StatBlock label="Current value" value={formatMoney(summary.current_value)} />
          <StatBlock
            label="Gain"
            value={`${gainPrefix}${formatMoney(summary.gain)}`}
            tone={gainTone}
          />
        </View>

        {/* Metal pills */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: theme.spacing.md }}>
          <MetalPill
            label={`Gold ${summary.gold_grams.toFixed(3)} g`}
            color={theme.colors.accent}
          />
          <MetalPill
            label={`Silver ${summary.silver_grams.toFixed(3)} g`}
            color={theme.colors.muted}
          />
        </View>
      </View>
    </FadeInView>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  panel: { padding: 20, borderWidth: StyleSheet.hairlineWidth },
  nudgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
})
