import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { BrandMark } from "@/src/components/BrandMark"
import { FadeInView } from "@/src/components/FadeInView"
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
    <View testID="shop-hero" style={{ height: 500 }}>
      <Image
        source={{ uri: heroImage }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={500}
      />
      {/* Three-stop gradient for readability */}
      <LinearGradient
        colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.02)", "rgba(0,0,0,0.7)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          styles.heroContent,
          { paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View testID="shop-wordmark" style={{ flex: 1 }}>
            <BrandMark onDark compact />
          </View>
          <HeaderIcons tint="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }} />

        {/* Animated text entrance */}
        <FadeInView direction="up" duration={550} delay={200}>
          <Text
            style={{
              fontFamily: theme.fonts.headingBold,
              fontSize: theme.fontSize["4xl"],
              color: "#FFFFFF",
              lineHeight: theme.fontSize["4xl"] + 6,
            }}
          >
            {cms?.hero_title ?? businessName}
          </Text>
        </FadeInView>

        {cms?.hero_subtitle ? (
          <FadeInView direction="fade" duration={450} delay={350}>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSize.lg,
                color: "#FFFFFF",
                opacity: 0.92,
                marginTop: theme.spacing.sm,
                lineHeight: 24,
              }}
            >
              {cms.hero_subtitle}
            </Text>
          </FadeInView>
        ) : null}

        <FadeInView direction="up" duration={400} delay={450}>
          <AnimatedPressable
            testID="shop-hero-explore-button"
            onPress={handleExplore}
            style={[
              styles.heroButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.pill,
                marginTop: theme.spacing.xl,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explore collections"
            pressScale={0.96}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.onPrimary,
                fontSize: theme.fontSize.base,
              }}
            >
              Explore Collections
            </Text>
            <Feather name="arrow-right" size={16} color={theme.colors.onPrimary} />
          </AnimatedPressable>
        </FadeInView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heroContent: { flex: 1, paddingBottom: 32 },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
})
