"use client";

import { useId } from "react";
import { X } from "lucide-react";
import type { QualityPreset } from "@/types";
import { useSettingsStore, type MotionPreference } from "@/stores/useSettingsStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { IconButton, Kbd, cn, useFocusTrap } from "../ui/primitives";

const PRESETS: { id: QualityPreset; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Phones and older laptops. No shadows, lighter scenery." },
  { id: "medium", label: "Medium", hint: "Balanced. Baked sun shadows, crisp textures." },
  { id: "high", label: "High", hint: "Ambient occlusion, bloom and high-res shadows." },
];

const MOTION: { id: MotionPreference; label: string }[] = [
  { id: "system", label: "Match system" },
  { id: "reduce", label: "Reduced" },
  { id: "full", label: "Full" },
];

const CAMERA: { id: "third" | "first"; label: string }[] = [
  { id: "third", label: "Third person" },
  { id: "first", label: "First person" },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[10px] border border-line bg-ink-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("h-9 rounded-[7px] text-sm transition-colors", value === o.id ? "bg-ink-3 text-ivory shadow-sm" : "text-muted hover:text-ivory")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm text-ivory">
          {label}
        </label>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors", checked ? "border-bronze bg-bronze/70" : "border-line-strong bg-ink-3")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-ivory transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} aria-hidden />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const open = useExperienceStore((s) => s.panel === "settings");
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, close);
  const s = useSettingsStore();
  const sensId = useId();
  if (!open) return null;
  const preset = PRESETS.find((p) => p.id === s.quality)!;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 anim-fade" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="mv-scroll h-full w-full max-w-sm overflow-y-auto border-l border-line bg-ink p-5 shadow-[var(--shadow-panel)] anim-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-3xl text-ivory">
            Settings
          </h2>
          <IconButton label="Close settings" shortcut="Esc" onClick={close} tooltipSide="left">
            <X size={18} aria-hidden />
          </IconButton>
        </div>

        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Graphics</h3>
          <Segmented label="Graphics quality" value={s.quality} options={PRESETS} onChange={(q) => s.setQuality(q)} />
          <p className="text-xs text-muted">{preset.hint}</p>
          <Toggle
            checked={s.showPerformance}
            onChange={s.setShowPerformance}
            label="Performance overlay"
            description="Frame rate, draw calls and GPU memory."
          />
        </section>

        <section className="mt-8 space-y-4">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Controls</h3>
          <div className="space-y-1.5">
            <p className="text-sm text-ivory">Camera</p>
            <Segmented label="Camera" value={s.cameraMode} options={CAMERA} onChange={s.setCameraMode} />
            <p className="text-xs text-muted">Third person follows your avatar; first person sees through its eyes. Shortcut: V.</p>
          </div>
          <Toggle
            checked={s.pointerLock}
            onChange={s.setPointerLock}
            label="Capture mouse to look"
            description="Click the scene to look with the mouse like a game. Esc releases it. Off: drag to look."
          />
          <div>
            <label htmlFor={sensId} className="flex items-center justify-between text-sm text-ivory">
              Look sensitivity <span className="tabular-nums text-muted">{s.lookSensitivity.toFixed(1)}×</span>
            </label>
            <input
              id={sensId}
              type="range"
              min={0.4}
              max={2}
              step={0.1}
              value={s.lookSensitivity}
              onChange={(e) => s.setLookSensitivity(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-bronze)]"
            />
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Motion</h3>
          <Segmented label="Motion" value={s.motion} options={MOTION} onChange={s.setMotion} />
          <p className="text-xs text-muted">Reduced motion skips the camera fly-through and moves you instantly when using directions.</p>
        </section>
      </div>
    </div>
  );
}

export function HelpPanel() {
  const open = useExperienceStore((s) => s.panel === "help");
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, close);
  if (!open) return null;
  const rows: [string, React.ReactNode][] = [
    ["Walk", <><Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> or <Kbd>↑</Kbd> <Kbd>↓</Kbd></>],
    ["Turn", <><Kbd>←</Kbd> <Kbd>→</Kbd> or drag the scene</>],
    ["Walk faster", <Kbd key="s">Shift</Kbd>],
    ["Enter a store / inspect / use", <><Kbd>E</Kbd> or click it</>],
    ["Map and directory", <Kbd key="m">M</Kbd>],
    ["Close / go back", <Kbd key="e">Esc</Kbd>],
  ];
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4 anim-fade" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="w-full max-w-md rounded-[var(--radius-panel)] border border-line bg-ink p-6 shadow-[var(--shadow-panel)] anim-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="help-title" className="font-display text-3xl text-ivory">
            Getting around
          </h2>
          <IconButton label="Close help" shortcut="Esc" onClick={close} tooltipSide="left">
            <X size={18} aria-hidden />
          </IconButton>
        </div>
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-1 text-ivory">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          On touch screens, use the joystick to walk and drag anywhere else to look. Prefer not to move around in 3D? Open the directory and choose{" "}
          <span className="text-ivory">Browse products</span> or <span className="text-ivory">Walk me there</span>.
        </p>
      </div>
    </div>
  );
}
