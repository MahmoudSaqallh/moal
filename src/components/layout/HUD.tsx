"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  ArrowUp,
  Moon,
  Sun,
  Sunset,
  UserRound,
  Users,
  CircleHelp,
  DoorOpen,
  Expand,
  Footprints,
  Map as MapIcon,
  MoreHorizontal,
  Settings2,
  Shrink,
  ShoppingBag,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ALL_ZONES } from "@/data/layout";
import { FLOORS } from "@/data/floors";
import { lift } from "@/lib/elevator";
import { usePresenceStore } from "@/features/multiplayer/client";
import type { LightingMode } from "@/types";
import { getDestination } from "@/data/navigation";
import { audio } from "@/lib/audio";
import { input } from "@/lib/runtime";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useCartStore, cartTotals } from "@/stores/useCartStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { cancelNavigation, exitMall, interact, navigateTo, openDirectory, selectLiftFloor } from "@/features/exploration/actions";
import { perfStats } from "@/three/scenes/perfStats";
import { Button, IconButton, Kbd, cn } from "../ui/primitives";
import { MiniMap } from "../navigation/MiniMap";

const coarseQuery = "(pointer: coarse)";
function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia(coarseQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarse, () => window.matchMedia(coarseQuery).matches, () => false);
}

function useFullscreen() {
  const [active, setActive] = useState(false);
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  useEffect(() => {
    const on = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  return { supported, active, toggle };
}

function LocationChip() {
  const zoneId = useExperienceStore((s) => s.zoneId);
  const zone = ALL_ZONES.find((z) => z.id === zoneId);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[12px] border border-line bg-ink/90 py-1.5 pl-3 pr-4 shadow-[var(--shadow-panel)]">
      <span className="font-display text-xl italic leading-none text-ivory">MallVerse</span>
      <span className="h-6 w-px bg-line-strong" aria-hidden />
      <div className="min-w-0" aria-live="polite" aria-atomic="true">
        <p className="truncate text-sm font-medium leading-tight text-ivory">{zone?.name ?? "Main entrance"}</p>
        <p className="hidden truncate text-[11px] leading-tight text-muted sm:block">{zone?.subtitle ?? "Ground level"}</p>
      </div>
    </div>
  );
}

function CartButton() {
  const count = useCartStore((s) => cartTotals(s.lines).count);
  const pulse = useCartStore((s) => s.addedPulse);
  const togglePanel = useExperienceStore((s) => s.togglePanel);
  return (
    <IconButton
      label={count ? `Bag, ${count} item${count === 1 ? "" : "s"}` : "Bag"}
      onClick={() => togglePanel("cart")}
      badge={
        count > 0 ? (
          <span key={pulse} className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-bronze px-1 text-[11px] font-semibold text-ink anim-pulse">
            {count}
          </span>
        ) : null
      }
    >
      <ShoppingBag size={18} aria-hidden />
    </IconButton>
  );
}

function SoundButton() {
  const sound = useSettingsStore((s) => s.sound);
  const setSound = useSettingsStore((s) => s.setSound);
  return (
    <IconButton
      label={sound ? "Mute ambience" : "Play ambience"}
      active={sound}
      onClick={async () => {
        if (sound) {
          audio.disable();
          setSound(false);
        } else {
          const ok = await audio.enable();
          setSound(ok);
          if (!ok) useExperienceStore.getState().showToast("Audio isn’t available in this browser.");
        }
      }}
    >
      {sound ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
    </IconButton>
  );
}

const LIGHTING: { id: LightingMode; label: string; Icon: typeof Sun }[] = [
  { id: "day", label: "Daylight", Icon: Sun },
  { id: "evening", label: "Evening", Icon: Sunset },
  { id: "night", label: "Night", Icon: Moon },
];

function LightingButton() {
  const mode = useSettingsStore((s) => s.lighting);
  const setLighting = useSettingsStore((s) => s.setLighting);
  const i = Math.max(0, LIGHTING.findIndex((l) => l.id === mode));
  const next = LIGHTING[(i + 1) % LIGHTING.length];
  const Icon = LIGHTING[i].Icon;
  return (
    <IconButton label={`Lighting: ${LIGHTING[i].label} (switch to ${next.label})`} onClick={() => setLighting(next.id)}>
      <Icon size={18} aria-hidden />
    </IconButton>
  );
}

/** Honest multiplayer status: live with a real count, connecting, or offline preview. */
function PresencePill() {
  const status = usePresenceStore((s) => s.status);
  const visitors = usePresenceStore((s) => s.visitors);
  const label = status === "live" ? `${visitors} live` : status === "connecting" ? "Connecting…" : "Offline preview";
  const title =
    status === "disabled"
      ? "No realtime server configured (NEXT_PUBLIC_REALTIME_URL). You are exploring alone."
      : status === "offline"
        ? "The realtime server is unreachable. Reconnecting automatically."
        : status === "live"
          ? `${visitors} ${visitors === 1 ? "visitor" : "visitors"} in the mall right now`
          : undefined;
  return (
    <span
      title={title}
      role="status"
      className={cn(
        "hidden h-10 items-center gap-1.5 rounded-[10px] border bg-ink/90 px-3 text-xs sm:inline-flex",
        status === "live" ? "border-sage/50 text-ivory" : "border-line text-muted",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", status === "live" ? "bg-sage" : status === "connecting" ? "bg-bronze" : "bg-faint")} aria-hidden />
      <Users size={14} aria-hidden /> {label}
    </span>
  );
}

/** Lift car operating panel, shown while standing in the cabin. */
function LiftPanel() {
  const inLift = useExperienceStore((s) => s.inLift);
  const [, force] = useState(0);
  useEffect(() => {
    if (!inLift) return;
    const t = window.setInterval(() => force((n) => n + 1), 200);
    return () => window.clearInterval(t);
  }, [inLift]);
  if (!inLift) return null;
  const moving = lift.velocity !== 0;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-[14px] border border-line bg-ink/95 p-2 shadow-[var(--shadow-panel)] anim-rise" role="group" aria-label="Lift controls">
      <div className="flex h-10 min-w-14 items-center justify-center gap-1 rounded-[10px] bg-[#0d0c0a] px-2 font-mono text-lg text-[#f3d9a8]" aria-live="polite">
        {moving && (lift.velocity > 0 ? <ArrowUp size={16} aria-label="Going up" /> : <ArrowDown size={16} aria-label="Going down" />)}L{lift.floor + 1}
      </div>
      {FLOORS.map((f) => (
        <button
          key={f.index}
          type="button"
          onClick={() => selectLiftFloor(f.index)}
          aria-pressed={lift.queue.includes(f.index)}
          aria-label={`${f.name}, ${f.theme}`}
          className={cn(
            "h-10 min-w-10 rounded-full border text-sm font-semibold transition-colors",
            lift.queue.includes(f.index) ? "border-bronze bg-bronze text-ink" : "border-line-strong text-ivory hover:bg-ink-3",
          )}
        >
          {f.index + 1}
        </button>
      ))}
      <span className="hidden px-1 text-[11px] text-faint sm:block">or press 1–3</span>
    </div>
  );
}

function Toolbar() {
  const panel = useExperienceStore((s) => s.panel);
  const togglePanel = useExperienceStore((s) => s.togglePanel);
  const fs = useFullscreen();
  const [more, setMore] = useState(false);
  const extras = (
    <>
      <IconButton label="Edit avatar" active={panel === "avatar"} onClick={() => togglePanel("avatar")}>
        <UserRound size={18} aria-hidden />
      </IconButton>
      <LightingButton />
      <SoundButton />
      {fs.supported && (
        <IconButton label={fs.active ? "Exit full screen" : "Full screen"} onClick={fs.toggle}>
          {fs.active ? <Shrink size={18} aria-hidden /> : <Expand size={18} aria-hidden />}
        </IconButton>
      )}
      <IconButton label="Controls help" active={panel === "help"} onClick={() => togglePanel("help")}>
        <CircleHelp size={18} aria-hidden />
      </IconButton>
      <IconButton label="Exit the mall" onClick={exitMall}>
        <DoorOpen size={18} aria-hidden />
      </IconButton>
    </>
  );
  return (
    <nav aria-label="Mall controls" className="flex items-start gap-1.5">
      <PresencePill />
      <IconButton label="Map & directory" shortcut="M" active={panel === "directory"} onClick={openDirectory}>
        <MapIcon size={18} aria-hidden />
      </IconButton>
      <CartButton />
      <IconButton label="Settings" active={panel === "settings"} onClick={() => togglePanel("settings")}>
        <Settings2 size={18} aria-hidden />
      </IconButton>
      <div className="hidden gap-1.5 sm:flex">{extras}</div>
      <div className="relative sm:hidden">
        <IconButton label={more ? "Close menu" : "More"} aria-expanded={more} onClick={() => setMore((m) => !m)} tooltipSide="left">
          {more ? <X size={18} aria-hidden /> : <MoreHorizontal size={18} aria-hidden />}
        </IconButton>
        {more && <div className="absolute right-0 top-12 z-40 flex flex-col gap-1.5 anim-rise" onClick={() => setMore(false)}>{extras}</div>}
      </div>
    </nav>
  );
}

/** Contextual "Press E" prompt, or a tap target on touch screens. */
function InteractionPrompt() {
  const focused = useExperienceStore((s) => s.focused);
  const autopilot = useExperienceStore((s) => s.autopilot);
  const coarse = useCoarsePointer();
  if (!focused || autopilot) return <div aria-live="polite" className="sr-only" />;
  const text = `${focused.verb} ${focused.label}`;
  return (
    <div aria-live="polite" className="pointer-events-none flex justify-center">
      {coarse ? (
        <button
          type="button"
          onClick={() => interact(focused)}
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full border border-bronze/50 bg-ink/95 px-5 text-sm font-medium text-ivory shadow-[var(--shadow-panel)] anim-rise"
        >
          {text}
        </button>
      ) : (
        <p className="inline-flex items-center gap-2.5 rounded-full border border-line bg-ink/92 py-2 pl-2 pr-4 text-sm text-ivory shadow-[var(--shadow-panel)] anim-rise">
          <Kbd className="h-6 min-w-6 text-xs">E</Kbd>
          {text}
        </p>
      )}
    </div>
  );
}

function RouteStatus() {
  const route = useExperienceStore((s) => s.route);
  const autopilot = useExperienceStore((s) => s.autopilot);
  const leg = useExperienceStore((s) => s.routeLeg);
  if (!route) return null;
  const dest = getDestination(route.destinationId);
  const stepIndex = Math.min(leg, route.legs.length - 1);
  const step = route.legs[stepIndex]?.instruction;
  return (
    <div className="flex flex-col items-center gap-1.5" role="status">
      {step && route.legs.length > 1 && (
        <p className="rounded-full bg-ink/85 px-3 py-1 text-xs text-ivory">
          Step {stepIndex + 1}/{route.legs.length}: {step}
        </p>
      )}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-bronze/40 bg-ink/95 py-1.5 pl-4 pr-1.5 text-sm text-ivory shadow-[var(--shadow-panel)] anim-rise">
        <Footprints size={15} className="text-bronze" aria-hidden />
        <span>
          {autopilot ? "Walking to " : "Route to "}
          <span className="font-medium">{route.label}</span>
        </span>
        {!autopilot && dest && (
          <Button variant="primary" className="ml-1 min-h-8 rounded-full px-3 text-xs" onClick={() => navigateTo(dest.id, true)}>
            Walk me there
          </Button>
        )}
        <Button variant="ghost" className="min-h-8 rounded-full px-3 text-xs" onClick={cancelNavigation}>
          {autopilot ? "Stop" : "Clear"}
        </Button>
      </div>
    </div>
  );
}

function ControlsHint() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("mallverse-hint-dismissed") !== "1";
    } catch {
      return true;
    }
  });
  const coarse = useCoarsePointer();
  if (!open || coarse) return null;
  return (
    <div className="hidden items-center gap-3 rounded-[12px] border border-line bg-ink/90 py-2 pl-3 pr-1.5 text-xs text-muted shadow-[var(--shadow-panel)] anim-rise md:flex">
      <span className="flex items-center gap-1">
        <Kbd>W</Kbd>
        <Kbd>A</Kbd>
        <Kbd>S</Kbd>
        <Kbd>D</Kbd> walk
      </span>
      <span>Drag to orbit · scroll to zoom</span>
      <span className="flex items-center gap-1">
        <Kbd>V</Kbd> view
      </span>
      <span className="flex items-center gap-1">
        <Kbd>E</Kbd> interact
      </span>
      <span className="flex items-center gap-1">
        <Kbd>M</Kbd> map
      </span>
      <IconButton
        label="Hide controls hint"
        className="h-7 w-7 border-transparent bg-transparent"
        tooltipSide="top"
        onClick={() => {
          setOpen(false);
          try {
            localStorage.setItem("mallverse-hint-dismissed", "1");
          } catch {
            /* storage unavailable: the hint simply reappears next visit */
          }
        }}
      >
        <X size={14} aria-hidden />
      </IconButton>
    </div>
  );
}

function Crosshair() {
  const coarse = useCoarsePointer();
  const focused = useExperienceStore((s) => !!s.focused);
  if (coarse) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <div className={cn("rounded-full transition-all duration-200", focused ? "h-3 w-3 border-2 border-bronze" : "h-1.5 w-1.5 bg-ivory/70 shadow")} />
    </div>
  );
}

export function Toast() {
  const toast = useExperienceStore((s) => s.toast);
  const dismiss = useExperienceStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismiss, 3200);
    return () => window.clearTimeout(t);
  }, [toast, dismiss]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      {toast && (
        <p key={toast.id} className="rounded-full border border-line bg-ink px-4 py-2 text-sm text-ivory shadow-[var(--shadow-panel)] anim-rise">
          {toast.message}
        </p>
      )}
    </div>
  );
}

function PerfOverlay() {
  const show = useSettingsStore((s) => s.showPerformance);
  const [, force] = useState(0);
  useEffect(() => {
    if (!show) return;
    const t = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [show]);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-30 rounded-lg border border-line bg-ink/90 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted md:bottom-auto md:right-auto md:left-3 md:top-20">
      <p>
        <span className="text-ivory">{perfStats.fps}</span> fps
      </p>
      <p>{perfStats.calls} draw calls</p>
      <p>{(perfStats.triangles / 1000).toFixed(0)}k triangles</p>
      <p>
        {perfStats.geometries} geo · {perfStats.textures} tex
      </p>
    </div>
  );
}

/** Virtual joystick for touch devices; writes the same movement axes as WASD. */
function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const R = 46;
  const update = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    knob.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = 0.12;
    const nx = dx / R;
    const ny = dy / R;
    input.strafe = Math.abs(nx) > dead ? nx : 0;
    input.forward = Math.abs(ny) > dead ? -ny : 0;
    input.sprint = Math.hypot(nx, ny) > 0.95;
    if ((input.forward || input.strafe) && useExperienceStore.getState().autopilot) cancelNavigation();
  };
  const end = () => {
    active.current = null;
    input.forward = 0;
    input.strafe = 0;
    input.sprint = false;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };
  return (
    <div
      ref={base}
      role="application"
      aria-label="Movement joystick"
      className="pointer-events-auto relative grid h-32 w-32 touch-none select-none place-items-center rounded-full border border-line-strong bg-ink/55"
      onPointerDown={(e) => {
        e.stopPropagation();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={knob} className="h-14 w-14 rounded-full border border-bronze/60 bg-ink-3 shadow-lg transition-transform duration-75" />
    </div>
  );
}

export function HUD() {
  const phase = useExperienceStore((s) => s.phase);
  const coarse = useCoarsePointer();
  const exploring = phase === "explore";
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <header className="pointer-events-auto absolute left-3 right-3 top-3 flex items-start justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
        <LocationChip />
        <Toolbar />
      </header>
      {exploring && <Crosshair />}
      {exploring && (
        <div className={cn("pointer-events-auto absolute left-3 sm:left-5", coarse ? "top-20" : "bottom-5")}>
          <MiniMap />
        </div>
      )}
      <div
        className={cn(
          "absolute inset-x-0 flex flex-col items-center gap-2 px-4",
          coarse ? "bottom-[calc(10rem+env(safe-area-inset-bottom))]" : "bottom-6",
        )}
      >
        {exploring && <LiftPanel />}
        {exploring && <RouteStatus />}
        {exploring && <InteractionPrompt />}
      </div>
      {exploring && (
        <div className="pointer-events-auto absolute bottom-5 right-5">
          <ControlsHint />
        </div>
      )}
      {exploring && coarse && (
        <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-5">
          <Joystick />
        </div>
      )}
      <PerfOverlay />
    </div>
  );
}
