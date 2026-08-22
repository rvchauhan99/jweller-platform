import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Link } from "expo-router";

import { A } from "@/src/admin/theme";
import { useAdmin } from "@/src/admin/AdminContext";

export default function AdminLogin() {
  const { login } = useAdmin();
  const [tenantCode, setTenantCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await login(tenantCode, username, password, needTotp ? totp : undefined);
    if (res.two_fa_required) {
      setNeedTotp(true);
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError(res.error ?? "Login failed");
      setBusy(false);
      return;
    }
    setBusy(false);
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
          <Text style={{ fontFamily: A.fontMed, fontSize: 22, color: A.text }}>
            {needTotp ? "Authenticator" : "Jeweler Admin"}
          </Text>
          <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted, marginTop: 4 }}>
            {needTotp
              ? "Enter the 6-digit code from your authenticator app."
              : "Sign in with your store code and credentials."}
          </Text>

          {!needTotp ? (
            <>
              <Text style={styles.label}>Store code</Text>
              <TextInput
                testID="admin-tenant-code"
                value={tenantCode}
                onChangeText={setTenantCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="e.g. AURELIA"
                placeholderTextColor={A.muted}
                style={input}
              />
              <Text style={styles.label}>Username</Text>
              <TextInput
                testID="admin-username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="owner"
                placeholderTextColor={A.muted}
                style={input}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="admin-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={A.muted}
                style={input}
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Authenticator code</Text>
              <TextInput
                testID="admin-totp"
                value={totp}
                onChangeText={(t) => setTotp(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={A.muted}
                style={input}
                onSubmitEditing={submit}
              />
            </>
          )}

          {error ? (
            <Text testID="admin-login-error" style={{ fontFamily: A.font, color: A.danger, fontSize: 13, marginTop: 12 }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            testID="admin-login-submit"
            disabled={busy || (!needTotp && (!tenantCode || !username || !password)) || (needTotp && totp.length < 6)}
            onPress={submit}
            style={[
              styles.btn,
              {
                opacity:
                  busy || (!needTotp && (!tenantCode || !username || !password)) || (needTotp && totp.length < 6)
                    ? 0.5
                    : 1,
              },
            ]}
          >
            <Text style={{ fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 }}>
              {busy ? "Signing in…" : needTotp ? "Verify" : "Sign in"}
            </Text>
          </Pressable>

          <Link href="/admin/forgot-password" asChild>
            <Pressable style={{ marginTop: 14 }}>
              <Text style={{ fontFamily: A.font, color: A.accent, fontSize: 13, textAlign: "center" }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>

          {needTotp ? (
            <Pressable
              onPress={() => {
                setNeedTotp(false);
                setTotp("");
                setError(null);
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 12, textAlign: "center" }}>Back</Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 12, marginTop: 14, textAlign: "center" }}>
              Demo: AURELIA / owner / Aurelia@123
            </Text>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: A.surface,
    borderRadius: A.radius,
    borderWidth: 1,
    borderColor: A.border,
    padding: 24,
  },
  label: { fontFamily: A.fontMed, fontSize: 13, color: A.text, marginTop: 16 },
  btn: {
    height: 46,
    borderRadius: A.radiusSm,
    backgroundColor: A.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
});
