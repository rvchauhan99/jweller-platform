import React from "react"
import { StyleSheet, Text, TextInput, View, ViewStyle } from "react-native"

import { useStore } from "@/src/theme/StoreProvider"

const IN_MOBILE = /^[6-9]\d{9}$/

export function isValidInMobile10(phone: string): boolean {
  return IN_MOBILE.test(phone.trim())
}

export function digitsOnly10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10)
}

interface PhoneInputINProps {
  value: string
  onChangeText: (digits: string) => void
  testID?: string
  style?: ViewStyle
  accessibilityLabel?: string
}

/** Locked +91 prefix; user types 10-digit Indian mobile only. */
export function PhoneInputIN({
  value,
  onChangeText,
  testID,
  style,
  accessibilityLabel = "Mobile number",
}: PhoneInputINProps) {
  const { theme } = useStore()

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          marginTop: 6,
        },
        style,
      ]}
    >
      <View
        style={[styles.prefix, { borderRightColor: theme.colors.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: 16 }}>+91</Text>
      </View>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={(t) => onChangeText(digitsOnly10(t))}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="9876543210"
        placeholderTextColor={theme.colors.muted}
        style={{
          flex: 1,
          height: 50,
          paddingHorizontal: 12,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: 16,
        }}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, overflow: "hidden" },
  prefix: {
    height: 50,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
  },
})
