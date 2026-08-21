import React, { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Feather from "@expo/vector-icons/Feather"

import { getRates, metalBuy, metalBuyConfirm, metalBuyDevConfirm, Rates } from "@/src/api/client"
import { useStore } from "@/src/theme/StoreProvider"
import { formatMoney } from "@/src/theme/tokens"
import { useCustomerAuth } from "@/src/context/CustomerAuthContext"
import { RazorpayCheckoutModal, RazorpayCheckoutOptions } from "@/src/payments/RazorpayCheckoutModal"

type Metal = "gold" | "silver"

export default function MetalBuyScreen() {
  const params = useLocalSearchParams<{ metal?: string }>()
  const initial: Metal = params.metal === "silver" ? "silver" : "gold"
  const { code, theme, businessName } = useStore()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token, ready } = useCustomerAuth()

  const [metal, setMetal] = useState<Metal>(initial)
  const [amount, setAmount] = useState("5000")
  const [rates, setRates] = useState<Rates | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpts, setCheckoutOpts] = useState<RazorpayCheckoutOptions | null>(null)
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!token) {
      router.replace("/login?next=/metal/buy")
      return
    }
    getRates(code).then(setRates).catch(() => setRates(null))
  }, [ready, token, router, code])

  const amountNum = useMemo(() => parseFloat(amount || "0") || 0, [amount])
  const rate = rates ? (metal === "silver" ? rates.silver.inr_per_gram : rates.gold.inr_per_gram) : 0
  const grams = rate > 0 ? amountNum / rate : 0
  const valid = amountNum >= 100 && rate > 0

  const submit = async () => {
    if (!token || !valid) return
    setBusy(true)
    setError(null)
    try {
      const res = await metalBuy(code, { metal, amount_inr: amountNum })
      if (res.mock) {
        await metalBuyDevConfirm(code, res.purchase_id)
        setBusy(false)
        router.replace("/(tabs)/sip")
        return
      }
      setPendingPurchaseId(res.purchase_id)
      setCheckoutOpts({
        keyId: res.key_id,
        orderId: res.razorpay_order_id,
        amountPaise: res.amount,
        currency: res.currency || "INR",
        name: businessName || "Metal buy",
        description: `One-time ${metal} purchase`,
        prefill: {},
      })
      setBusy(false)
    } catch (e: any) {
      setError(e?.message ?? "Could not start purchase")
      setBusy(false)
    }
  }

  const handleSuccess = async (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => {
    if (!pendingPurchaseId) return
    try {
      await metalBuyConfirm(code, {
        purchase_id: pendingPurchaseId,
        ...payload,
      })
    } catch {}
    setCheckoutOpts(null)
    setPendingPurchaseId(null)
    router.replace("/(tabs)/sip")
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="metal-buy-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm, borderBottomColor: theme.colors.border }]}>
        <Pressable testID="metal-buy-back" onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={26} color={theme.colors.headerText} />
        </Pressable>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: theme.fontSize["2xl"], color: theme.colors.headerText, marginLeft: 8 }}>
          One-time buy
        </Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing.lg }} bottomOffset={24}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["gold", "silver"] as Metal[]).map((m) => {
            const on = metal === m
            return (
              <Pressable
                key={m}
                testID={`metal-buy-toggle-${m}`}
                onPress={() => setMetal(m)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: theme.radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: on ? theme.colors.primary : theme.colors.border,
                  backgroundColor: on ? theme.colors.primary : theme.colors.surface,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={{ fontFamily: theme.fonts.bodyMedium, color: on ? theme.colors.onPrimary || "#fff" : theme.colors.text }}>
                  {m === "gold" ? "Gold" : "Silver"}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 14, marginTop: theme.spacing.lg }}>
          Live rate {rate > 0 ? `${formatMoney(rate)} / g` : "…"}
        </Text>

        <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.text, marginTop: theme.spacing.lg }}>Amount (₹)</Text>
        <TextInput
          testID="metal-buy-amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="5000"
          placeholderTextColor={theme.colors.muted}
          style={{
            marginTop: 6,
            height: 52,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
            paddingHorizontal: 16,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: 16,
          }}
          accessibilityLabel="Purchase amount in rupees"
        />

        <View style={{ marginTop: theme.spacing.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderRadius: theme.radius.lg }}>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 13 }}>You receive approximately</Text>
          <Text style={{ fontFamily: theme.fonts.heading, color: theme.colors.text, fontSize: 28, marginTop: 4 }}>
            {grams > 0 ? `${grams.toFixed(4)} g` : "—"}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 12, marginTop: 8 }}>
            Credited to your metal wallet after payment. Minimum ₹100.
          </Text>
        </View>

        {error ? (
          <Text testID="metal-buy-error" style={{ fontFamily: theme.fonts.body, color: "#DC2626", marginTop: 12, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="metal-buy-submit"
          disabled={busy || !valid}
          onPress={submit}
          style={{
            height: 52,
            marginTop: theme.spacing.xl,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || !valid ? 0.5 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Pay with Razorpay"
        >
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.onPrimary || "#fff", fontSize: 15 }}>
            {busy ? "Opening…" : `Pay ${formatMoney(amountNum || 0)}`}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <RazorpayCheckoutModal
        visible={!!checkoutOpts}
        options={checkoutOpts}
        onSuccess={handleSuccess}
        onDismiss={(reason) => {
          setCheckoutOpts(null)
          setPendingPurchaseId(null)
          if (reason) setError(reason)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
})
