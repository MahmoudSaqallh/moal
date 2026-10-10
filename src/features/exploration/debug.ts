import { player } from "@/lib/runtime";
import { floorY } from "@/data/floors";
import { lift } from "@/lib/elevator";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAvatarStore } from "@/stores/useAvatarStore";
import { perfStats } from "@/three/scenes/perfStats";
import { usePresenceStore } from "@/features/multiplayer/client";
import type { LightingMode } from "@/types";
import { inspectProduct, closeInspect, navigateTo, skipIntro, enterMall, confirmAvatar, fastTravel, callLift, selectLiftFloor } from "./actions";

/**
 * Opt-in automation hook for end-to-end checks and screenshots (`/?debug`).
 * Exposes existing public actions only; never installed without the query flag.
 */
export function installDebugHook() {
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("debug")) return;
  (window as unknown as { __mallverse: unknown }).__mallverse = {
    state: () => {
      const s = useExperienceStore.getState();
      return {
        phase: s.phase,
        zone: s.zoneId,
        floor: s.floor,
        focused: s.focused?.id ?? null,
        route: s.route?.label ?? null,
        autopilot: s.autopilot,
        selected: s.selectedProductId,
        inLift: s.inLift,
        presence: usePresenceStore.getState().status,
        visitors: usePresenceStore.getState().visitors,
      };
    },
    player: () => ({ x: player.x, z: player.z, y: player.y, floor: player.floor, yaw: player.yaw, mode: player.mode }),
    lift: () => ({ y: lift.y, floor: lift.floor, doors: lift.doors, queue: [...lift.queue] }),
    teleport: (x: number, z: number, floor = player.floor, camYaw = player.camYaw, camPitch = player.camPitch) => {
      player.x = x;
      player.z = z;
      player.floor = floor;
      player.y = floorY(floor);
      player.camYaw = camYaw;
      player.yaw = camYaw;
      player.camPitch = camPitch;
      useExperienceStore.getState().setFloor(floor);
    },
    perf: () => ({ ...perfStats }),
    setQuality: (q: "low" | "medium" | "high") => useSettingsStore.getState().setQuality(q),
    setLighting: (m: LightingMode) => useSettingsStore.getState().setLighting(m),
    setCamera: (m: "third" | "first") => useSettingsStore.getState().setCameraMode(m),
    setName: (n: string) => useAvatarStore.getState().setDisplayName(n),
    enterMall,
    confirmAvatar,
    skipIntro,
    navigateTo,
    fastTravel,
    callLift,
    selectLiftFloor,
    inspectProduct,
    closeInspect,
  };
}
