import React, { useEffect, useState } from "react";
import { AccessibilityInfo, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  BaseAnimationBuilder,
} from "react-native-reanimated";

type Direction = "up" | "down" | "right" | "fade";

interface FadeInViewProps {
  children: React.ReactNode;
  /** Delay before animation starts (ms). */
  delay?: number;
  /** Duration of the entrance animation (ms). */
  duration?: number;
  /** Entrance direction. */
  direction?: Direction;
  /** Additional styles for the wrapper. */
  style?: ViewStyle;
  testID?: string;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      if (mounted) setReduced(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

function buildEntering(
  direction: Direction,
  duration: number,
  delay: number,
): BaseAnimationBuilder {
  switch (direction) {
    case "down":
      return FadeInDown.duration(duration).delay(delay).springify().damping(18);
    case "right":
      return SlideInRight.duration(duration).delay(delay);
    case "fade":
      return FadeIn.duration(duration).delay(delay);
    case "up":
    default:
      return FadeInUp.duration(duration).delay(delay).springify().damping(18);
  }
}

/**
 * Wraps children in a Reanimated entering animation.
 * Falls back to instant render when reduced motion is enabled.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 500,
  direction = "up",
  style,
  testID,
}: FadeInViewProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <Animated.View style={style} testID={testID}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={buildEntering(direction, duration, delay) as any}
      style={style}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}
