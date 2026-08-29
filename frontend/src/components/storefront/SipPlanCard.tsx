import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"

import { SipPlan } from "@/src/api/client"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"

interface SipPlanCardProps {
  plan: SipPlan
  onEnrol: (planId: string) => void
  testID?: string
  compact?: boolean
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useStore()
  return (
    <View>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.sm }}>{label}</Text>
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.base, marginTop: 2 }}>{value}</Text>
    </View>
  )
}

export function SipPlanCard({ plan, onEnrol, testID, compact }: SipPlanCardProps) {
  const { theme } = useStore()
  const id = testID ?? `sip-plan-${plan.id}`

  return (
    <View
      testID={id}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
    >
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: theme.fontSize.lg }}>{plan.name}</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.secondary, fontSize: theme.fontSize.sm, marginTop: 2 }}>{plan.tagline}</Text>
      {!compact && plan.benefit_text ? (
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: theme.fontSize.base, marginTop: theme.spacing.sm, lineHeight: 22 }}>
          {plan.benefit_text}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: theme.spacing.lg }}>
        <Stat label="From" value={`${formatMoney(plan.monthly_amount)}/mo`} />
        <Stat label="Tenure" value={`${plan.tenure_months} mo`} />
        {plan.bonus_months ? <Stat label="Bonus" value={`+${plan.bonus_months} mo`} /> : null}
      </View>
      <Pressable
        testID={`sip-enrol-${plan.id}`}
        onPress={() => onEnrol(plan.id)}
        style={[styles.enrolBtn, { borderColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
        accessibilityRole="button"
        accessibilityLabel={`Enrol in ${plan.name}`}
      >
        <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.base }}>
          {compact ? "Enrol" : "Enrol & pay first"}
        </Text>
        <Feather name="arrow-right" size={15} color={theme.colors.primary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  enrolBtn: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, marginTop: 16 },
})
