import type { RouteLeg } from "@/types";
import { ALL_ZONES } from "@/data/layout";
import type { LaneGeometry } from "./transit";
import { rectContains } from "./space";

/**
 * High-frequency mutable state shared between the render loop and lightweight UI readers
 * (minimap, compass, multiplayer sender). Kept outside React on purpose: writing this every
 * frame must never trigger re-renders. React-facing state lives in the Zustand stores.
 */

export type MoveMode = "walk" | "escalator" | "elevator";

export const player = {
  x: 0,
  z: 14,
  floor: 0,
  /** Current feet height (follows the floor, an escalator incline or the lift cabin). */
  y: 0,
  /** Direction the avatar's body faces. */
  yaw: 0,
  /** Camera orbit around the avatar (third person) or view direction (first person). */
  camYaw: 0,
  camPitch: 0.24,
  /** Desired boom length; the camera rig shortens it to avoid walls. */
  camDistance: 5.4,
  vx: 0,
  vz: 0,
  /** Planar speed, read by the avatar animation. */
  speed: 0,
  mode: "walk" as MoveMode,
  /** Active escalator ride. */
  ride: null as null | { lane: LaneGeometry; x: number },
  /** Timestamp of the last interaction gesture (drives the avatar's reach animation). */
  gestureAt: -10,
};

export const input = {
  forward: 0, // -1..1  (W/S, joystick Y)
  strafe: 0, // -1..1  (A/D, joystick X)
  sprint: false,
  /** Accumulated look deltas in radians, consumed each frame. */
  lookYaw: 0,
  lookPitch: 0,
  /** Keyboard turning (arrow keys), -1..1. */
  turn: 0,
  /** Camera zoom delta (wheel / pinch), consumed each frame. */
  zoom: 0,
  /** Pixel distance of the current pointer drag; used to tell clicks from drags. */
  dragDistance: 0,
  pointerLocked: false,
};

/** Product inspection view: turntable yaw for small goods, camera orbit for floor pieces. */
export const inspectView = {
  yaw: 0,
  pitch: 0,
  /** Zoom multiplier on the focus distance (0.55 â€“ 1.6). */
  zoom: 1,
  /** True while the visitor is dragging; pauses the idle turntable. */
  dragging: false,
  lastInteraction: 0,
};

export function resetInspectView() {
  inspectView.yaw = 0;
  inspectView.pitch = 0;
  inspectView.zoom = 1;
  inspectView.dragging = false;
  inspectView.lastInteraction = 0;
}

/** Keys currently held. Separate from `input` so joystick and keyboard can combine. */
export const keys = new Set<string>();

export function resetInput() {
  input.forward = 0;
  input.strafe = 0;
  input.sprint = false;
  input.lookYaw = 0;
  input.lookPitch = 0;
  input.turn = 0;
  input.zoom = 0;
  keys.clear();
}

export function findZone(floor: number, x: number, z: number) {
  for (const zone of ALL_ZONES) {
    if (zone.floor === floor && rectContains(zone.rect, x, z)) return zone;
  }
  return null;
}

// â”€â”€â”€ Autopilot (guided navigation along a planned route) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AutopilotState {
  legs: RouteLeg[];
  legIndex: number;
  pointIndex: number;
  /** Yaw to settle into on arrival. */
  finalYaw: number | null;
  /** Lift sub-step while a lift leg is active. */
  liftStep: "approach" | "wait" | "board" | "ride" | "exit";
  onArrive: (() => void) | null;
}

export const autopilot: { state: AutopilotState | null } = { state: null };

export function startAutopilot(legs: RouteLeg[], finalYaw: number | null, onArrive?: () => void) {
  autopilot.state = { legs, legIndex: 0, pointIndex: 1, finalYaw, liftStep: "approach", onArrive: onArrive ?? null };
}

export function cancelAutopilot() {
  autopilot.state = null;
}
