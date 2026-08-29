import React, { useCallback } from "react";
import { Pressable, PressableProps, ViewStyle, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  /** Scale factor on press. Default 0.97 — subtle. */
  pressScale?: number;
  /** Whether to trigger haptic feedback on press. */
  haptic?: boolean;
  /** Style applied to the wrapper. */
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

/**
 * Drop-in Pressable replacement with micro-scale animation and optional
 * haptic feedback. Uses react-native-reanimated for 60 fps on the UI thread.
 * Wraps a Pressable inside an Animated.View to avoid type issues.
 */
export function AnimatedPressable({
  pressScale = 0.97,
  haptic = true,
  style,
  onPressIn,
  onPressOut,
  onPress,
  children,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(pressScale, { damping: 15, stiffness: 200 });
      if (haptic && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPressIn?.(e);
    },
    [pressScale, haptic, onPressIn, scale],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      onPressOut?.(e);
    },
    [onPressOut, scale],
  );

  return (
    <Animated.View style={[animatedStyle, style as any]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
