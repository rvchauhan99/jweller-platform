import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { useTheme } from "@/src/theme/StoreProvider";

export function LoadingView({ label = "Loading" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]} testID="loading-view">
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, marginTop: theme.spacing.md }}>
        {label}
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
    <View style={[styles.center, { backgroundColor: theme.colors.background, padding: theme.spacing["2xl"] }]} testID={testID}>
      <View
        style={[
          styles.iconCircle,
          { borderColor: theme.colors.border },
        ]}
      >
        <Feather name={icon} size={26} color={theme.colors.primary} />
      </View>
      <Text
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: theme.fontSize["2xl"],
          color: theme.colors.text,
          marginTop: theme.spacing.lg,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle ? (
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
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          testID="message-action-button"
          onPress={onAction}
          style={[styles.button, { borderColor: theme.colors.primary, marginTop: theme.spacing.xl }]}
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.primary, fontSize: theme.fontSize.base }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
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
