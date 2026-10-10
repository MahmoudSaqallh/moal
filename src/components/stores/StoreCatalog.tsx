"use client";

import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { getStore } from "@/data/stores";
import { getStoreProducts } from "@/data/products";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { IconButton, formatPrice, useFocusTrap } from "../ui/primitives";
import { ProductDetails } from "../products/ProductDetails";

/**
 * Accessible, non-3D catalogue for a store: the full shopping experience without having
 * to navigate the 3D space (keyboard, screen reader and low-power friendly).
 */
export function StoreCatalog() {
  const storeId = useExperienceStore((s) => s.browseStoreId);
  const close = () => useExperienceStore.getState().browseStore(null);
  const ref = useFocusTrap(!!storeId, close);
  const [productId, setProductId] = useState<string | null>(null);
  const [variant, setVariant] = useState<{ color: string | null; size: string | null }>({ color: null, size: null });
  const store = storeId ? getStore(storeId) : undefined;
  if (!store) return null;
  const products = getStoreProducts(store.id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 anim-fade" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        className="mv-scroll h-full w-full max-w-md overflow-y-auto border-l border-line bg-ink p-5 shadow-[var(--shadow-panel)] anim-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          {productId ? (
            <button
              type="button"
              onClick={() => setProductId(null)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] px-2 text-sm text-muted hover:bg-ink-2 hover:text-ivory"
            >
              <ArrowLeft size={16} aria-hidden /> All products
            </button>
          ) : (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">{store.categoryLabel}</p>
              <h2 id="catalog-title" className="font-display text-3xl text-ivory">
                {store.name}
              </h2>
            </div>
          )}
          <IconButton label="Close catalogue" shortcut="Esc" onClick={close} tooltipSide="left">
            <X size={18} aria-hidden />
          </IconButton>
        </div>
        {productId ? (
          <ProductDetails
            key={productId}
            productId={productId}
            colorId={variant.color}
            size={variant.size}
            onColor={(c) => setVariant((v) => ({ ...v, color: c }))}
            onSize={(s) => setVariant((v) => ({ ...v, size: s }))}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{store.description}</p>
            <ul className="divide-y divide-line border-y border-line">
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProductId(p.id);
                      setVariant({ color: p.colors[0].id, size: null });
                    }}
                    className="flex w-full items-center gap-4 px-1 py-3.5 text-left hover:bg-ink-2"
                  >
                    <span className="flex -space-x-1.5" aria-hidden>
                      {p.colors.slice(0, 3).map((c) => (
                        <span key={c.id} className="h-5 w-5 rounded-full border border-ink" style={{ background: c.hex }} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ivory">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{p.details[0]}</span>
                    </span>
                    <span className="text-sm text-bronze">{formatPrice(p.priceCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
