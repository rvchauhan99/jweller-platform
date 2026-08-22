import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { A } from "@/src/admin/theme";
import { adminFetch, useAdmin } from "@/src/admin/AdminContext";
import { AdminShell } from "@/src/admin/AdminShell";

export default function AdminProfile() {
  const { admin, refreshMe } = useAdmin();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qr_png_data_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refreshMe().catch(() => {});
    }, [refreshMe])
  );

  const input = {
    borderWidth: 1,
    borderColor: A.border,
    backgroundColor: A.surface,
    borderRadius: A.radiusSm,
    color: A.text,
    fontFamily: A.font,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 6,
  } as const;

  const changePassword = async () => {
    setBusy(true);
    try {
      await adminFetch("/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      setPwCurrent("");
      setPwNew("");
      Alert.alert("Password", "Updated.");
    } catch (e: any) {
      Alert.alert("Password", e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const generate2fa = async () => {
    setBusy(true);
    try {
      const data = await adminFetch<{ secret: string; qr_png_data_url: string }>("/admin/auth/2fa/generate", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSetup(data);
    } catch (e: any) {
      Alert.alert("2FA", e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async () => {
    setBusy(true);
    try {
      await adminFetch("/admin/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ totp: totpCode }),
      });
      setSetup(null);
      setTotpCode("");
      await refreshMe();
      Alert.alert("2FA", "Authenticator enabled.");
    } catch (e: any) {
      Alert.alert("2FA", e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    setBusy(true);
    try {
      await adminFetch("/admin/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ totp: disableCode }),
      });
      setDisableCode("");
      await refreshMe();
      Alert.alert("2FA", "Authenticator disabled.");
    } catch (e: any) {
      Alert.alert("2FA", e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Profile" subtitle={admin?.username || "Account security"}>
      <View style={styles.card}>
        <Text style={styles.h}>Change password</Text>
        <Text style={styles.label}>Current</Text>
        <TextInput value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry style={input} />
        <Text style={styles.label}>New</Text>
        <TextInput value={pwNew} onChangeText={setPwNew} secureTextEntry style={input} />
        <Pressable onPress={changePassword} disabled={busy} style={styles.btn}>
          <Text style={styles.btnText}>Update password</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Authenticator (optional)</Text>
        <Text style={{ fontFamily: A.font, fontSize: 12, color: A.muted, marginTop: 4 }}>
          {admin?.phone_masked ? `Phone on file: ${admin.phone_masked}` : "Add phone in Staff for forgot-password SMS."}
        </Text>
        {admin?.two_fa_enabled ? (
          <>
            <Text style={{ fontFamily: A.font, color: A.success, marginTop: 10 }}>2FA is on</Text>
            <Text style={styles.label}>Code to disable</Text>
            <TextInput
              value={disableCode}
              onChangeText={(t) => setDisableCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              style={input}
            />
            <Pressable onPress={disable2fa} disabled={busy || disableCode.length < 6} style={[styles.btn, { backgroundColor: A.danger }]}>
              <Text style={styles.btnText}>Disable</Text>
            </Pressable>
          </>
        ) : !setup ? (
          <Pressable onPress={generate2fa} disabled={busy} style={[styles.btn, { marginTop: 12 }]}>
            <Text style={styles.btnText}>Set up authenticator</Text>
          </Pressable>
        ) : (
          <>
            <Image source={{ uri: setup.qr_png_data_url }} style={{ width: 160, height: 160, marginTop: 12 }} />
            <Text style={{ fontFamily: A.font, fontSize: 11, color: A.muted, marginTop: 8 }}>Secret: {setup.secret}</Text>
            <Text style={styles.label}>Confirm code</Text>
            <TextInput
              value={totpCode}
              onChangeText={(t) => setTotpCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              style={input}
            />
            <Pressable onPress={enable2fa} disabled={busy || totpCode.length < 6} style={styles.btn}>
              <Text style={styles.btnText}>Enable</Text>
            </Pressable>
          </>
        )}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: A.surface,
    borderWidth: 1,
    borderColor: A.border,
    borderRadius: A.radius,
    padding: 16,
    marginBottom: 12,
  },
  h: { fontFamily: A.fontMed, fontSize: 15, color: A.text },
  label: { fontFamily: A.fontMed, fontSize: 12, color: A.text, marginTop: 12 },
  btn: {
    height: 42,
    borderRadius: A.radiusSm,
    backgroundColor: A.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  btnText: { fontFamily: A.fontMed, color: A.onPrimary, fontSize: 14 },
});
