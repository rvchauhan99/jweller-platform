import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { A } from "@/src/admin/theme";
import { AdminProvider, useAdmin } from "@/src/admin/AdminContext";

function Guard({ children }: { children: React.ReactNode }) {
  const { ready, token } = useAdmin();
  const segments = useSegments();
  const router = useRouter();
  const leaf = segments[segments.length - 1];
  const onLogin = leaf === "login";
  const onForgot = leaf === "forgot-password";
  const publicAuth = onLogin || onForgot;

  useEffect(() => {
    if (!ready) return;
    if (!token && !publicAuth) router.replace("/admin/login");
    if (token && onLogin) router.replace("/admin");
  }, [ready, token, publicAuth, onLogin, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: A.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={A.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <Guard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: A.bg } }} />
      </Guard>
    </AdminProvider>
  );
}
