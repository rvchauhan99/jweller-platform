import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { AnimatedPressable } from "@/src/components/AnimatedPressable";
import { useTheme } from "@/src/theme/StoreProvider";
import { useCart } from "@/src/context/CartContext";

// Cart + wishlist quick-access icons for screen headers / hero overlays.
export function HeaderIcons({ tint }: { tint?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { count } = useCart();
  const color = tint ?? theme.colors.headerText;

  return (
    <View style={styles.row}>
      <AnimatedPressable
        testID="header-wishlist-button"
        onPress={() => router.push("/wishlist")}
        hitSlop={10}
        style={styles.iconBtn}
        pressScale={0.88}
      >
        <Feather name="heart" size={22} color={color} />
      </AnimatedPressable>
      <AnimatedPressable
        testID="header-cart-button"
        onPress={() => router.push("/cart")}
        hitSlop={10}
        style={styles.iconBtn}
        pressScale={0.88}
      >
        <Feather name="shopping-bag" size={22} color={color} />
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: theme.colors.onPrimary, fontSize: 10, fontFamily: theme.fonts.bodyMedium }}>{count}</Text>
          </View>
        ) : null}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn: { padding: 2 },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
