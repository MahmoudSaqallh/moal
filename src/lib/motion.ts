import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";

const QUERY = "(prefers-reduced-motion: reduce)";

let mediaQuery: MediaQueryList | null = null;

/** Cached: this is read every frame by camera code, so avoid re-creating the query. */
function systemPrefersReduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  mediaQuery ??= window.matchMedia(QUERY);
  return mediaQuery.matches;
}

/** Non-hook read for imperative code (actions, timelines). */
export function prefersReducedMotion(): boolean {
  const pref = useSettingsStore.getState().motion;
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return systemPrefersReduced();
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  const pref = useSettingsStore((s) => s.motion);
  const system = useSyncExternalStore(subscribe, systemPrefersReduced, () => false);
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return system;
}
