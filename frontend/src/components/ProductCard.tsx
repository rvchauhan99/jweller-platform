import React, { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";

import { Product } from "@/src/api/client";
import { useTheme } from "@/src/theme/StoreProvider";
import { formatMoney } from "@/src/theme/tokens";
import { Skeleton } from "@/src/components/Skeleton";
import { AnimatedPressable } from "@/src/components/AnimatedPressable";
import { useWishlist } from "@/src/context/WishlistContext";

export function ProductCard({ product }: { product: Product }) {
  const theme = useTheme();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const { has, toggle } = useWishlist();
  const wished = has(product.id);

  const handleWishlistToggle = () => {
    toggle(product);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <AnimatedPressable
      testID={`product-card-${product.id}`}
      onPress={() => router.push(`/product/${product.id}`)}
      style={{ flex: 1 }}
      haptic={false}
      pressScale={0.98}
    >
      <View
        style={[
          styles.imageWrap,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            ...Platform.select({
              ios: {
                shadowColor: theme.colors.text,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
              },
              android: { elevation: 3 },
            }),
          },
        ]}
      >
        {!loaded && (
          <Skeleton
            style={StyleSheet.absoluteFillObject as any}
            radius={theme.radius.lg}
            height={undefined as any}
          />
        )}
        <Image
          source={{ uri: product.images?.[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
          onLoadEnd={() => setLoaded(true)}
          accessibilityLabel={product.name}
        />
        <AnimatedPressable
          testID={`wishlist-toggle-${product.id}`}
          onPress={handleWishlistToggle}
          style={[
            styles.heart,
            {
              backgroundColor: theme.colors.surface,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                },
                android: { elevation: 2 },
              }),
            },
          ]}
          pressScale={0.85}
          haptic={false}
        >
          <Feather
            name="heart"
            size={15}
            color={wished ? theme.colors.primary : theme.colors.muted}
          />
        </AnimatedPressable>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSize.base,
          color: theme.colors.text,
          marginTop: theme.spacing.sm + 2,
        }}
      >
        {product.name}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSize.sm,
          color: theme.colors.muted,
          marginTop: 2,
        }}
      >
        {product.weight_grams}g · {product.purity}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.fontSize.base,
          color: theme.colors.secondary,
          marginTop: 4,
        }}
      >
        {formatMoney(product.live_price ?? product.price, product.currency)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    aspectRatio: 4 / 5,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: "100%", height: "100%" },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
