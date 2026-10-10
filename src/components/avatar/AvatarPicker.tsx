"use client";

import { useId, useRef } from "react";
import { Check, RotateCw, X } from "lucide-react";
import type { AvatarAppearance } from "@/types";
import {
  ACCESSORY_OPTIONS,
  AVATAR_PRESETS,
  BODY_OPTIONS,
  CLOTH_COLORS,
  HAIR_COLORS,
  HAIR_OPTIONS,
  SHOE_COLORS,
  SKIN_TONES,
  TOP_OPTIONS,
} from "@/data/avatars";
import { useAvatarStore } from "@/stores/useAvatarStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { confirmAvatar } from "@/features/exploration/actions";
import { avatarPreview } from "@/three/characters/PlayerAvatar";
import { Button, IconButton, cn, useFocusTrap } from "../ui/primitives";

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (c: string) => void }) {
  const id = useId();
  return (
    <fieldset>
      <legend id={id} className="mb-1.5 text-xs font-medium text-muted">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={cn("relative h-8 w-8 rounded-full border-2 transition-transform", value === c ? "border-bronze" : "border-line-strong hover:scale-105")}
          >
            <span className="absolute inset-[3px] rounded-full" style={{ background: c }} aria-hidden />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <fieldset>
      <legend id={id} className="mb-1.5 text-xs font-medium text-muted">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn("h-8 rounded-[8px] border px-3 text-xs transition-colors", value === o.id ? "border-bronze bg-bronze/15 text-ivory" : "border-line-strong text-muted hover:text-ivory")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Character creator. During the entry flow it frames the avatar on the plaza (3D preview
 * on the left, controls on the right); from the HUD it edits the avatar in the mall.
 */
export function AvatarPicker() {
  const phase = useExperienceStore((s) => s.phase);
  const panelOpen = useExperienceStore((s) => s.panel === "avatar");
  const entering = phase === "avatar";
  const open = entering || panelOpen;
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, entering ? () => undefined : close);
  const a = useAvatarStore((s) => s.appearance);
  const name = useAvatarStore((s) => s.displayName);
  const { setAppearance, setDisplayName } = useAvatarStore.getState();
  const nameId = useId();
  const heightId = useId();
  const drag = useRef<{ x: number } | null>(null);
  if (!open) return null;
  const set = (patch: Partial<AvatarAppearance>) => setAppearance(patch);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex">
      {/* Drag area over the 3D preview (left side) */}
      {entering && (
        <div
          className="pointer-events-auto hidden flex-1 cursor-grab touch-none items-end justify-center pb-8 active:cursor-grabbing md:flex"
          onPointerDown={(e) => {
            drag.current = { x: e.clientX };
            avatarPreview.dragging = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            avatarPreview.yaw += (e.clientX - drag.current.x) * 0.012;
            drag.current.x = e.clientX;
          }}
          onPointerUp={() => {
            drag.current = null;
            avatarPreview.dragging = false;
          }}
          aria-hidden
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs text-ivory">
            <RotateCw size={13} /> Drag to turn your avatar
          </span>
        </div>
      )}
      <aside
        ref={ref}
        role="dialog"
        aria-modal={entering ? "true" : "false"}
        aria-labelledby="avatar-title"
        className={cn(
          "mv-scroll pointer-events-auto ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-line bg-ink/95 shadow-[var(--shadow-panel)] anim-slide-in sm:max-w-[420px]",
          entering && "max-md:mt-[38vh] max-md:h-[62vh] max-md:rounded-t-[18px] max-md:border-t",
        )}
      >
        <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bronze">{entering ? "Before you enter" : "Your avatar"}</p>
            <h2 id="avatar-title" className="font-display text-3xl text-ivory">
              Choose your look
            </h2>
            <p className="mt-1 text-xs text-muted">Procedural avatars. Other visitors see your look and name when live.</p>
          </div>
          {!entering && (
            <IconButton label="Close avatar editor" shortcut="Esc" onClick={close} tooltipSide="left">
              <X size={18} aria-hidden />
            </IconButton>
          )}
        </header>

        <div className="space-y-5 px-5 pb-5">
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Presets">
            {AVATAR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAppearance(p.appearance)}
                className="flex flex-col items-center gap-1.5 rounded-[10px] border border-line p-2 text-xs text-muted hover:border-line-strong hover:text-ivory"
              >
                <span className="flex h-10 w-10 items-end justify-center overflow-hidden rounded-full" style={{ background: p.appearance.topColor }} aria-hidden>
                  <span className="mb-[-6px] h-6 w-6 rounded-full border-2 border-ink" style={{ background: p.appearance.skin }} />
                </span>
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-xs font-medium text-muted">
              Display name <span className="text-faint">(shown to other visitors)</span>
            </label>
            <input
              id={nameId}
              value={name}
              dir="auto"
              maxLength={20}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sara"
              className="h-10 w-full rounded-[10px] border border-line-strong bg-ink-2 px-3 text-sm text-ivory placeholder:text-faint focus:border-bronze/70 focus:outline-none"
            />
          </div>

          <Choice label="Build" options={BODY_OPTIONS} value={a.body} onChange={(body) => set({ body })} />
          <div>
            <label htmlFor={heightId} className="flex items-center justify-between text-xs font-medium text-muted">
              Height <span className="tabular-nums">{Math.round(a.height * 172)} cm</span>
            </label>
            <input id={heightId} type="range" min={0.92} max={1.08} step={0.01} value={a.height} onChange={(e) => set({ height: Number(e.target.value) })} className="mt-1.5 w-full accent-[var(--color-bronze)]" />
          </div>
          <Swatches label="Skin tone" colors={SKIN_TONES} value={a.skin} onChange={(skin) => set({ skin })} />
          <Choice label="Hairstyle" options={HAIR_OPTIONS} value={a.hair} onChange={(hair) => set({ hair })} />
          <Swatches label="Hair colour" colors={HAIR_COLORS} value={a.hairColor} onChange={(hairColor) => set({ hairColor })} />
          <Choice label="Top" options={TOP_OPTIONS} value={a.top} onChange={(top) => set({ top })} />
          <Swatches label="Top colour" colors={CLOTH_COLORS} value={a.topColor} onChange={(topColor) => set({ topColor })} />
          {a.top !== "dress" && <Swatches label="Trousers colour" colors={CLOTH_COLORS} value={a.bottomColor} onChange={(bottomColor) => set({ bottomColor })} />}
          <Swatches label="Shoes" colors={SHOE_COLORS} value={a.shoeColor} onChange={(shoeColor) => set({ shoeColor })} />
          <Choice label="Accessory" options={ACCESSORY_OPTIONS} value={a.accessory} onChange={(accessory) => set({ accessory })} />
        </div>

        <footer className="sticky bottom-0 mt-auto border-t border-line bg-ink px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {entering ? (
            <Button variant="primary" className="h-12 w-full uppercase tracking-[0.18em]" onClick={confirmAvatar}>
              <Check size={17} aria-hidden /> Enter the mall
            </Button>
          ) : (
            <Button variant="primary" className="h-11 w-full" onClick={close}>
              Done
            </Button>
          )}
        </footer>
      </aside>
    </div>
  );
}
