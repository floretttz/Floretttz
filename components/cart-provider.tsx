"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product, Variant } from "@/lib/types";

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  add: (product: Product, variant?: Variant, personalisation?: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
export const lineKey = (line: Pick<CartLine, "product" | "variant" | "personalisation">) => `${line.product.id}:${line.variant?.id ?? "default"}:${line.personalisation ?? ""}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setLines(JSON.parse(window.localStorage.getItem("floretz-cart") ?? "[]") as CartLine[]); } catch { setLines([]); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem("floretz-cart", JSON.stringify(lines)); }, [lines, ready]);

  const value = useMemo<CartContextValue>(() => ({
    lines, ready,
    add: (product, variant, personalisation) => setLines((current) => {
      const candidate: CartLine = { product, variant, personalisation, quantity: 1 };
      const key = lineKey(candidate); const existing = current.find((line) => lineKey(line) === key);
      return existing ? current.map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(line.quantity + 1, 20) } : line) : [...current, candidate];
    }),
    updateQuantity: (key, quantity) => setLines((current) => quantity < 1 ? current.filter((line) => lineKey(line) !== key) : current.map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(quantity, 20) } : line)),
    remove: (key) => setLines((current) => current.filter((line) => lineKey(line) !== key)),
    clear: () => setLines([]),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + Number(line.variant?.price ?? line.product.price ?? 0) * line.quantity, 0),
  }), [lines, ready]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
