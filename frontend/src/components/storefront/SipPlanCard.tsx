import React from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"

import { SipPlan } from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
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
      <Text
        style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.muted,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          color: theme.colors.text,
          fontSize: theme.fontSize.base,
          marginTop: 3,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function SipPlanCard({ plan, onEnrol, testID, compact }: SipPlanCardProps) {
  const { theme } = useStore()
  const id = testID ?? `sip-plan-${plan.id}`

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
    <View
      testID={id}
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
      {/* Accent top stripe */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 2.5,
          backgroundColor: theme.colors.accent,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            color: theme.colors.text,
            fontSize: theme.fontSize.lg,
          }}
        >
          {plan.name}
        </Text>
        {/* Prominent price badge */}
        <View
          style={{
            backgroundColor: `${theme.colors.primary}14`,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: theme.radius.pill,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.colors.primary,
              fontSize: theme.fontSize.sm,
            }}
          >
            {formatMoney(plan.monthly_amount)}/mo
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.secondary,
          fontSize: theme.fontSize.sm,
          marginTop: 4,
        }}
      >
        {plan.tagline}
      </Text>

      {!compact && plan.benefit_text ? (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            color: theme.colors.muted,
            fontSize: theme.fontSize.base,
            marginTop: theme.spacing.sm,
            lineHeight: 22,
          }}
        >
          {plan.benefit_text}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", marginTop: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Stat label="Tenure" value={`${plan.tenure_months} months`} />
        {plan.bonus_months ? <Stat label="Bonus" value={`+${plan.bonus_months} mo`} /> : null}
      </View>

      <AnimatedPressable
        testID={`sip-enrol-${plan.id}`}
        onPress={() => onEnrol(plan.id)}
        style={[
          styles.enrolBtn,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Enrol in ${plan.name}`}
        pressScale={0.96}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            color: theme.colors.onPrimary,
            fontSize: theme.fontSize.base,
          }}
        >
          {compact ? "Enrol" : "Enrol & pay first"}
        </Text>
        <Feather name="arrow-right" size={15} color={theme.colors.onPrimary} />
      </AnimatedPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 20, paddingTop: 22, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, overflow: "hidden" },
  enrolBtn: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
})
