import React, { useEffect } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated"

import { Rates } from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { FadeInView } from "@/src/components/FadeInView"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"
import { goldPer10g, silverPerKg } from "@/src/utils/rateUnits"

type MetalFilter = "gold" | "silver"

interface LiveRatesPanelProps {
  rates: Rates
  variant?: "full" | "compact"
  metal?: MetalFilter
  testID?: string
  onGoldPress?: () => void
  onSilverPress?: () => void
}

function formatFetchedAt(iso: string): string {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ""
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "Updated just now"
  if (mins === 1) return "Updated 1 min ago"
  if (mins < 60) return `Updated ${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return "Updated 1 hr ago"
  return `Updated ${hrs} hr ago`
}

function locationLabel(rates: Rates): string {
  const parts = [rates.rate_city, rates.rate_state].filter(Boolean)
  return parts.length ? parts.join(", ") : ""
}

/** Pulsing live indicator dot. */
function LiveDot({ color }: { color: string }) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]}
    />
  )
}

export function LiveRatesPanel({
  rates,
  variant = "full",
  metal = "gold",
  testID = "rate-ticker",
  onGoldPress,
  onSilverPress,
}: LiveRatesPanelProps) {
  const { theme } = useStore()
  const location = locationLabel(rates)
  const staleSuffix = rates.stale ? " · DELAYED" : ""
  const updated = formatFetchedAt(rates.fetched_at)

  const cardShadow = Platform.select({
    ios: {
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
  })

  if (variant === "compact") {
    const liveRate = metal === "silver" ? rates.silver : rates.gold
    const metalTitle = metal === "silver" ? "Silver" : "Gold"
    const boardPrice = metal === "silver" ? silverPerKg(liveRate) : goldPer10g(liveRate)
    const unitLabel = metal === "silver" ? "/ kg" : "/ 10 g"
    return (
      <View
        testID={testID}
        style={[
          styles.compact,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...cardShadow,
          },
        ]}
      >
        <LiveDot color={rates.stale ? theme.colors.muted : theme.colors.primary} />
        <Text
          style={{
            fontFamily: theme.fonts.body,
            color: theme.colors.muted,
            fontSize: theme.fontSize.sm,
            marginLeft: 6,
          }}
        >
          Live {metalTitle.toLowerCase()} rate
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            color: theme.colors.secondary,
            fontSize: theme.fontSize.sm,
          }}
        >
          {formatMoney(boardPrice)}
          {unitLabel}
          {rates.stale ? " (delayed)" : ""}
        </Text>
      </View>
    )
  }

  const goldBoard = goldPer10g(rates.gold)
  const silverBoard = silverPerKg(rates.silver)

  return (
    <FadeInView direction="up" duration={500}>
      <View
        testID={testID}
        style={[
          styles.full,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...cardShadow,
          },
        ]}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LiveDot color={rates.stale ? theme.colors.muted : theme.colors.primary} />
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSize.sm,
              letterSpacing: 2.5,
              color: theme.colors.secondary,
            }}
          >
            LIVE RATE{staleSuffix}
          </Text>
          {location ? (
            <>
              <Text style={{ color: theme.colors.muted, fontSize: theme.fontSize.sm }}>·</Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.muted,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {location}
              </Text>
            </>
          ) : null}
        </View>

        {/* Price columns */}
        <View style={{ flexDirection: "row", marginTop: theme.spacing.lg, gap: theme.spacing["2xl"] }}>
          <AnimatedPressable
            testID="rate-gold-cell"
            onPress={onGoldPress}
            disabled={!onGoldPress}
            style={{ flex: 1 }}
            accessibilityRole={onGoldPress ? "button" : undefined}
            accessibilityLabel="Buy gold one-time"
            haptic={false}
            pressScale={onGoldPress ? 0.97 : 1}
          >
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
                letterSpacing: 1,
              }}
            >
              GOLD / 10 g
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.headingBold,
                color: theme.colors.accent,
                fontSize: theme.fontSize["3xl"],
                marginTop: 4,
              }}
            >
              {formatMoney(goldBoard)}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
                marginTop: 2,
              }}
            >
              {formatMoney(rates.gold.inr_per_gram)} / g
            </Text>
          </AnimatedPressable>

          {/* Divider */}
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />

          <AnimatedPressable
            testID="rate-silver-cell"
            onPress={onSilverPress}
            disabled={!onSilverPress}
            style={{ flex: 1 }}
            accessibilityRole={onSilverPress ? "button" : undefined}
            accessibilityLabel="Buy silver one-time"
            haptic={false}
            pressScale={onSilverPress ? 0.97 : 1}
          >
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
                letterSpacing: 1,
              }}
            >
              SILVER / kg
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.headingBold,
                color: theme.colors.text,
                fontSize: theme.fontSize["3xl"],
                marginTop: 4,
              }}
            >
              {formatMoney(silverBoard)}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
                marginTop: 2,
              }}
            >
              {formatMoney(rates.silver.inr_per_gram)} / g
            </Text>
          </AnimatedPressable>
        </View>

        {/* Timestamp */}
        {updated ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: theme.spacing.md,
            }}
          >
            <Feather name="clock" size={11} color={theme.colors.muted} />
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.muted,
                fontSize: theme.fontSize.sm,
              }}
            >
              {updated}
            </Text>
          </View>
        ) : null}
      </View>
    </FadeInView>
  )
}

const styles = StyleSheet.create({
  full: { padding: 20, borderWidth: StyleSheet.hairlineWidth },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
