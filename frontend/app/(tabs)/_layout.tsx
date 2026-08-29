import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { useTheme } from "@/src/theme/StoreProvider";
import { useSipReminders } from "@/src/context/SipRemindersContext";

function TabIcon({
  name,
  color,
  size,
  focused,
  dotColor,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
  size: number;
  focused: boolean;
  dotColor: string;
}) {
  return (
    <View style={styles.iconWrap}>
      <Feather name={name} size={size} color={color} />
      {focused ? (
        <View style={[styles.activeDot, { backgroundColor: dotColor }]} />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const theme = useTheme();
  const { dueCount } = useSipReminders();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
          ...Platform.select({
            ios: {
              shadowColor: theme.colors.text,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.body,
          fontSize: 11,
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="grid" color={color} size={size} focused={focused} dotColor={theme.colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="sip"
        options={{
          title: "Metal SIP",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="trending-up" color={color} size={size} focused={focused} dotColor={theme.colors.primary} />
          ),
          tabBarBadge: dueCount > 0 ? dueCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            color: theme.colors.onPrimary,
            fontSize: 10,
            fontFamily: theme.fonts.bodyMedium,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="user" color={color} size={size} focused={focused} dotColor={theme.colors.primary} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center" },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});
