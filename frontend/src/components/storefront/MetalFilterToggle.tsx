import React from "react"
import { Platform, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import * as Haptics from "expo-haptics"

import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { useStore } from "@/src/theme/StoreProvider"

export type MetalFilter = "gold" | "silver"

interface MetalFilterToggleProps {
  value: MetalFilter
  onChange: (metal: MetalFilter) => void
}

export function MetalFilterToggle({ value, onChange }: MetalFilterToggleProps) {
  const { theme } = useStore()
  const metals: MetalFilter[] = ["gold", "silver"]

  const handleChange = (m: MetalFilter) => {
    if (m === value) return
    onChange(m)
    if (Platform.OS !== "web") {
      Haptics.selectionAsync()
    }
  }

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        backgroundColor: theme.colors.background,
        padding: 4,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {metals.map((m) => {
        const on = value === m
        return (
          <AnimatedPressable
            key={m}
            testID={`sip-metal-${m}`}
            onPress={() => handleChange(m)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: theme.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? theme.colors.primary : "transparent",
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${m} SIP`}
            haptic={false}
            pressScale={0.96}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: on ? theme.colors.onPrimary || "#fff" : theme.colors.text,
                fontSize: 14,
                letterSpacing: 0.5,
              }}
            >
              {m === "gold" ? "Gold" : "Silver"}
            </Text>
          </AnimatedPressable>
        )
      })}
    </View>
  )
}
