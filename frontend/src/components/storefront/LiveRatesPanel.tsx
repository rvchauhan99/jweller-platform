import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"

import { Rates } from "@/src/api/client"
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

  if (variant === "compact") {
    const liveRate = metal === "silver" ? rates.silver : rates.gold
    const metalTitle = metal === "silver" ? "Silver" : "Gold"
    const boardPrice = metal === "silver" ? silverPerKg(liveRate) : goldPer10g(liveRate)
    const unitLabel = metal === "silver" ? "/ kg" : "/ 10 g"
    return (
      <View
        testID={testID}
        style={[styles.compact, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
      >
        <Feather name="trending-up" size={14} color={theme.colors.secondary} />
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginLeft: 6 }}>
          Live {metalTitle.toLowerCase()} rate
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.secondary, fontSize: theme.fontSize.sm }}>
          {formatMoney(boardPrice)}{unitLabel}{rates.stale ? " (delayed)" : ""}
        </Text>
      </View>
    )
  }

  const goldBoard = goldPer10g(rates.gold)
  const silverBoard = silverPerKg(rates.silver)

  return (
    <View
      testID={testID}
      style={[styles.full, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name="trending-up" size={16} color={theme.colors.secondary} />
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
          TODAY&apos;S RATE{staleSuffix}
        </Text>
        {location ? (
          <>
            <Text style={{ color: theme.colors.muted, fontSize: theme.fontSize.sm }}>·</Text>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{location}</Text>
          </>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing["2xl"] }}>
        <Pressable
          testID="rate-gold-cell"
          onPress={onGoldPress}
          disabled={!onGoldPress}
          style={{ flex: 1 }}
          accessibilityRole={onGoldPress ? "button" : undefined}
          accessibilityLabel="Buy gold one-time"
        >
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>Gold / 10 g</Text>
          <Text style={{ fontFamily: theme.fonts.headingBold, color: theme.colors.secondary, fontSize: theme.fontSize["2xl"] }}>
            {formatMoney(goldBoard)}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>
            {formatMoney(rates.gold.inr_per_gram)} / g
          </Text>
        </Pressable>
        <Pressable
          testID="rate-silver-cell"
          onPress={onSilverPress}
          disabled={!onSilverPress}
          style={{ flex: 1 }}
          accessibilityRole={onSilverPress ? "button" : undefined}
          accessibilityLabel="Buy silver one-time"
        >
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>Silver / kg</Text>
          <Text style={{ fontFamily: theme.fonts.headingBold, color: theme.colors.text, fontSize: theme.fontSize["2xl"] }}>
            {formatMoney(silverBoard)}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>
            {formatMoney(rates.silver.inr_per_gram)} / g
          </Text>
        </Pressable>
      </View>

      {updated ? (
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm }}>
          {updated}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  full: { padding: 18, borderWidth: StyleSheet.hairlineWidth },
  compact: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: StyleSheet.hairlineWidth },
})
