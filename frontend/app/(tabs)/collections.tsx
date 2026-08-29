import React, { useCallback, useEffect, useRef, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import { Category, getCategories } from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { FadeInView } from "@/src/components/FadeInView"
import { CatalogHero } from "@/src/components/storefront/CatalogHero"
import { CategoryScroll } from "@/src/components/storefront/CategoryScroll"
import { FeaturedProducts } from "@/src/components/storefront/FeaturedProducts"
import { HomeAboutFooter } from "@/src/components/storefront/HomeAboutFooter"
import { LoadingView } from "@/src/components/StateViews"
import { Skeleton } from "@/src/components/Skeleton"
import { HeaderIcons } from "@/src/components/HeaderIcons"
import { useStore } from "@/src/theme/StoreProvider"

export default function CollectionsScreen() {
  const { code, status, theme, businessName, sections } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchDraft, setSearchDraft] = useState("")

  const hasSection = (t: string) => sections.some((s) => s.type === t)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getCategories(code))
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    if (status === "ready") load()
  }, [status, load])

  const handleSearch = () => {
    const q = searchDraft.trim()
    if (!q) {
      router.push("/search")
      return
    }
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleExplore = () => {
    scrollRef.current?.scrollTo({ y: 400, animated: true })
  }

  if (status === "loading") return <LoadingView />

  const showHero = hasSection("hero")
  const showInlineHeader = !showHero

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="collections-screen">
      {showInlineHeader ? (
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + theme.spacing.sm,
              backgroundColor: theme.colors.headerBg,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSize.sm,
                  letterSpacing: 2,
                  color: theme.colors.secondary,
                }}
              >
                {(businessName || "").toUpperCase()}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: theme.fontSize["3xl"],
                  color: theme.colors.headerText,
                }}
              >
                Shop
              </Text>
            </View>
            <HeaderIcons />
          </View>
          {/* Pill search bar */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
            <View
              style={{
                flex: 1,
                height: 44,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 14,
                ...Platform.select({
                  ios: {
                    shadowColor: theme.colors.text,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                  },
                  android: {},
                }),
              }}
            >
              <Feather name="search" size={16} color={theme.colors.muted} />
              <TextInput
                testID="collections-search"
                value={searchDraft}
                onChangeText={setSearchDraft}
                onSubmitEditing={handleSearch}
                placeholder="Search all pieces…"
                placeholderTextColor={theme.colors.muted}
                returnKeyType="search"
                style={{
                  flex: 1,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  marginLeft: 8,
                  height: 44,
                }}
                accessibilityLabel="Search products"
              />
            </View>
            <AnimatedPressable
              testID="collections-search-go"
              onPress={handleSearch}
              style={{
                height: 44,
                width: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.pill,
              }}
              accessibilityRole="button"
              accessibilityLabel="Open search"
              pressScale={0.92}
            >
              <Feather name="arrow-right" size={18} color={theme.colors.onPrimary || "#fff"} />
            </AnimatedPressable>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {showHero ? <CatalogHero onExplore={handleExplore} /> : null}

        {showHero ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.pill,
                  paddingHorizontal: 14,
                }}
              >
                <Feather name="search" size={16} color={theme.colors.muted} />
                <TextInput
                  testID="collections-search"
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  onSubmitEditing={handleSearch}
                  placeholder="Search all pieces…"
                  placeholderTextColor={theme.colors.muted}
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body,
                    fontSize: 14,
                    marginLeft: 8,
                    height: 44,
                  }}
                  accessibilityLabel="Search products"
                />
              </View>
              <AnimatedPressable
                testID="collections-search-go"
                onPress={handleSearch}
                style={{
                  height: 44,
                  width: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                }}
                accessibilityRole="button"
                accessibilityLabel="Open search"
                pressScale={0.92}
              >
                <Feather name="arrow-right" size={18} color={theme.colors.onPrimary || "#fff"} />
              </AnimatedPressable>
            </View>
          </View>
        ) : null}

        {hasSection("categories") ? <CategoryScroll tenantCode={code} /> : null}

        {hasSection("featured") ? <FeaturedProducts tenantCode={code} /> : null}

        <View style={{ padding: theme.spacing.lg, paddingTop: theme.spacing.xl, gap: theme.spacing.lg }}>
          <Text
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: theme.fontSize["2xl"],
              color: theme.colors.text,
            }}
          >
            Browse by collection
          </Text>
          {loading
            ? [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={180} radius={theme.radius.lg} />
              ))
            : categories.map((c, idx) => (
                <FadeInView key={c.id} delay={idx * 80} direction="up" duration={400}>
                  <AnimatedPressable
                    testID={`collection-card-${c.slug}`}
                    onPress={() => router.push(`/category/${c.slug}`)}
                    style={[
                      styles.card,
                      {
                        borderRadius: theme.radius.lg,
                        ...Platform.select({
                          ios: {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.12,
                            shadowRadius: 14,
                          },
                          android: { elevation: 4 },
                        }),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                    haptic={false}
                    pressScale={0.98}
                  >
                    <Image
                      source={{ uri: c.image }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={300}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.55)"]}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text
                      style={{
                        fontFamily: theme.fonts.headingBold,
                        fontSize: theme.fontSize["2xl"],
                        color: "#FFFFFF",
                      }}
                    >
                      {c.name}
                    </Text>
                  </AnimatedPressable>
                </FadeInView>
              ))}
        </View>

        {hasSection("about") ? <HomeAboutFooter /> : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  card: { height: 190, overflow: "hidden", justifyContent: "flex-end", padding: 20 },
})
