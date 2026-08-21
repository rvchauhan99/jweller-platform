import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { useTheme } from "@/src/theme/StoreProvider";
import { useSipReminders } from "@/src/context/SipRemindersContext";

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
        },
        tabBarLabelStyle: { fontFamily: theme.fonts.body, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Collections",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sip"
        options={{
          title: "Metal SIP",
          tabBarIcon: ({ color, size }) => <Feather name="trending-up" size={size} color={color} />,
          tabBarBadge: dueCount > 0 ? dueCount : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
