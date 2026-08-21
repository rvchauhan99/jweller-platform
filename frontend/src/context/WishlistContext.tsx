import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { Product } from "@/src/api/client";

export interface WishItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  weight_grams: number;
  purity: string;
}

const WISH_KEY = "wishlist_items_v1";

interface WishlistContextValue {
  items: WishItem[];
  ids: Set<string>;
  count: number;
  has: (productId: string) => boolean;
  toggle: (p: Product) => void;
  remove: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(WISH_KEY, "[]");
      try {
        setItems(JSON.parse(raw || "[]"));
      } catch {
        setItems([]);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) storage.setItem(WISH_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const ids = useMemo(() => new Set(items.map((i) => i.product_id)), [items]);

  const has = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback((p: Product) => {
    setItems((prev) => {
      if (prev.find((i) => i.product_id === p.id)) return prev.filter((i) => i.product_id !== p.id);
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          price: p.live_price ?? p.price,
          image: p.images?.[0],
          weight_grams: p.weight_grams,
          purity: p.purity,
        },
      ];
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const value: WishlistContextValue = { items, ids, count: items.length, has, toggle, remove };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
