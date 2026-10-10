"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Interactable } from "@/types";
import { INTERACTABLES, getDestination } from "@/data/navigation";
import { FOUNTAIN } from "@/data/layout";
import { floorY } from "@/data/floors";
import { autopilot, findZone, player } from "@/lib/runtime";
import { planRoute } from "@/lib/pathfinding";
import { audio } from "@/lib/audio";
import { useExperienceStore } from "@/stores/useExperienceStore";

const forward = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const MAX_ANGLE = 0.7; // ~40° either side of the view direction

/**
 * Runs at ~10 Hz: works out which interactable the visitor is facing, which zone and level
 * they are in, keeps a displayed route current as they move, and sets the fountain volume.
 * Store updates happen only on change, so React re-renders stay rare.
 */
export function FocusSystem() {
  const acc = useRef(0);
  const routeAcc = useRef(0);
  useFrame((state, dt) => {
    acc.current += dt;
    routeAcc.current += dt;
    if (acc.current < 0.1) return;
    acc.current = 0;
    const s = useExperienceStore.getState();

    if (s.floor !== player.floor) s.setFloor(player.floor);
    if (s.phase !== "explore") {
      if (s.focused) s.setFocused(null);
      return;
    }

    const zone = findZone(player.floor, player.x, player.z);
    const zoneId = zone?.id ?? null;
    if (zoneId !== s.zoneId) s.setZone(zoneId);
    const insideStore = zone?.storeId ?? null;

    // Interaction target: near the avatar and roughly where the camera looks.
    state.camera.getWorldDirection(forward);
    let best: Interactable | null = null;
    let bestScore = Infinity;
    if (player.mode === "walk") {
      for (const it of INTERACTABLES) {
        if (it.floor !== player.floor) continue;
        if (it.kind === "product" && it.storeId !== insideStore) continue;
        if (it.kind === "exit-store" && it.storeId !== insideStore) continue;
        if (it.kind === "enter-store" && insideStore) continue;
        if (it.kind === "call-elevator" && s.inLift) continue;
        const dx = it.position.x - player.x;
        const dz = it.position.z - player.z;
        const flat = Math.hypot(dx, dz);
        if (flat > it.range) continue;
        toTarget.set(it.position.x - state.camera.position.x, floorY(it.floor) + it.y - state.camera.position.y, it.position.z - state.camera.position.z);
        const len = toTarget.length();
        if (len < 1e-3) continue;
        const angle = forward.angleTo(toTarget.divideScalar(len));
        const limit = it.kind === "product" ? MAX_ANGLE * 0.75 : MAX_ANGLE;
        if (angle > limit && (flat > 1.4 || it.kind === "exit-store")) continue;
        const score = flat * (1 + angle * 2.5);
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
    }
    if (best?.id !== s.focused?.id) s.setFocused(best);

    // Keep a shown (not walked) route up to date as the visitor moves; detect arrival.
    if (s.route && !autopilot.state && routeAcc.current > 1.2 && player.mode === "walk") {
      routeAcc.current = 0;
      const dest = getDestination(s.route.destinationId);
      const end = s.route.legs.at(-1)?.points.at(-1);
      if (end && end.floor === player.floor && Math.hypot(end.x - player.x, end.z - player.z) < 1.8) {
        s.setRoute(null);
        s.showToast(`You have arrived at ${s.route.label}`);
      } else if (dest) {
        const fresh = planRoute({ x: player.x, z: player.z, floor: player.floor }, dest.nodeId, dest.label);
        if (fresh) s.setRoute({ ...fresh, destinationId: s.route.destinationId });
      }
    }

    const fountainDist = Math.hypot(player.x - FOUNTAIN.x, player.z - FOUNTAIN.z) + Math.abs(player.y) * 0.6;
    audio.setFountainProximity(1 - Math.min(1, Math.max(0, (fountainDist - 4) / 22)));
  });
  return null;
}
