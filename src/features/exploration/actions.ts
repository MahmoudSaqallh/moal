import type { FloorPoint, Interactable, Route, Vec2 } from "@/types";
import { getDestination, getNavNode, doorOutsideNodeId, liftNodeId } from "@/data/navigation";
import { getStore } from "@/data/stores";
import { getProduct } from "@/data/products";
import { floorY } from "@/data/floors";
import { planRoute } from "@/lib/pathfinding";
import { cancelAutopilot, player, startAutopilot, resetInput } from "@/lib/runtime";
import { lift, requestFloor } from "@/lib/elevator";
import { localToWorld, yawTowards } from "@/lib/space";
import { prefersReducedMotion } from "@/lib/motion";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useAvatarStore } from "@/stores/useAvatarStore";

/**
 * Imperative actions shared by the HUD, keyboard shortcuts, the AI assistant and 3D click
 * handlers. They write to the per-frame runtime (`player`, `autopilot`, `lift`) and to the
 * experience store, never directly to the camera — choreography lives in `three/camera`.
 */

/** Where the visitor stands after the entrance fly-through: facing the fountain. */
export const ATRIUM_START = { x: 0, z: 13.5, yaw: 0 };

const store = () => useExperienceStore.getState();

export function playerPosition(): FloorPoint {
  return { x: player.x, z: player.z, floor: player.floor };
}

/** Instantly place the avatar (fast travel, reduced motion, intro hand-off). */
export function teleport(to: Vec2, floor: number, yaw: number | null) {
  player.x = to.x;
  player.z = to.z;
  player.floor = floor;
  player.y = floorY(floor);
  player.vx = 0;
  player.vz = 0;
  player.mode = "walk";
  player.ride = null;
  if (yaw !== null) {
    player.yaw = yaw;
    player.camYaw = yaw;
  }
  store().setFloor(floor);
}

export function planTo(destinationId: string): Route | null {
  const dest = getDestination(destinationId);
  if (!dest) return null;
  const route = planRoute(playerPosition(), dest.nodeId, dest.label);
  return route ? { ...route, destinationId } : null;
}

/**
 * Plan a route to a destination and show it on the map and floor.
 * With `walk`, the avatar is guided along it — including escalator rides and lift trips —
 * or moved instantly under reduced motion.
 */
export function navigateTo(destinationId: string, walk: boolean): boolean {
  const dest = getDestination(destinationId);
  if (!dest) return false;
  if (player.mode !== "walk") {
    store().showToast("Wait until you've stepped off before starting new directions.");
    return false;
  }
  const route = planRoute(playerPosition(), dest.nodeId, dest.label);
  if (!route) {
    store().showToast("No walkable route found from here.");
    return false;
  }
  const end = route.legs.at(-1)!.points.at(-1)!;
  const finalYaw = yawTowards(end, dest.lookAt);
  store().setRoute({ ...route, destinationId });
  if (!walk) return true;

  store().openPanel(null);
  if (prefersReducedMotion()) {
    teleport(end, end.floor, finalYaw);
    store().setRoute(null);
    return true;
  }
  resetInput();
  store().setAutopilot(true);
  startAutopilot(route.legs, finalYaw, () => {
    store().setAutopilot(false);
    store().setRoute(null);
  });
  return true;
}

/** Jump straight to a destination (fast travel). */
export function fastTravel(destinationId: string): boolean {
  const dest = getDestination(destinationId);
  const node = dest ? getNavNode(dest.nodeId) : undefined;
  if (!dest || !node) return false;
  if (player.mode !== "walk") return false;
  cancelNavigation();
  teleport(node.position, node.floor, yawTowards(node.position, dest.lookAt));
  store().openPanel(null);
  store().showToast(`Arrived at ${dest.label} · Level ${node.floor + 1}`);
  return true;
}

export function cancelNavigation() {
  cancelAutopilot();
  store().setAutopilot(false);
  store().setRoute(null);
}

export function enterStore(storeId: string) {
  navigateTo(storeId, true);
}

export function exitStore(storeId: string) {
  const s = getStore(storeId);
  const outside = getNavNode(doorOutsideNodeId(storeId));
  if (!s || !outside) return;
  const lookAt = localToWorld(s, 4, 6);
  const finalYaw = yawTowards(outside.position, lookAt);
  if (prefersReducedMotion()) {
    teleport(outside.position, outside.floor, finalYaw);
    return;
  }
  const route = planRoute(playerPosition(), outside.id, "the corridor");
  if (!route) return;
  resetInput();
  store().setAutopilot(true);
  startAutopilot(route.legs, finalYaw, () => store().setAutopilot(false));
}

/** Hall call: bring the lift to the visitor's floor. */
export function callLift(floor = player.floor) {
  requestFloor(lift, floor);
  player.gestureAt = performance.now() / 1000;
}

/** Cabin button. */
export function selectLiftFloor(floor: number) {
  if (floor === player.floor && lift.velocity === 0) {
    requestFloor(lift, floor); // re-open
    return;
  }
  requestFloor(lift, floor);
  player.gestureAt = performance.now() / 1000;
}

export function inspectProduct(productId: string) {
  const product = getProduct(productId);
  if (!product) return;
  cancelNavigation();
  resetInput();
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  const s = store();
  s.openPanel(null);
  s.selectProduct(productId, product.colors[0]?.id ?? null, null);
  s.setPhase("inspect");
}

/** Ends product focus; the camera rig tweens back and then returns control. */
export function closeInspect() {
  store().selectProduct(null);
}

export function openDirectory() {
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  store().openPanel("directory");
}

export function interact(target: Interactable | null) {
  if (!target) return;
  player.gestureAt = performance.now() / 1000;
  switch (target.kind) {
    case "enter-store":
      if (target.storeId) enterStore(target.storeId);
      break;
    case "exit-store":
      if (target.storeId) exitStore(target.storeId);
      break;
    case "directory":
      openDirectory();
      break;
    case "call-elevator":
      callLift(target.floor);
      store().showToast("Lift called. It will open here shortly.");
      break;
    case "product":
      if (target.productId) inspectProduct(target.productId);
      break;
  }
}

/** "Enter the mall": pick an avatar first unless one is already saved. */
export function enterMall() {
  const s = store();
  if (s.phase !== "intro") return;
  s.setPhase(useAvatarStore.getState().chosen ? "entering" : "avatar");
}

/** Set when the visitor skipped the fly-through, so the avatar picker drops them straight in. */
let flightSkipped = false;

/** Confirm the avatar picker and fly in (or drop straight in when the intro was skipped). */
export function confirmAvatar() {
  useAvatarStore.getState().confirm();
  const s = store();
  if (s.phase !== "avatar") return;
  if (flightSkipped || prefersReducedMotion()) {
    flightSkipped = false;
    teleport(ATRIUM_START, 0, ATRIUM_START.yaw);
    s.setPhase("explore");
    return;
  }
  s.setPhase("entering");
}

export function skipIntro() {
  teleport(ATRIUM_START, 0, ATRIUM_START.yaw);
  const s = store();
  s.setIntroSettled(true);
  if (!useAvatarStore.getState().chosen) {
    flightSkipped = true;
    s.setPhase("avatar");
    return;
  }
  s.setPhase("explore");
}

export function exitMall() {
  cancelNavigation();
  resetInput();
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  store().replayIntro();
}

export function liftDestination(floor: number) {
  return liftNodeId(floor);
}
