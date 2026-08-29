import React, { useCallback, useEffect, useState } from "react"
import { Platform, ScrollView, Text, View } from "react-native"
import { Image } from "expo-image"
import { useRouter } from "expo-router"

import { Category, getCategories } from "@/src/api/client"
import { AnimatedPressable } from "@/src/components/AnimatedPressable"
import { FadeInView } from "@/src/components/FadeInView"
import { useStore } from "@/src/theme/StoreProvider"

interface CategoryScrollProps {
  tenantCode: string
  title?: string
}

export function CategoryScroll({ tenantCode, title = "Collections" }: CategoryScrollProps) {
  const { theme } = useStore()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getCategories(tenantCode))
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [tenantCode])

  useEffect(() => {
    load()
  }, [load])

  if (!loading && categories.length === 0) return null

  return (
    <FadeInView direction="up" delay={100} duration={400}>
      <View style={{ marginTop: theme.spacing["2xl"] }} testID="shop-categories-scroll">
        <Text
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: theme.fontSize["2xl"],
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.lg,
            marginBottom: theme.spacing.md,
          }}
        >
          {title}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}
        >
          {categories.map((c) => (
            <AnimatedPressable
              key={c.id}
              testID={`shop-category-${c.slug}`}
              onPress={() => router.push(`/category/${c.slug}`)}
              style={{ width: 130 }}
              accessibilityRole="button"
              accessibilityLabel={c.name}
              haptic={false}
              pressScale={0.96}
            >
              <View
                style={{
                  width: 130,
                  height: 165,
                  borderRadius: theme.radius.lg,
                  overflow: "hidden",
                  backgroundColor: theme.colors.surface,
                  ...Platform.select({
                    ios: {
                      shadowColor: theme.colors.text,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 10,
                    },
                    android: { elevation: 3 },
                  }),
                }}
              >
                <Image
                  source={{ uri: c.image }}
                  style={{ width: 130, height: 165, borderRadius: theme.radius.lg }}
                  contentFit="cover"
                  transition={300}
                />
              </View>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.text,
                  fontSize: theme.fontSize.base,
                  marginTop: theme.spacing.sm + 2,
                }}
              >
                {c.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>
    </FadeInView>
  )
}
