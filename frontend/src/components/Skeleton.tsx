import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { useTheme } from "@/src/theme/StoreProvider";

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, radius = 4, style }: Props) {
  const theme = useTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius: radius,
          backgroundColor: theme.colors.border,
        },
        animatedStyle,
        style as any,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Skeleton
        height={undefined as any}
        style={{ aspectRatio: 4 / 5, borderRadius: theme.radius.lg } as any}
      />
      <View style={{ height: theme.spacing.sm }} />
      <Skeleton width="80%" height={13} />
      <View style={{ height: 6 }} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

export const styles = StyleSheet.create({});
