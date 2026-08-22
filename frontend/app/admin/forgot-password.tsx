import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Link, useRouter } from "expo-router";

import { A } from "@/src/admin/theme";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AdminForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [tenantCode, setTenantCode] = useState("AURELIA");
  const [username, setUsername] = useState("owner");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/forgot/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tenant_code: tenantCode.trim(), username: username.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Request failed");
      setHint(data.dev_hint || data.message || "OTP sent if phone is on file.");
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/auth/forgot/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          tenant_code: tenantCode.trim(),
          username: username.trim(),
          code: code.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Confirm failed");
      Alert.alert("Password updated", "Sign in with your new password.");
      router.replace("/admin/login");
    } catch (e: any) {
      setError(e?.message ?? "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }} testID="admin-forgot-screen">
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={24}>
        <View style={styles.card}>
          <Text style={{ fontFamily: A.fontMed, fontSize: 22, color: A.text }}>Forgot password</Text>
          <Text style={{ fontFamily: A.font, fontSize: 13, color: A.muted, marginTop: 4 }}>
            {step === 1 ? "SMS OTP to the phone on your staff account." : "Enter OTP and new password."}
          </Text>

          {step === 1 ? (
            <>
              <Text style={styles.label}>Store code</Text>
              <TextInput value={tenantCode} onChangeText={setTenantCode} autoCapitalize="characters" style={input} />
              <Text style={styles.label}>Username</Text>
              <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" style={input} />
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Pressable onPress={requestOtp} disabled={busy} style={[styles.btn, { opacity: busy ? 0.5 : 1 }]}>
                <Text style={styles.btnText}>{busy ? "Sending…" : "Send OTP"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {hint ? <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 12, marginTop: 12 }}>{hint}</Text> : null}
              <Text style={styles.label}>OTP</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                style={input}
              />
              <Text style={styles.label}>New password</Text>
              <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry style={input} />
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Pressable onPress={confirm} disabled={busy} style={[styles.btn, { opacity: busy ? 0.5 : 1 }]}>
                <Text style={styles.btnText}>{busy ? "Saving…" : "Reset password"}</Text>
              </Pressable>
              <Pressable onPress={() => setStep(1)} style={{ marginTop: 12 }}>
                <Text style={{ fontFamily: A.font, color: A.accent, fontSize: 13 }}>Resend / change account</Text>
              </Pressable>
            </>
          )}

          <Link href="/admin/login" asChild>
            <Pressable style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: A.font, color: A.muted, fontSize: 13, textAlign: "center" }}>Back to sign in</Text>
            </Pressable>
          </Link>
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
  btnText: { fontFamily: A.fontMed, color: A.onPrimary, fontSize: 15 },
  err: { fontFamily: A.font, color: A.danger, fontSize: 13, marginTop: 12 },
});
