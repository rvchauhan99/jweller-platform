import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import Feather from "@expo/vector-icons/Feather"

import { SavingsSummary } from "@/src/api/client"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"

interface SavingsSummaryPanelProps {
  summary: SavingsSummary | null
  loading?: boolean
  signedIn: boolean
}

function StatBlock({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  const { theme } = useStore()
  const color =
    tone === "up" ? theme.colors.primary : tone === "down" ? theme.colors.muted : theme.colors.text
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color, fontSize: theme.fontSize.lg, marginTop: 4 }}>{value}</Text>
    </View>
  )
}

export function SavingsSummaryPanel({ summary, loading, signedIn }: SavingsSummaryPanelProps) {
  const { theme } = useStore()
  const router = useRouter()

  if (!signedIn) {
    return (
      <Pressable
        testID="savings-sign-in-nudge"
        onPress={() => router.push("/login?next=/")}
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
        accessibilityRole="button"
        accessibilityLabel="Sign in to see metal savings"
      >
        <Feather name="pie-chart" size={18} color={theme.colors.primary} />
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base }}>
            Sign in to see your metal savings
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: 2 }}>
            Track total saved, current value, and gain from SIP and one-time buys.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.colors.muted} />
      </Pressable>
    )
  }

  if (loading || !summary) {
    return (
      <View
        testID="savings-summary-loading"
        style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
      >
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>
          Loading your savings…
        </Text>
      </View>
    )
  }

  const hasHoldings = summary.total_invested > 0 || summary.gold_grams > 0 || summary.silver_grams > 0
  if (!hasHoldings) {
    return (
      <View
        testID="savings-summary-empty"
        style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
      >
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
          YOUR METAL SAVINGS
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm }}>
          Start a SIP or make a one-time buy to track savings here.
        </Text>
      </View>
    )
  }

  const gainTone = summary.gain > 0 ? "up" : summary.gain < 0 ? "down" : "neutral"
  const gainPrefix = summary.gain > 0 ? "+" : ""

  return (
    <View
      testID="savings-summary-panel"
      style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
    >
      <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
        YOUR METAL SAVINGS
      </Text>
      <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing.md }}>
        <StatBlock label="Total saved" value={formatMoney(summary.total_invested)} />
        <StatBlock label="Current value" value={formatMoney(summary.current_value)} />
        <StatBlock label="Gain" value={`${gainPrefix}${formatMoney(summary.gain)}`} tone={gainTone} />
      </View>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm }}>
        Gold {summary.gold_grams.toFixed(3)} g · Silver {summary.silver_grams.toFixed(3)} g
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center" },
  panel: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
})
