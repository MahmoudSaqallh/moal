import type { Facing, LocalObstacle, Rect, StoreConfig, Vec2, Circle } from "@/types";

/**
 * Store-local frame: local +X runs along the facade, local +Z points out of the store
 * into the public corridor, and the interior occupies local Z in [-depth, 0].
 * The yaw below rotates that frame so local +Z matches the store's facing direction.
 */
export function facingYaw(facing: Facing): number {
  switch (facing) {
    case "south":
      return 0; // local +Z -> world +Z
    case "north":
      return Math.PI; // local +Z -> world -Z
    case "east":
      return Math.PI / 2; // local +Z -> world +X
    case "west":
      return -Math.PI / 2; // local +Z -> world -X
  }
}

/** Rotate a local XZ vector by a yaw (same convention as THREE's rotation.y). */
export function rotateXZ(x: number, z: number, yaw: number): Vec2 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

export function localToWorld(store: Pick<StoreConfig, "origin" | "facing">, x: number, z: number): Vec2 {
  const r = rotateXZ(x, z, facingYaw(store.facing));
  // Snap away floating point noise from cos(PI/2) etc. so rects stay exact.
  return { x: round(store.origin.x + r.x), z: round(store.origin.z + r.z) };
}

/** Local yaw (rotation about +Y) converted to world yaw. */
export function localYawToWorld(store: Pick<StoreConfig, "facing">, yaw: number): number {
  return yaw + facingYaw(store.facing);
}

export function localRectToWorld(store: Pick<StoreConfig, "origin" | "facing">, rect: Rect): Rect {
  const a = localToWorld(store, rect.minX, rect.minZ);
  const b = localToWorld(store, rect.maxX, rect.maxZ);
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  };
}

export function localObstacleToWorld(
  store: Pick<StoreConfig, "origin" | "facing">,
  o: LocalObstacle,
): { circle?: Circle; rect?: Rect } {
  if (o.type === "circle") {
    const p = localToWorld(store, o.x, o.z);
    return { circle: { x: p.x, z: p.z, r: o.r } };
  }
  return { rect: localRectToWorld(store, o) };
}

/** Unit vector for a world yaw: the direction a camera with this yaw looks towards. */
export function yawForward(yaw: number): Vec2 {
  // THREE cameras look down -Z; rotating by yaw about Y gives (-sin, -cos).
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** World yaw for a camera at `from` that should look at `to`. */
export function yawTowards(from: Vec2, to: Vec2): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

export function rectContains(rect: Rect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

export function rectCenter(rect: Rect): Vec2 {
  return { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
