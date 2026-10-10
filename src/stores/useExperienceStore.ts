"use client";

import { create } from "zustand";
import type { ExperiencePhase, Interactable, Route } from "@/types";
import { defaultConfiguration, getConfigurator } from "@/data/configurators";

export type PanelId = "directory" | "cart" | "settings" | "help" | "avatar" | "assistant";

interface ExperienceState {
  phase: ExperiencePhase;
  loading: { progress: number; label: string; error: string | null };
  /** Bumped to replay the exterior intro (e.g. after "Exit mall"). */
  introRun: number;
  /** True while the intro establishing shot is still moving (UI waits for it). */
  introSettled: boolean;
  zoneId: string | null;
  /** Level the avatar is on (0-based). */
  floor: number;
  /** True while the avatar stands inside the lift cabin (shows the floor panel). */
  inLift: boolean;
  focused: Interactable | null;
  selectedProductId: string | null;
  selectedColorId: string | null;
  selectedSize: string | null;
  /** Configurator choices for the selected product (part id → option id), if configurable. */
  configuration: Record<string, string> | null;
  route: Route | null;
  /** Index of the route leg currently being followed (for the instruction banner). */
  routeLeg: number;
  autopilot: boolean;
  panel: PanelId | null;
  /** Store whose catalogue is open in the accessible (non-3D) browser. */
  browseStoreId: string | null;
  toast: { id: number; message: string } | null;
  webglLost: boolean;

  setPhase: (phase: ExperiencePhase) => void;
  setLoading: (progress: number, label: string) => void;
  setLoadingError: (error: string) => void;
  setIntroSettled: (settled: boolean) => void;
  replayIntro: () => void;
  setZone: (zoneId: string | null) => void;
  setFloor: (floor: number) => void;
  setInLift: (inLift: boolean) => void;
  setRouteLeg: (leg: number) => void;
  setFocused: (focused: Interactable | null) => void;
  selectProduct: (productId: string | null, colorId?: string | null, size?: string | null) => void;
  setVariant: (colorId: string | null, size: string | null) => void;
  setConfigurationPart: (part: string, option: string) => void;
  setRoute: (route: Route | null) => void;
  setAutopilot: (on: boolean) => void;
  openPanel: (panel: PanelId | null) => void;
  togglePanel: (panel: PanelId) => void;
  browseStore: (storeId: string | null) => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  setWebglLost: (lost: boolean) => void;
}

let toastId = 0;

export const useExperienceStore = create<ExperienceState>()((set) => ({
  phase: "loading",
  loading: { progress: 0, label: "Preparing the mall", error: null },
  introRun: 0,
  introSettled: false,
  zoneId: null,
  floor: 0,
  inLift: false,
  focused: null,
  selectedProductId: null,
  selectedColorId: null,
  selectedSize: null,
  configuration: null,
  route: null,
  routeLeg: 0,
  autopilot: false,
  panel: null,
  browseStoreId: null,
  toast: null,
  webglLost: false,

  setPhase: (phase) => set({ phase }),
  setLoading: (progress, label) => set((s) => ({ loading: { ...s.loading, progress, label } })),
  setLoadingError: (error) => set((s) => ({ loading: { ...s.loading, error } })),
  setIntroSettled: (introSettled) => set({ introSettled }),
  replayIntro: () =>
    set((s) => ({
      phase: "intro",
      introRun: s.introRun + 1,
      introSettled: false,
      route: null,
      autopilot: false,
      panel: null,
      focused: null,
      selectedProductId: null,
    })),
  setZone: (zoneId) => set({ zoneId }),
  setFloor: (floor) => set({ floor }),
  setInLift: (inLift) => set({ inLift }),
  setRouteLeg: (routeLeg) => set({ routeLeg }),
  setFocused: (focused) => set({ focused }),
  selectProduct: (selectedProductId, colorId = null, size = null) => {
    const configurator = selectedProductId ? getConfigurator(selectedProductId) : undefined;
    set({
      selectedProductId,
      selectedColorId: colorId,
      selectedSize: size,
      configuration: configurator ? defaultConfiguration(configurator) : null,
    });
  },
  setConfigurationPart: (part, option) =>
    set((s) => (s.configuration ? { configuration: { ...s.configuration, [part]: option } } : {})),
  setVariant: (selectedColorId, selectedSize) => set({ selectedColorId, selectedSize }),
  setRoute: (route) => set({ route, routeLeg: 0 }),
  setAutopilot: (autopilot) => set({ autopilot }),
  openPanel: (panel) => set({ panel }),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  browseStore: (browseStoreId) => set({ browseStoreId }),
  showToast: (message) => set({ toast: { id: ++toastId, message } }),
  dismissToast: () => set({ toast: null }),
  setWebglLost: (webglLost) => set({ webglLost }),
}));
