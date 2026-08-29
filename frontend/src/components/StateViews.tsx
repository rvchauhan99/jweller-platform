import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { FadeInView } from "@/src/components/FadeInView";
import { useTheme } from "@/src/theme/StoreProvider";

export function LoadingView({ label = "Loading" }: { label?: string }) {
  const theme = useTheme();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.9 + pulse.value * 0.1 }],
  }));

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]} testID="loading-view">
      <Animated.View
        style={[
          styles.loadingRing,
          { borderColor: theme.colors.primary },
          ringStyle,
        ]}
      />
      <Text
        style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.muted,
          marginTop: theme.spacing.lg,
          fontSize: theme.fontSize.sm,
          letterSpacing: 1.5,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

interface MessageProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function MessageView({ icon = "inbox", title, subtitle, actionLabel, onAction, testID }: MessageProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.center, { backgroundColor: theme.colors.background, padding: theme.spacing["2xl"] }]}
      testID={testID}
    >
      <FadeInView direction="fade" duration={500}>
        <View style={styles.iconArea}>
          <View
            style={[
              styles.iconCircleBg,
              { backgroundColor: theme.colors.surface },
            ]}
          />
          <View
            style={[
              styles.iconCircle,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <Feather name={icon} size={28} color={theme.colors.primary} />
          </View>
        </View>
      </FadeInView>
      <FadeInView delay={100} direction="up" duration={400}>
        <Text
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: theme.fontSize["2xl"],
            color: theme.colors.text,
            marginTop: theme.spacing.xl,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      </FadeInView>
      {subtitle ? (
        <FadeInView delay={200} direction="up" duration={400}>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSize.base,
              color: theme.colors.muted,
              marginTop: theme.spacing.sm,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {subtitle}
          </Text>
        </FadeInView>
      ) : null}
      {actionLabel && onAction ? (
        <FadeInView delay={300} direction="up" duration={400}>
          <Pressable
            testID="message-action-button"
            onPress={onAction}
            style={[styles.button, { borderColor: theme.colors.primary, marginTop: theme.spacing.xl }]}
          >
            <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.base }}>
              {actionLabel}
            </Text>
          </Pressable>
        </FadeInView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingRing: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2.5,
  },
  iconArea: { alignItems: "center", justifyContent: "center" },
  iconCircleBg: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 999,
    opacity: 0.5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
