import React from "react"
import { StyleSheet, Text, View } from "react-native"

import { useStore } from "@/src/theme/StoreProvider"

export function HomeAboutFooter() {
  const { theme, businessName, cms } = useStore()

  if (!cms?.about_text) {
    return (
      <View style={[styles.footer, { backgroundColor: theme.colors.footerBg, marginTop: theme.spacing["3xl"] }]}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize.xl, color: theme.colors.footerText }}>
          {businessName}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.footerText, opacity: 0.7, marginTop: theme.spacing.xs }}>
          Handcrafted · Hallmarked · Since 1974
        </Text>
      </View>
    )
  }

  return (
    <>
      <View style={{ marginTop: theme.spacing["3xl"], paddingHorizontal: theme.spacing.lg }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, letterSpacing: 2, color: theme.colors.secondary }}>
          {(cms.about_title ?? "About").toUpperCase()}
        </Text>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.text, marginTop: theme.spacing.sm, lineHeight: 30 }}>
          {businessName}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.muted, marginTop: theme.spacing.md, lineHeight: 24 }}>
          {cms.about_text}
        </Text>
      </View>
      <View style={[styles.footer, { backgroundColor: theme.colors.footerBg, marginTop: theme.spacing["3xl"] }]}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize.xl, color: theme.colors.footerText }}>
          {businessName}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.footerText, opacity: 0.7, marginTop: theme.spacing.xs }}>
          Handcrafted · Hallmarked · Since 1974
        </Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  footer: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" },
})
