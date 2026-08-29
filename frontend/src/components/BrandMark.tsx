import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { FadeInView } from "@/src/components/FadeInView";
import { useStore } from "@/src/theme/StoreProvider";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Renders the tenant's brand identity: a real logo image when the tenant
// provides one, otherwise a refined serif monogram + wordmark. Baked per
// white-label build so each jeweler's app looks fully their own.
export function BrandMark({
  onDark = false,
  compact = false,
}: {
  onDark?: boolean;
  compact?: boolean;
}) {
  const { theme, businessName, logoUrl } = useStore();
  const fg = onDark ? "#FFFFFF" : theme.colors.headerText;
  const border = onDark ? "rgba(255,255,255,0.55)" : theme.colors.border;
  const mono = compact ? 32 : 42;

  if (logoUrl) {
    return (
      <FadeInView direction="fade" duration={400}>
        <Image
          testID="brand-logo"
          source={{ uri: logoUrl }}
          style={{ height: compact ? 28 : 40, width: compact ? 120 : 160 }}
          contentFit="contain"
          accessibilityLabel={businessName}
        />
      </FadeInView>
    );
  }

  return (
    <FadeInView direction="fade" duration={400}>
      <View style={styles.row} testID="brand-mark">
        <View
          style={[
            styles.mono,
            {
              width: mono,
              height: mono,
              borderColor: border,
              ...Platform.select({
                ios: {
                  shadowColor: onDark ? "#000" : theme.colors.text,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                },
                android: { elevation: 2 },
              }),
            },
          ]}
        >
          <Text
            style={{
              fontFamily: theme.fonts.headingBold,
              color: fg,
              fontSize: compact ? 14 : 18,
            }}
          >
            {initials(businessName)}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.fonts.body,
            color: fg,
            fontSize: compact ? theme.fontSize.sm : theme.fontSize.base,
            letterSpacing: 2.5,
            marginLeft: theme.spacing.sm + 2,
            maxWidth: 210,
          }}
        >
          {(businessName || "").toUpperCase()}
        </Text>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  mono: {
    borderRadius: 999,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
});
