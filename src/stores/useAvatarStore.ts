"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AvatarAppearance } from "@/types";
import { DEFAULT_APPEARANCE, sanitizeAppearance, sanitizeName } from "@/data/avatars";

interface AvatarState {
  appearance: AvatarAppearance;
  displayName: string;
  /** True once the visitor has confirmed an avatar (skips the picker next visit). */
  chosen: boolean;
  setAppearance: (patch: Partial<AvatarAppearance>) => void;
  setDisplayName: (name: string) => void;
  confirm: () => void;
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set) => ({
      appearance: DEFAULT_APPEARANCE,
      displayName: "",
      chosen: false,
      setAppearance: (patch) => set((s) => ({ appearance: sanitizeAppearance({ ...s.appearance, ...patch }) })),
      setDisplayName: (name) => set({ displayName: name.slice(0, 24) }),
      confirm: () => set((s) => ({ chosen: true, displayName: sanitizeName(s.displayName) })),
    }),
    {
      name: "mallverse-avatar",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AvatarState>;
        return {
          ...current,
          appearance: sanitizeAppearance(p.appearance),
          displayName: sanitizeName(p.displayName),
          chosen: p.chosen === true,
        };
      },
      skipHydration: true,
    },
  ),
);
