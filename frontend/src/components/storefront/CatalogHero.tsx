import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import { BrandMark } from "@/src/components/BrandMark"
import { HeaderIcons } from "@/src/components/HeaderIcons"
import { useStore } from "@/src/theme/StoreProvider"

interface CatalogHeroProps {
  onExplore?: () => void
}

export function CatalogHero({ onExplore }: CatalogHeroProps) {
  const { theme, businessName, cms } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const heroImage = cms?.hero_image

  const handleExplore = () => {
    if (onExplore) {
      onExplore()
      return
    }
    router.push("/search")
  }

  return (
    <View testID="shop-hero" style={{ height: 480 }}>
      <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.heroContent, { paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.lg }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View testID="shop-wordmark" style={{ flex: 1 }}>
            <BrandMark onDark compact />
          </View>
          <HeaderIcons tint="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }} />
        <Text
          style={{ fontFamily: theme.fonts.headingBold, fontSize: theme.fontSize["4xl"], color: "#FFFFFF", lineHeight: theme.fontSize["4xl"] + 6 }}
        >
          {cms?.hero_title ?? businessName}
        </Text>
        {cms?.hero_subtitle ? (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSize.lg, color: "#FFFFFF", opacity: 0.9, marginTop: theme.spacing.sm }}>
            {cms.hero_subtitle}
          </Text>
        ) : null}
        <Pressable
          testID="shop-hero-explore-button"
          onPress={handleExplore}
          style={[styles.heroButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, marginTop: theme.spacing.xl }]}
          accessibilityRole="button"
          accessibilityLabel="Explore collections"
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary, fontSize: theme.fontSize.base }}>
            Explore Collections
          </Text>
          <Feather name="arrow-right" size={16} color={theme.colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heroContent: { flex: 1, paddingBottom: 28 },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
})
