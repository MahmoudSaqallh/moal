import type { RoutePoint } from "@/types";
import { ELEVATOR, getEscalator, type EscalatorDef } from "@/data/layout";
import { floorY } from "@/data/floors";

/**
 * Geometry of vertical transport, shared by route planning, the ride systems and the
 * 3D models so they always agree.
 */

/** Horizontal speed while riding an escalator (m/s); real ones run ~0.5 m/s, this keeps it brisk. */
export const ESCALATOR_SPEED = 2.0;
/** Distance from the comb plate where boarding begins / ends. */
const LANDING = 0.9;

export interface LaneGeometry {
  escalatorId: string;
  direction: "up" | "down";
  /** Where the rider stands to board (on the boarding floor). */
  entry: RoutePoint;
  /** Start / end of the moving incline. */
  start: RoutePoint;
  end: RoutePoint;
  /** Where the rider steps off (on the arrival floor). */
  exit: RoutePoint;
  /** Unit travel direction on the XZ plane. */
  dirX: number;
}

export function laneGeometry(e: EscalatorDef, direction: "up" | "down"): LaneGeometry {
  const yBottom = floorY(e.fromFloor);
  const yTop = floorY(e.toFloor);
  if (direction === "up") {
    const z = e.upZ;
    return {
      escalatorId: e.id,
      direction,
      entry: { x: e.bottomX - LANDING, z, y: yBottom, floor: e.fromFloor },
      start: { x: e.bottomX, z, y: yBottom, floor: e.fromFloor },
      end: { x: e.topX, z, y: yTop, floor: e.toFloor },
      exit: { x: e.topX + LANDING, z, y: yTop, floor: e.toFloor },
      dirX: 1,
    };
  }
  const z = e.downZ;
  return {
    escalatorId: e.id,
    direction,
    entry: { x: e.topX + LANDING, z, y: yTop, floor: e.toFloor },
    start: { x: e.topX, z, y: yTop, floor: e.toFloor },
    end: { x: e.bottomX, z, y: yBottom, floor: e.fromFloor },
    exit: { x: e.bottomX - LANDING, z, y: yBottom, floor: e.fromFloor },
    dirX: -1,
  };
}

export function laneFor(escalatorId: string, direction: "up" | "down"): LaneGeometry | null {
  const e = getEscalator(escalatorId);
  return e ? laneGeometry(e, direction) : null;
}

/** Height of a rider at horizontal position x along a lane (clamped to the landings). */
export function laneHeightAt(lane: LaneGeometry, x: number): number {
  const t = (x - lane.start.x) / (lane.end.x - lane.start.x);
  const k = Math.max(0, Math.min(1, t));
  return lane.start.y + (lane.end.y - lane.start.y) * k;
}

/** Points describing a lift trip, for drawing routes. */
export function liftLegPoints(fromFloor: number, toFloor: number): RoutePoint[] {
  const cx = (ELEVATOR.cabin.minX + ELEVATOR.cabin.maxX) / 2;
  const cz = (ELEVATOR.cabin.minZ + ELEVATOR.cabin.maxZ) / 2;
  return [
    { x: ELEVATOR.call.x, z: ELEVATOR.call.z, y: floorY(fromFloor), floor: fromFloor },
    { x: cx, z: cz, y: floorY(fromFloor), floor: fromFloor },
    { x: cx, z: cz, y: floorY(toFloor), floor: toFloor },
    { x: ELEVATOR.call.x, z: ELEVATOR.call.z, y: floorY(toFloor), floor: toFloor },
  ];
}
