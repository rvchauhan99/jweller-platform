import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { A } from "@/src/admin/theme";
import { useAdmin } from "@/src/admin/AdminContext";

export default function AdminLogin() {
  const { login } = useAdmin();
  const [tenantCode, setTenantCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await login(tenantCode, username, password);
    if (!res.ok) {
      setError(res.error ?? "Login failed");
      setBusy(false);
    }
  };

  const input = {
    borderWidth: 1,
    borderColor: A.border,
    backgroundColor: A.surface,
    borderRadius: A.radiusSm,
    color: A.text,
    fontFamily: A.font,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    marginTop: 6,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }} testID="admin-login-screen">
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={24}>
        <View style={styles.card}>
          <Text style={{ fontFamily: A.fontMed, fontSize: 22, color: A.text }}>Jeweler Admin</Text>
          <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted, marginTop: 4 }}>
            Sign in with your store code and credentials.
          </Text>

          <Text style={styles.label}>Store code</Text>
          <TextInput testID="admin-tenant-code" value={tenantCode} onChangeText={setTenantCode} autoCapitalize="characters" autoCorrect={false} placeholder="e.g. AURELIA" placeholderTextColor={A.muted} style={input} />
          <Text style={styles.label}>Username</Text>
          <TextInput testID="admin-username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="owner" placeholderTextColor={A.muted} style={input} />
          <Text style={styles.label}>Password</Text>
          <TextInput testID="admin-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={A.muted} style={input} onSubmitEditing={submit} />

          {error ? <Text testID="admin-login-error" style={{ fontFamily: A.font, color: A.danger, fontSize: 13, marginTop: 12 }}>{error}</Text> : null}

          <Pressable
            testID="admin-login-submit"
            disabled={busy || !tenantCode || !username || !password}
            onPress={submit}
            style={[styles.btn, { opacity: busy || !tenantCode || !username || !password ? 0.5 : 1 }]}
          >
            <Text style={{ fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 }}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>

          <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 12, marginTop: 14, textAlign: "center" }}>
            Demo: AURELIA / owner / Aurelia@123
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 400, backgroundColor: A.surface, borderRadius: A.radius, borderWidth: 1, borderColor: A.border, padding: 24 },
  label: { fontFamily: A.fontMed, fontSize: 13, color: A.text, marginTop: 16 },
  btn: { height: 46, borderRadius: A.radiusSm, backgroundColor: A.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
});
