import React, { useCallback, useEffect, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { Image } from "expo-image"
import { useRouter } from "expo-router"

import { Category, getCategories } from "@/src/api/client"
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
          <Pressable
            key={c.id}
            testID={`shop-category-${c.slug}`}
            onPress={() => router.push(`/category/${c.slug}`)}
            style={{ width: 130 }}
            accessibilityRole="button"
            accessibilityLabel={c.name}
          >
            <Image
              source={{ uri: c.image }}
              style={{ width: 130, height: 160, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface }}
              contentFit="cover"
              transition={300}
            />
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: theme.fontSize.base, marginTop: theme.spacing.sm }}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
