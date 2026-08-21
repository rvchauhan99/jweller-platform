import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { BRAND_FONTS } from "@/src/theme/fonts";
import { StoreProvider, useStore } from "@/src/theme/StoreProvider";
import { CartProvider } from "@/src/context/CartContext";
import { WishlistProvider } from "@/src/context/WishlistContext";
import { SipRemindersProvider } from "@/src/context/SipRemindersContext";
import { CustomerAuthProvider } from "@/src/context/CustomerAuthContext";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  const { theme } = useStore();
  return <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [iconsLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontError] = useFonts(BRAND_FONTS);

  const iconsReady = iconsLoaded || !!iconError;
  const fontsReady = fontsLoaded || !!fontError;
  const ready = iconsReady && fontsReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StoreProvider>
            <CustomerAuthProvider>
              <WishlistProvider>
                <CartProvider>
                  <SipRemindersProvider>
                    <ThemedStatusBar />
                    <Stack screenOptions={{ headerShown: false }} />
                  </SipRemindersProvider>
                </CartProvider>
              </WishlistProvider>
            </CustomerAuthProvider>
          </StoreProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
