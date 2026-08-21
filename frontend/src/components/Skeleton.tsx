import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme/StoreProvider";

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, radius = 4, style }: Props) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.border, opacity },
        style as any,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Skeleton height={undefined as any} style={{ aspectRatio: 4 / 5, borderRadius: theme.radius.lg }} />
      <View style={{ height: theme.spacing.sm }} />
      <Skeleton width="80%" height={13} />
      <View style={{ height: 6 }} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

export const styles = StyleSheet.create({});
