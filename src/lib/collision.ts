import type { Circle, Rect, Vec2 } from "@/types";
import { DIMENSIONS, ELEVATOR, FLOOR_COLLISION, type FloorCollision } from "@/data/layout";

/**
 * 2D collision against the authored floor plan, per level.
 *
 * Each level's walkable floor is a union of axis-aligned rectangles (corridors, galleries,
 * bridges, store interiors, doorways). A body of radius r is valid when its centre and its
 * four extreme points lie on walkable floor and it overlaps no obstacle. Movement resolves
 * per axis so the avatar slides along walls instead of sticking to them.
 */

/** Lift state as seen from one floor; supplied by the elevator system at runtime. */
export type LiftAccess = "closed" | "open" | "riding";

export interface CollisionOptions {
  radius?: number;
  /** How the lift shaft behaves for this query (defaults to closed: a solid obstacle). */
  lift?: LiftAccess;
}

function inAny(rects: readonly Rect[], x: number, z: number): boolean {
  for (const r of rects) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
  return false;
}

function onFloor(world: FloorCollision, lift: LiftAccess, x: number, z: number): boolean {
  if (lift === "riding") return inAny([ELEVATOR.cabin], x, z);
  if (inAny(world.walkable, x, z)) return true;
  return lift === "open" && inAny([ELEVATOR.cabin, ELEVATOR.doorway], x, z);
}

function hitsCircle(c: Circle, x: number, z: number, radius: number) {
  const dx = x - c.x;
  const dz = z - c.z;
  const rr = c.r + radius;
  return dx * dx + dz * dz < rr * rr;
}

function isLiftShaft(c: Circle) {
  return c.x === ELEVATOR.x && c.z === ELEVATOR.z;
}

export function isWalkable(floor: number, x: number, z: number, opts: CollisionOptions = {}): boolean {
  const world = FLOOR_COLLISION[floor];
  if (!world) return false;
  const radius = opts.radius ?? DIMENSIONS.playerRadius;
  const lift = opts.lift ?? "closed";
  if (
    !onFloor(world, lift, x, z) ||
    !onFloor(world, lift, x + radius, z) ||
    !onFloor(world, lift, x - radius, z) ||
    !onFloor(world, lift, x, z + radius) ||
    !onFloor(world, lift, x, z - radius)
  ) {
    return false;
  }
  for (const c of world.circles) {
    if (lift !== "closed" && isLiftShaft(c)) continue;
    if (hitsCircle(c, x, z, radius)) return false;
  }
  for (const r of world.rects) {
    const cx = Math.max(r.minX, Math.min(x, r.maxX));
    const cz = Math.max(r.minZ, Math.min(z, r.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return false;
  }
  return true;
}

/**
 * Move from `pos` by (dx, dz), sliding along blocking geometry.
 * Large moves are sub-stepped so fast frames can never tunnel through thin walls.
 */
export function moveWithCollision(floor: number, pos: Vec2, dx: number, dz: number, opts: CollisionOptions = {}): Vec2 {
  const radius = opts.radius ?? DIMENSIONS.playerRadius;
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / (radius * 0.5)));
  const sx = dx / steps;
  const sz = dz / steps;
  let x = pos.x;
  let z = pos.z;
  for (let i = 0; i < steps; i++) {
    if (isWalkable(floor, x + sx, z + sz, opts)) {
      x += sx;
      z += sz;
      continue;
    }
    const canX = isWalkable(floor, x + sx, z, opts);
    const canZ = isWalkable(floor, x, z + sz, opts);
    if (canX) x += sx;
    else if (canZ) z += sz;
    else break;
  }
  return { x, z };
}

/** True when a body can travel in a straight line from a to b on one floor. */
export function segmentClear(floor: number, a: Vec2, b: Vec2, opts: CollisionOptions = {}): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(len / 0.2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable(floor, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, opts)) return false;
  }
  return true;
}
