import React from "react"
import { Pressable, Text, View } from "react-native"

import { useStore } from "@/src/theme/StoreProvider"

export type MetalFilter = "gold" | "silver"

interface MetalFilterToggleProps {
  value: MetalFilter
  onChange: (metal: MetalFilter) => void
}

export function MetalFilterToggle({ value, onChange }: MetalFilterToggleProps) {
  const { theme } = useStore()

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {(["gold", "silver"] as MetalFilter[]).map((m) => {
        const on = value === m
        return (
          <Pressable
            key={m}
            testID={`sip-metal-${m}`}
            onPress={() => onChange(m)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: theme.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: on ? theme.colors.primary : theme.colors.border,
              backgroundColor: on ? theme.colors.primary : theme.colors.surface,
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${m} SIP`}
          >
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: on ? theme.colors.onPrimary || "#fff" : theme.colors.text, fontSize: 14 }}>
              {m === "gold" ? "Gold" : "Silver"}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
