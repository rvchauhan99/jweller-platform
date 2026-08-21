import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

export interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Props {
  visible: boolean;
  options: RazorpayCheckoutOptions | null;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onDismiss: (reason?: string) => void;
}

function buildHtml(opts: RazorpayCheckoutOptions): string {
  const prefill = opts.prefill || {};
  const payload = {
    key: opts.keyId,
    amount: opts.amountPaise,
    currency: opts.currency || "INR",
    name: opts.name || "Store",
    description: opts.description || "Payment",
    order_id: opts.orderId,
    prefill: {
      name: prefill.name || "",
      email: prefill.email || "",
      contact: prefill.contact || "",
    },
    theme: { color: "#0F172A" },
  };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
    .box { max-width: 420px; margin: 40px auto; text-align: center; }
    button { background: #0f172a; color: #fff; border: 0; border-radius: 10px; padding: 14px 20px; font-size: 16px; width: 100%; }
    p { color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Secure payment</h2>
    <p>Razorpay Test Mode — no real money moves.</p>
    <button id="pay" type="button">Open Checkout</button>
  </div>
  <script>
    var opts = ${json};
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    function openCheckout() {
      var rzp = new Razorpay({
        ...opts,
        handler: function (response) {
          post({ type: "success", ...response });
        },
        modal: {
          ondismiss: function () { post({ type: "dismiss" }); }
        }
      });
      rzp.on("payment.failed", function (resp) {
        var err = (resp && resp.error && resp.error.description) || "Payment failed";
        post({ type: "failed", error: err });
      });
      rzp.open();
    }
    document.getElementById("pay").onclick = openCheckout;
    setTimeout(openCheckout, 400);
  </script>
</body>
</html>`;
}

export function RazorpayCheckoutModal({ visible, options, onSuccess, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const html = useMemo(() => (options ? buildHtml(options) : ""), [options]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "success") {
        onSuccess({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        return;
      }
      if (data.type === "failed") {
        onDismiss(data.error || "Payment failed");
        return;
      }
      if (data.type === "dismiss") {
        onDismiss("Payment cancelled");
      }
    } catch {
      onDismiss("Checkout error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onDismiss("Payment cancelled")}>
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Text style={styles.title}>Razorpay</Text>
          <Pressable onPress={() => onDismiss("Payment cancelled")} accessibilityRole="button" accessibilityLabel="Close checkout" hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {options && html ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html, baseUrl: "https://api.razorpay.com" }}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            style={{ flex: 1 }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 17, fontWeight: "600", color: "#0f172a" },
  close: { fontSize: 15, color: "#64748b" },
});
