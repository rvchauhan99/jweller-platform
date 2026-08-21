import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { useStore } from "@/src/theme/StoreProvider";
import { useCustomerAuth } from "@/src/context/CustomerAuthContext";
import { PhoneInputIN, isValidInMobile10 } from "@/src/components/PhoneInputIN";

export default function LoginScreen() {
  const { theme } = useStore();
  const { requestOtp, verifyOtp, customer } = useCustomerAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string }>();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);

  const goNext = () => {
    const next = typeof params.next === "string" ? params.next : "/orders";
    router.replace(next as any);
  };

  useEffect(() => {
    if (customer) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 6,
  };

  const handleSend = async () => {
    setBusy(true);
    setError(null);
    const res = await requestOtp(phone.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Failed");
      return;
    }
    if (res.devOtp) {
      setDevOtp(res.devOtp);
      setDevHint(res.devHint || "This is a testing app. Below is your OTP.");
      setCode(res.devOtp);
    } else {
      setDevOtp(null);
      setDevHint(null);
    }
    setStep("otp");
  };

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    const res = await verifyOtp(phone.trim(), code.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Invalid OTP");
      return;
    }
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="customer-login-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="login-back" onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          Sign in
        </Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing.lg }} bottomOffset={40}>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14, marginBottom: 16 }}>
          Enter your 10-digit mobile. Country code +91 is fixed.
        </Text>

        {step === "phone" ? (
          <>
            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text }}>Mobile number</Text>
            <PhoneInputIN testID="login-phone" value={phone} onChangeText={setPhone} />
            <Pressable
              testID="login-send-otp"
              disabled={busy || !isValidInMobile10(phone)}
              onPress={handleSend}
              style={[styles.btn, { backgroundColor: theme.colors.primary, opacity: busy || !isValidInMobile10(phone) ? 0.5 : 1 }]}
              accessibilityLabel="Send OTP"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.onPrimary || "#fff", fontSize: 15 }}>
                {busy ? "Sending…" : "Send OTP"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {devOtp ? (
              <View
                testID="login-dev-otp-banner"
                style={[styles.devBanner, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
                accessibilityLabel="Testing OTP notice"
              >
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, fontSize: 14 }}>
                  {devHint || "This is a testing app. Below is your OTP."}
                </Text>
                <Text
                  testID="login-dev-otp-value"
                  style={{ fontFamily: theme.fonts.heading, color: theme.colors.primary, fontSize: 32, letterSpacing: 4, marginTop: 10 }}
                >
                  {devOtp}
                </Text>
              </View>
            ) : null}

            <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.text, marginTop: devOtp ? 16 : 0 }}>OTP code</Text>
            <TextInput
              testID="login-otp"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={theme.colors.muted}
              style={inputStyle}
              accessibilityLabel="OTP code"
            />
            <Pressable
              testID="login-verify"
              disabled={busy || code.trim().length < 4}
              onPress={handleVerify}
              style={[styles.btn, { backgroundColor: theme.colors.primary, opacity: busy ? 0.5 : 1 }]}
              accessibilityLabel="Verify OTP"
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.onPrimary || "#fff", fontSize: 15 }}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStep("phone");
                setDevOtp(null);
                setDevHint(null);
                setCode("");
              }}
              style={{ marginTop: 12 }}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 13 }}>Change number</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <Text testID="login-error" style={{ fontFamily: theme.fonts.body, color: "#DC2626", marginTop: 12, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  btn: { height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 20 },
  devBanner: { borderWidth: 1, padding: 16, marginBottom: 4 },
});
