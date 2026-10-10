"use client";

import { useId, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { getProduct } from "@/data/products";
import { getStore } from "@/data/stores";
import { MAX_LINE_QUANTITY, useCartStore } from "@/stores/useCartStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { audio } from "@/lib/audio";
import { configurationDeltaCents, defaultConfiguration, getConfigurator } from "@/data/configurators";
import { Button, cn, formatPrice } from "../ui/primitives";

interface Props {
  productId: string;
  colorId: string | null;
  size: string | null;
  onColor: (id: string) => void;
  onSize: (size: string) => void;
  /** Heading level context: the panel uses h2, nested catalogue entries use h3. */
  headingLevel?: 2 | 3;
  /** Configurator choices (configurable products); omitted → local defaults. */
  configuration?: Record<string, string> | null;
  onConfigure?: (part: string, option: string) => void;
}

/** Live 3D configurator controls: one picker per part, price deltas and material notes. */
function ConfiguratorControls({ productId, value, onChange }: { productId: string; value: Record<string, string>; onChange: (part: string, option: string) => void }) {
  const configurator = getConfigurator(productId)!;
  return (
    <div className="space-y-4 rounded-[12px] border border-line bg-ink-2 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bronze">Configure in 3D</p>
      {configurator.parts.map((part) => {
        const current = part.options.find((o) => o.id === value[part.id]) ?? part.options[0];
        return (
          <fieldset key={part.id}>
            <legend className="mb-1.5 text-xs font-medium text-muted">
              {part.label}: <span className="text-ivory">{current.label}</span>
            </legend>
            <div role="radiogroup" aria-label={part.label} className="flex flex-wrap gap-1.5">
              {part.options.map((o) =>
                part.kind === "color" ? (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={o.id === current.id}
                    aria-label={`${part.label}: ${o.label}`}
                    onClick={() => onChange(part.id, o.id)}
                    className={cn("relative h-8 w-8 rounded-full border-2 transition-transform", o.id === current.id ? "border-bronze" : "border-line-strong hover:scale-105")}
                  >
                    <span className="absolute inset-[3px] rounded-full" style={{ background: o.hex }} aria-hidden />
                  </button>
                ) : (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={o.id === current.id}
                    onClick={() => onChange(part.id, o.id)}
                    className={cn("h-8 rounded-[8px] border px-2.5 text-xs transition-colors", o.id === current.id ? "border-bronze bg-bronze/15 text-ivory" : "border-line-strong text-muted hover:text-ivory")}
                  >
                    {o.label}
                    {o.priceDeltaCents ? <span className="ml-1 text-bronze">+{formatPrice(o.priceDeltaCents)}</span> : null}
                  </button>
                ),
              )}
            </div>
            {part.kind === "material" && current.note && <p className="mt-1.5 text-xs text-faint">{current.note}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}

/** Product information, variant pickers and add-to-cart. Shared by the 3D panel and the catalogue. */
export function ProductDetails({ productId, colorId, size, onColor, onSize, headingLevel = 2, configuration, onConfigure }: Props) {
  const product = getProduct(productId);
  const add = useCartStore((s) => s.add);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const configurator = getConfigurator(productId);
  const [localConfig, setLocalConfig] = useState<Record<string, string> | null>(() => (configurator ? defaultConfiguration(configurator) : null));
  const colorGroup = useId();
  const sizeGroup = useId();
  const sizeErrorId = useId();
  if (!product) return null;
  const store = getStore(product.storeId);
  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const config = configuration ?? localConfig;
  const configure = (part: string, option: string) => {
    if (onConfigure) onConfigure(part, option);
    else setLocalConfig((c) => (c ? { ...c, [part]: option } : c));
  };
  const unit = product.priceCents + configurationDeltaCents(product.id, config ?? undefined);

  const onAdd = () => {
    if (product.sizes?.length && !size) {
      setSizeError(true);
      return;
    }
    const ok = add(product.id, color.id, size ?? undefined, quantity, config ?? undefined);
    if (!ok) {
      useExperienceStore.getState().showToast("That combination isn't available. Please check the options.");
      return;
    }
    setAdded(true);
    audio.chime();
    useExperienceStore.getState().showToast(`Added ${quantity > 1 ? `${quantity} × ` : ""}${product.name} to your bag`);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">{store?.name}</p>
        <Heading data-autofocus tabIndex={-1} className="mt-1 font-display text-[28px] leading-[1.1] text-ivory focus:outline-none">
          {product.name}
        </Heading>
        <p className="mt-2 text-lg font-medium text-bronze">{formatPrice(unit)}</p>
      </div>
      <p className="text-sm leading-relaxed text-muted">{product.description}</p>

      {configurator && config && <ConfiguratorControls productId={product.id} value={config} onChange={configure} />}

      <fieldset hidden={!!configurator || product.colors.length < 2}>
        <legend id={colorGroup} className="mb-2 text-xs font-medium text-muted">
          Colour: <span className="text-ivory">{color.label}</span>
        </legend>
        <div role="radiogroup" aria-labelledby={colorGroup} className="flex flex-wrap gap-2">
          {product.colors.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === color.id}
              aria-label={c.label}
              onClick={() => onColor(c.id)}
              className={cn(
                "relative h-9 w-9 rounded-full border-2 transition-transform",
                c.id === color.id ? "border-bronze" : "border-line-strong hover:scale-105",
              )}
            >
              <span className="absolute inset-1 rounded-full" style={{ background: c.hex }} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>

      {product.sizes && (
        <fieldset>
          <legend id={sizeGroup} className="mb-2 text-xs font-medium text-muted">
            {product.sizeLabel ? product.sizeLabel : product.kind === "sneaker" ? "Size" : product.kind === "coffee-bag" ? "Grind" : product.kind === "perfume" ? "Volume" : product.kind === "watch" ? "Case" : product.kind === "phone" || product.kind === "laptop" || product.kind === "tablet" ? "Storage" : "Size"}
          </legend>
          <div role="radiogroup" aria-labelledby={sizeGroup} aria-describedby={sizeError ? sizeErrorId : undefined} className="flex flex-wrap gap-1.5">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === size}
                onClick={() => {
                  onSize(s);
                  setSizeError(false);
                }}
                className={cn(
                  "h-9 min-w-12 rounded-[8px] border px-3 text-sm transition-colors",
                  s === size ? "border-bronze bg-bronze/15 text-ivory" : "border-line-strong text-muted hover:text-ivory",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {sizeError && (
            <p id={sizeErrorId} role="alert" className="mt-2 text-xs text-danger">
              Choose an option above to add this to your bag.
            </p>
          )}
        </fieldset>
      )}

      <ul className="space-y-1.5 text-sm text-muted">
        {product.details.map((d) => (
          <li key={d} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-bronze" aria-hidden />
            {d}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <div className="flex h-11 items-center rounded-[10px] border border-line-strong" role="group" aria-label="Quantity">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid h-full w-10 place-items-center text-ivory disabled:opacity-35"
          >
            <Minus size={15} aria-hidden />
          </button>
          <output aria-live="polite" className="w-6 text-center text-sm tabular-nums text-ivory">
            {quantity}
          </output>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= MAX_LINE_QUANTITY}
            onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
            className="grid h-full w-10 place-items-center text-ivory disabled:opacity-35"
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>
        <Button variant="primary" className="h-11 flex-1" onClick={onAdd}>
          {added ? <Check size={17} aria-hidden /> : <ShoppingBag size={17} aria-hidden />}
          {added ? "Added to bag" : `Add to bag · ${formatPrice(unit * quantity)}`}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-faint">Sample product in a demo store. No payment is taken and nothing ships.</p>
    </div>
  );
}
