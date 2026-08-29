import React, { useCallback, useEffect, useState } from "react"
import { Text, View, useWindowDimensions } from "react-native"

import { getProducts, Product } from "@/src/api/client"
import { ProductCard } from "@/src/components/ProductCard"
import { ProductCardSkeleton } from "@/src/components/Skeleton"
import { useStore } from "@/src/theme/StoreProvider"

interface FeaturedProductsProps {
  tenantCode: string
}

export function FeaturedProducts({ tenantCode }: FeaturedProductsProps) {
  const { theme } = useStore()
  const { width } = useWindowDimensions()
  const [featured, setFeatured] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const gap = theme.spacing.md
  const cardW = (width - theme.spacing.lg * 2 - gap) / 2

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFeatured(await getProducts(tenantCode, { featured: true }))
    } catch {
      setFeatured([])
    } finally {
      setLoading(false)
    }
  }, [tenantCode])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View style={{ marginTop: theme.spacing["2xl"], paddingHorizontal: theme.spacing.lg }} testID="shop-featured">
      <Text
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: theme.fontSize["2xl"],
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        }}
      >
        Featured Pieces
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: cardW }}>
                <ProductCardSkeleton />
              </View>
            ))
          : featured.map((p) => (
              <View key={p.id} style={{ width: cardW }}>
                <ProductCard product={p} />
              </View>
            ))}
      </View>
    </View>
  )
}
