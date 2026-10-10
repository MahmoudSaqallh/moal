"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LightingMode, QualityPreset } from "@/types";

export type MotionPreference = "system" | "reduce" | "full";

interface SettingsState {
  quality: QualityPreset;
  /** True once the visitor (or auto-detection) has chosen a preset. */
  qualityChosen: boolean;
  sound: boolean;
  /** Capture the mouse for FPS-style look when the canvas is clicked (desktop). */
  pointerLock: boolean;
  motion: MotionPreference;
  lookSensitivity: number;
  showPerformance: boolean;
  /** Third-person (default) or first-person view. */
  cameraMode: "third" | "first";
  lighting: LightingMode;
  setCameraMode: (m: "third" | "first") => void;
  setLighting: (m: LightingMode) => void;
  setQuality: (q: QualityPreset, chosen?: boolean) => void;
  setSound: (on: boolean) => void;
  setPointerLock: (on: boolean) => void;
  setMotion: (m: MotionPreference) => void;
  setLookSensitivity: (v: number) => void;
  setShowPerformance: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      quality: "medium",
      qualityChosen: false,
      sound: false,
      pointerLock: false,
      motion: "system",
      lookSensitivity: 1,
      showPerformance: false,
      cameraMode: "third",
      lighting: "day",
      setCameraMode: (cameraMode) => set({ cameraMode }),
      setLighting: (lighting) => set({ lighting }),
      setQuality: (quality, chosen = true) => set({ quality, qualityChosen: chosen }),
      setSound: (sound) => set({ sound }),
      setPointerLock: (pointerLock) => set({ pointerLock }),
      setMotion: (motion) => set({ motion }),
      setLookSensitivity: (lookSensitivity) => set({ lookSensitivity: Math.min(2, Math.max(0.4, lookSensitivity)) }),
      setShowPerformance: (showPerformance) => set({ showPerformance }),
    }),
    {
      name: "mallverse-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Sound must always start muted: browsers require a gesture before audio plays.
      partialize: ({ quality, qualityChosen, pointerLock, motion, lookSensitivity, showPerformance, cameraMode, lighting }) => ({
        cameraMode,
        lighting,
        quality,
        qualityChosen,
        pointerLock,
        motion,
        lookSensitivity,
        showPerformance,
      }),
      skipHydration: true,
    },
  ),
);

/** Pick a sensible preset for this device the first time the mall is opened. */
export function detectQuality(): QualityPreset {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  if (coarse || small || memory <= 2) return "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "medium";
}
