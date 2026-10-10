import type { Rect } from "@/types";
import { ELEVATOR } from "@/data/layout";
import { FLOOR_COUNT, floorY } from "@/data/floors";
import type { LiftAccess } from "./collision";

/**
 * The panoramic lift as a deterministic state machine (no rendering, no React):
 * calls and cabin selections queue stops, the cabin accelerates/decelerates between
 * levels, and doors open, dwell and close. The 3D model, collision and UI all read it.
 */

export type DoorState = "open" | "opening" | "closing" | "closed";

export interface LiftState {
  /** Cabin floor height (m). */
  y: number;
  /** Last level the cabin stopped at (or is passing). */
  floor: number;
  velocity: number;
  queue: number[];
  doorState: DoorState;
  /** 0 = closed, 1 = fully open. */
  doors: number;
  /** Seconds left before the doors start closing. */
  dwell: number;
  /** Something stands in the doorway (keeps doors open). */
  blocked: boolean;
}

export const LIFT_SPEED = 2.4;
const ACCEL = 1.6;
const DOOR_TIME = 0.9;
const DWELL = 4;

export function createLift(floor = 0): LiftState {
  return { y: floorY(floor), floor, velocity: 0, queue: [], doorState: "closed", doors: 0, dwell: 0, blocked: false };
}

export const lift: LiftState = createLift(0);

function isStoppedAt(s: LiftState, floor: number) {
  return Math.abs(s.y - floorY(floor)) < 0.01 && s.velocity === 0;
}

/** Request a stop (hall call or cabin button). Re-opens the doors if already there. */
export function requestFloor(s: LiftState, floor: number) {
  if (floor < 0 || floor >= FLOOR_COUNT || !Number.isInteger(floor)) return;
  if (isStoppedAt(s, floor) && !s.queue.length) {
    if (s.doorState === "closed" || s.doorState === "closing") s.doorState = "opening";
    s.dwell = DWELL;
    return;
  }
  if (!s.queue.includes(floor)) s.queue.push(floor);
}

export function stepLift(s: LiftState, dt: number) {
  // Doors
  if (s.doorState === "opening") {
    s.doors = Math.min(1, s.doors + dt / DOOR_TIME);
    if (s.doors >= 1) {
      s.doorState = "open";
      s.dwell = DWELL;
    }
  } else if (s.doorState === "open") {
    s.dwell -= s.blocked ? 0 : dt;
    if (s.dwell <= 0) s.doorState = "closing";
  } else if (s.doorState === "closing") {
    if (s.blocked) {
      s.doorState = "opening";
    } else {
      s.doors = Math.max(0, s.doors - dt / DOOR_TIME);
      if (s.doors <= 0) s.doorState = "closed";
    }
  }

  // Travel (only with doors shut)
  if (s.doorState !== "closed" || !s.queue.length) return;
  const target = floorY(s.queue[0]);
  const delta = target - s.y;
  const dir = Math.sign(delta);
  if (dir === 0) {
    arrive(s);
    return;
  }
  // Trapezoidal profile: brake when the remaining distance needs it.
  const brakeDist = (s.velocity * s.velocity) / (2 * ACCEL);
  const speed = Math.abs(s.velocity);
  const wantStop = Math.abs(delta) <= brakeDist + 0.02;
  const next = wantStop ? Math.max(0.25, speed - ACCEL * dt) : Math.min(LIFT_SPEED, speed + ACCEL * dt);
  s.velocity = next * dir;
  const step = s.velocity * dt;
  if (Math.abs(step) >= Math.abs(delta)) {
    s.y = target;
    arrive(s);
  } else {
    s.y += step;
    s.floor = Math.round(s.y / floorY(1));
  }
}

function arrive(s: LiftState) {
  s.velocity = 0;
  s.floor = s.queue.shift() ?? s.floor;
  s.doorState = "opening";
}

export function isMoving(s: LiftState) {
  return s.velocity !== 0;
}

function inRect(r: Rect, x: number, z: number) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function inCabin(x: number, z: number) {
  return inRect(ELEVATOR.cabin, x, z);
}

/** How the shaft behaves for a visitor on `floor` at (x, z). */
export function liftAccess(s: LiftState, floor: number, x: number, z: number): LiftAccess {
  const here = isStoppedAt(s, floor);
  if (inCabin(x, z) || inRect(ELEVATOR.doorway, x, z)) {
    if (here && s.doors > 0.8) return "open";
    return "riding";
  }
  return here && s.doors > 0.8 ? "open" : "closed";
}
