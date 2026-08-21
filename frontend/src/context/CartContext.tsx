import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { Product } from "@/src/api/client";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  weight_grams: number;
  purity: string;
  qty: number;
}

const CART_KEY = "cart_items_v1";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (p: Product, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(CART_KEY, "[]");
      try {
        setItems(JSON.parse(raw || "[]"));
      } catch {
        setItems([]);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) storage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((p: Product, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found) return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + qty } : i));
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          price: p.live_price ?? p.price,
          image: p.images?.[0],
          weight_grams: p.weight_grams,
          purity: p.purity,
          qty,
        },
      ];
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, qty } : i))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  const value: CartContextValue = { items, count, subtotal, add, remove, setQty, clear };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
