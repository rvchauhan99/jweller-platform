import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { A } from "@/src/admin/theme";
import { useAdmin } from "@/src/admin/AdminContext";

const NAV: { label: string; path: string; icon: keyof typeof Feather.glyphMap }[] = [
  { label: "Dashboard", path: "/admin", icon: "home" },
  { label: "Inventory", path: "/admin/inventory", icon: "box" },
  { label: "Orders", path: "/admin/orders", icon: "shopping-bag" },
  { label: "Customers", path: "/admin/customers", icon: "users" },
  { label: "Gold SIP", path: "/admin/sip", icon: "trending-up" },
  { label: "Staff", path: "/admin/staff", icon: "user-check" },
  { label: "Branding", path: "/admin/branding", icon: "droplet" },
  { label: "Settings", path: "/admin/settings", icon: "settings" },
];

const isNavActive = (pathname: string, path: string) => {
  if (path === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (path === "/admin/customers") {
    return pathname === "/admin/customers" || pathname.startsWith("/admin/customer/");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
};

export function AdminShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { admin, logout } = useAdmin();
  const wide = width >= 900;

  const NavItem = ({ item, horizontal }: { item: (typeof NAV)[number]; horizontal?: boolean }) => {
    const active = isNavActive(pathname, item.path);
    return (
      <Pressable
        testID={`admin-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
        onPress={() => router.replace(item.path as any)}
        style={[
          horizontal ? styles.navPill : styles.navRow,
          active ? { backgroundColor: horizontal ? A.primary : A.accentSoft } : null,
        ]}
      >
        <Feather name={item.icon} size={16} color={active ? (horizontal ? A.onPrimary : A.accent) : A.muted} />
        <Text
          style={{
            fontFamily: active ? A.fontMed : A.font,
            fontSize: 13,
            color: active ? (horizontal ? A.onPrimary : A.accent) : A.text,
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: A.bg, flexDirection: wide ? "row" : "column" }}>
      {wide ? (
        <View style={[styles.sidebar, { paddingTop: insets.top + 16 }]}>
          <Text style={{ fontFamily: A.fontMed, fontSize: 15, color: A.text }} numberOfLines={1}>
            {admin?.business_name}
          </Text>
          <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted, marginTop: 2 }}>
            Admin · {admin?.tenant_code}
          </Text>
          <View style={{ height: 20 }} />
          {NAV.map((n) => (
            <NavItem key={n.path} item={n} />
          ))}
          <View style={{ flex: 1 }} />
          <Pressable testID="admin-logout" onPress={logout} style={styles.navRow}>
            <Feather name="log-out" size={16} color={A.danger} />
            <Text style={{ fontFamily: A.font, fontSize: 13, color: A.danger }}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontFamily: A.fontMed, fontSize: 15, color: A.text, flex: 1 }} numberOfLines={1}>
              {admin?.business_name}
            </Text>
            <Pressable testID="admin-logout" onPress={logout} hitSlop={8}>
              <Feather name="log-out" size={18} color={A.danger} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
            {NAV.map((n) => (
              <NavItem key={n.path} item={n} horizontal />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: wide ? insets.top + 20 : 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: A.fontMed, fontSize: 20, color: A.text }}>{title}</Text>
            {subtitle ? <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginTop: 2 }}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48, maxWidth: 1100, width: "100%", alignSelf: "center" }}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, testID, tone = "primary" }: { label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; testID?: string; tone?: "primary" | "accent" | "danger" }) {
  const bg = tone === "accent" ? A.accent : tone === "danger" ? A.danger : A.primary;
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.btn, { backgroundColor: bg }]}>
      {icon ? <Feather name={icon} size={15} color={A.onPrimary} /> : null}
      <Text style={{ fontFamily: A.fontMed, fontSize: 13, color: A.onPrimary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 220, backgroundColor: A.surface, borderRightWidth: 1, borderRightColor: A.border, paddingHorizontal: 14, paddingBottom: 16 },
  topbar: { backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border, paddingHorizontal: 16 },
  navRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: A.radiusSm, marginBottom: 2 },
  navPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: A.surfaceAlt },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: A.border, backgroundColor: A.surface, gap: 12 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 40, borderRadius: A.radiusSm, justifyContent: "center" },
});
