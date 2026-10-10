"use client";

import { Minus, Plus, ShoppingBag, Trash2, X, CheckCircle2 } from "lucide-react";
import { getProduct } from "@/data/products";
import { getStore } from "@/data/stores";
import { describeConfiguration, getConfigurator } from "@/data/configurators";
import { MAX_LINE_QUANTITY, cartTotals, linePriceCents, useCartStore } from "@/stores/useCartStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { Button, IconButton, formatPrice, useFocusTrap } from "../ui/primitives";

export function CartDrawer() {
  const open = useExperienceStore((s) => s.panel === "cart");
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, close);
  const lines = useCartStore((s) => s.lines);
  const lastOrder = useCartStore((s) => s.lastOrder);
  const { setQuantity, remove, placeDemoOrder, dismissOrder } = useCartStore.getState();
  if (!open) return null;
  const totals = cartTotals(lines);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/45 anim-fade" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-ink shadow-[var(--shadow-panel)] anim-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="font-display text-3xl text-ivory">
            Your bag
          </h2>
          <IconButton label="Close bag" shortcut="Esc" onClick={close} tooltipSide="left">
            <X size={18} aria-hidden />
          </IconButton>
        </header>

        {lastOrder ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center" role="status">
            <CheckCircle2 size={40} className="text-sage" aria-hidden />
            <div>
              <p className="font-display text-2xl text-ivory">Demo order placed</p>
              <p className="mt-2 text-sm text-muted">
                Reference <span className="font-medium text-ivory">{lastOrder.reference}</span> · {lastOrder.itemCount} item
                {lastOrder.itemCount === 1 ? "" : "s"} · {formatPrice(lastOrder.totalCents)}
              </p>
              <p className="mt-3 text-xs text-faint">This is a demonstration. No payment was taken and nothing will be shipped.</p>
            </div>
            <Button variant="primary" onClick={() => { dismissOrder(); close(); }}>
              Keep exploring
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <ShoppingBag size={34} className="text-faint" aria-hidden />
            <p className="text-ivory">Your bag is empty</p>
            <p className="text-sm text-muted">Step into a store and inspect a product to add it here, or browse a catalogue from the directory.</p>
            <Button
              className="mt-2"
              onClick={() => useExperienceStore.getState().openPanel("directory")}
            >
              Open the directory
            </Button>
          </div>
        ) : (
          <>
            <ul className="mv-scroll flex-1 divide-y divide-line overflow-y-auto px-5" aria-label="Items in your bag">
              {lines.map((line) => {
                const product = getProduct(line.productId)!;
                const color = product.colors.find((c) => c.id === line.colorId);
                // Configured lines show their chosen upper colour instead of the base colourway.
                const configurator = line.options ? getConfigurator(line.productId) : undefined;
                const colorPart = configurator?.parts.find((p) => p.kind === "color");
                const swatch = (colorPart && colorPart.options.find((o) => o.id === line.options?.[colorPart.id])?.hex) ?? color?.hex;
                return (
                  <li key={line.key} className="flex gap-4 py-4">
                    <span className="mt-1 h-12 w-12 shrink-0 rounded-[10px] border border-line" style={{ background: swatch }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ivory">{product.name}</p>
                      <p className="truncate text-xs text-muted">
                        {getStore(product.storeId)?.name}
                        {configurator ? "" : ` · ${color?.label}`}
                        {line.size ? ` · ${line.size}` : ""}
                      </p>
                      {line.options && <p className="truncate text-xs text-bronze/90">Custom: {describeConfiguration(line.productId, line.options)}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex h-9 items-center rounded-[8px] border border-line-strong" role="group" aria-label={`Quantity of ${product.name}`}>
                          <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(line.key, line.quantity - 1)} className="grid h-full w-9 place-items-center text-ivory">
                            <Minus size={14} aria-hidden />
                          </button>
                          <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={line.quantity >= MAX_LINE_QUANTITY}
                            onClick={() => setQuantity(line.key, line.quantity + 1)}
                            className="grid h-full w-9 place-items-center text-ivory disabled:opacity-35"
                          >
                            <Plus size={14} aria-hidden />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.key)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2 text-xs text-muted hover:bg-ink-2 hover:text-ivory"
                          aria-label={`Remove ${product.name} from bag`}
                        >
                          <Trash2 size={14} aria-hidden /> Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-sm tabular-nums text-ivory">{formatPrice(linePriceCents(line))}</p>
                  </li>
                );
              })}
            </ul>
            <footer className="border-t border-line px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  Subtotal · {totals.count} item{totals.count === 1 ? "" : "s"}
                </span>
                <span className="text-xl font-medium tabular-nums text-ivory">{formatPrice(totals.subtotalCents)}</span>
              </div>
              <Button variant="primary" className="mt-4 h-12 w-full" onClick={() => placeDemoOrder()}>
                Place demo order
              </Button>
              <p className="mt-2 text-center text-[11px] text-faint">Demo checkout: no payment details are collected.</p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
