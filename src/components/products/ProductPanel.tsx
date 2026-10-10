"use client";

import { RotateCw, X } from "lucide-react";
import { getProduct } from "@/data/products";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { closeInspect } from "@/features/exploration/actions";
import { IconButton, Kbd, useFocusTrap } from "../ui/primitives";
import { ProductDetails } from "./ProductDetails";
import { PRODUCT_META } from "@/data/productMeta";

/**
 * Product panel shown while the camera is focused on a product in 3D.
 * Desktop: a slim panel on the right that leaves the product visible.
 * Mobile: a bottom sheet capped at ~60% of the viewport.
 */
export function ProductPanel() {
  const productId = useExperienceStore((s) => s.selectedProductId);
  const colorId = useExperienceStore((s) => s.selectedColorId);
  const size = useExperienceStore((s) => s.selectedSize);
  const setVariant = useExperienceStore((s) => s.setVariant);
  const configuration = useExperienceStore((s) => s.configuration);
  const setConfigurationPart = useExperienceStore((s) => s.setConfigurationPart);
  const ref = useFocusTrap(!!productId, closeInspect);
  const product = productId ? getProduct(productId) : undefined;
  if (!product) return null;
  const turntable = PRODUCT_META[product.kind].turntable;

  return (
    <aside
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} details`}
      className="mv-scroll fixed inset-x-0 bottom-0 z-30 max-h-[62vh] overflow-y-auto rounded-t-[18px] border-t border-line bg-ink px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[var(--shadow-panel)] anim-rise md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:max-h-none md:w-[380px] md:rounded-[var(--radius-panel)] md:border md:anim-slide-in"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <RotateCw size={13} aria-hidden />
          {turntable ? "Drag or ← → to turn · scroll to zoom" : "Drag to look around · scroll to zoom"}
        </p>
        <IconButton label="Close product" shortcut="Esc" onClick={closeInspect} tooltipSide="left">
          <X size={18} aria-hidden />
        </IconButton>
      </div>
      <ProductDetails
        productId={product.id}
        colorId={colorId}
        size={size}
        onColor={(c) => setVariant(c, size)}
        onSize={(s) => setVariant(colorId, s)}
        configuration={configuration}
        onConfigure={setConfigurationPart}
      />
      <p className="mt-4 hidden items-center gap-1.5 text-[11px] text-faint md:flex">
        <Kbd>Esc</Kbd> returns you to the store
      </p>
    </aside>
  );
}
