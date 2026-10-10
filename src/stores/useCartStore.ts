"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getProduct } from "@/data/products";
import { configurationDeltaCents, validateConfiguration } from "@/data/configurators";

/**
 * DEMO CART — client-side only.
 * Holds selections from the sample catalogue in localStorage. No payment, stock or
 * order processing exists; "placing an order" only produces a local demo receipt.
 */

export interface CartLine {
  /** Unique per product + variant combination. */
  key: string;
  productId: string;
  colorId: string;
  size?: string;
  /** Configurator choices (part id → option id) for configurable products. */
  options?: Record<string, string>;
  quantity: number;
}

export interface DemoOrder {
  reference: string;
  totalCents: number;
  itemCount: number;
  placedAt: number;
}

export const MAX_LINE_QUANTITY = 9;

interface CartState {
  lines: CartLine[];
  lastOrder: DemoOrder | null;
  /** Increments on every add so the HUD can play a confirmation animation. */
  addedPulse: number;
  add: (productId: string, colorId: string, size?: string, quantity?: number, options?: Record<string, string>) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  placeDemoOrder: () => DemoOrder | null;
  dismissOrder: () => void;
}

export function lineKey(productId: string, colorId: string, size?: string, options?: Record<string, string>) {
  const opts = options
    ? Object.keys(options)
        .sort()
        .map((k) => `${k}=${options[k]}`)
        .join(",")
    : "";
  return [productId, colorId, size ?? "-", opts].join("|");
}

export function unitPriceCents(line: Pick<CartLine, "productId" | "options">): number {
  return (getProduct(line.productId)?.priceCents ?? 0) + configurationDeltaCents(line.productId, line.options);
}

export function linePriceCents(line: CartLine): number {
  return unitPriceCents(line) * line.quantity;
}

export function cartTotals(lines: CartLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.count += line.quantity;
      acc.subtotalCents += linePriceCents(line);
      return acc;
    },
    { count: 0, subtotalCents: 0 },
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      lastOrder: null,
      addedPulse: 0,
      add: (productId, colorId, size, quantity = 1, options) => {
        const product = getProduct(productId);
        if (!product) return false;
        if (!product.colors.some((c) => c.id === colorId)) return false;
        if (size && !product.sizes?.includes(size)) return false;
        const config = validateConfiguration(productId, options);
        if (config === null) return false;
        const opts = Object.keys(config).length ? config : undefined;
        const qty = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
        const key = lineKey(productId, colorId, size, opts);
        set((state) => {
          const existing = state.lines.find((l) => l.key === key);
          const lines = existing
            ? state.lines.map((l) =>
                l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + qty) } : l,
              )
            : [...state.lines, { key, productId, colorId, size, options: opts, quantity: qty }];
          return { lines, addedPulse: state.addedPulse + 1 };
        });
        return true;
      },
      setQuantity: (key, quantity) => {
        const q = Math.floor(quantity);
        if (q <= 0) {
          get().remove(key);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, q) } : l)),
        }));
      },
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      placeDemoOrder: () => {
        const { lines } = get();
        if (!lines.length) return null;
        const totals = cartTotals(lines);
        const order: DemoOrder = {
          reference: `MV-${Date.now().toString(36).toUpperCase().slice(-6)}`,
          totalCents: totals.subtotalCents,
          itemCount: totals.count,
          placedAt: Date.now(),
        };
        set({ lines: [], lastOrder: order });
        return order;
      },
      dismissOrder: () => set({ lastOrder: null }),
    }),
    {
      name: "mallverse-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lines }) => ({ lines }),
      // Drop lines whose product no longer exists in the sample catalogue.
      merge: (persisted, current) => {
        const saved = (persisted as { lines?: CartLine[] } | undefined)?.lines ?? [];
        const lines = saved.filter(
          (l) =>
            l &&
            typeof l.key === "string" &&
            getProduct(l.productId) &&
            l.quantity > 0 &&
            validateConfiguration(l.productId, l.options) !== null,
        );
        return { ...current, lines };
      },
      skipHydration: true,
    },
  ),
);
