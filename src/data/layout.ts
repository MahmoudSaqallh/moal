import type { Circle, Rect, Zone } from "@/types";
import { STORES } from "./stores";
import { FACADE_THICKNESS, getStoreLayout } from "./storeLayouts";
import { FLOOR_COUNT, ROOF_HEIGHT, CEILING_HEIGHT } from "./floors";
import { localObstacleToWorld, localRectToWorld } from "@/lib/space";

/**
 * MALLVERSE FLOOR PLAN — three levels sharing one plan (metres)
 *
 *                       ┌──────────────┐
 *                       │  north slot  │  z -52..-38  (L3: Atrium Roasters)
 *                       ├──────────────┤
 *                       │ North court  │  z -38..-16  L1 Garden · L2 Showroom · L3 Food court
 *   ┌────────┬──────────┼──────────────┼──────────┬───────┐
 *   │ west   │ West wing│   Atrium     │ East wing│ end   │  corridors z -6..6
 *   │ end    │          │  (void ↑↑)   │ (void ↑↑)│       │  upper levels: walkways z ±(2.5..6)
 *   └────────┴──────────┼──────────────┼──────────┴───────┘
 *                       │Entrance hall │  z 16..34 (L1 only, double height)
 *                       └──────────────┘
 *
 * Vertical circulation:
 *  - Escalator A (L1→L2) and B (L2→L3) scissor along the east-wing void.
 *  - A panoramic lift on the west edge of the atrium void serves all three levels.
 *
 * Rendering, collision, wayfinding, the minimap and the AI assistant all read this file.
 */

export const DIMENSIONS = {
  eyeHeight: 1.65,
  playerRadius: 0.32,
  galleryHeight: CEILING_HEIGHT,
  atriumRoof: ROOF_HEIGHT,
  wingRoof: ROOF_HEIGHT,
  entranceFacadeZ: 34,
} as const;

/** Ground-level public areas. */
export const AREAS = {
  entrance: { minX: -12, maxX: 12, minZ: 16, maxZ: 33.4 },
  atrium: { minX: -16, maxX: 16, minZ: -16, maxZ: 16 },
  eastWing: { minX: 16, maxX: 60, minZ: -6, maxZ: 6 },
  westWing: { minX: -60, maxX: -16, minZ: -6, maxZ: 6 },
  northCourt: { minX: -10, maxX: 10, minZ: -38, maxZ: -16 },
} as const satisfies Record<string, Rect>;

/** Open to the skylight above the ground floor. */
export const ATRIUM_VOID: Rect = { minX: -11, maxX: 11, minZ: -11, maxZ: 11 };
export const WING_VOID_HALF_WIDTH = 2.5;
export const WING_VOIDS: readonly Rect[] = [
  { minX: 16, maxX: 60, minZ: -2.5, maxZ: 2.5 },
  { minX: -60, maxX: -16, minZ: -2.5, maxZ: 2.5 },
];

/** Upper-level gallery ring around the atrium void. */
export const GALLERY_RING: readonly Rect[] = [
  { minX: -16, maxX: 16, minZ: -16, maxZ: -11 },
  { minX: -16, maxX: 16, minZ: 11, maxZ: 16 },
  { minX: -16, maxX: -11, minZ: -11, maxZ: 11 },
  { minX: 11, maxX: 16, minZ: -11, maxZ: 11 },
];

/** Upper-level walkways along the wing storefronts. */
export const WALKWAYS: readonly Rect[] = [
  { minX: 16, maxX: 60, minZ: -6, maxZ: -2.5 },
  { minX: 16, maxX: 60, minZ: 2.5, maxZ: 6 },
  { minX: -60, maxX: -16, minZ: -6, maxZ: -2.5 },
  { minX: -60, maxX: -16, minZ: 2.5, maxZ: 6 },
];

/** Bridges spanning the wing voids, per upper level. */
export const BRIDGES: Record<number, readonly Rect[]> = {
  1: [
    { minX: 36.5, maxX: 39.5, minZ: -2.5, maxZ: 2.5 },
    { minX: -39.5, maxX: -36.5, minZ: -2.5, maxZ: 2.5 },
    { minX: 57, maxX: 60, minZ: -2.5, maxZ: 2.5 },
    { minX: -60, maxX: -57, minZ: -2.5, maxZ: 2.5 },
  ],
  2: [
    { minX: 49.5, maxX: 52.5, minZ: -2.5, maxZ: 2.5 },
    { minX: -39.5, maxX: -36.5, minZ: -2.5, maxZ: 2.5 },
    { minX: 57, maxX: 60, minZ: -2.5, maxZ: 2.5 },
    { minX: -60, maxX: -57, minZ: -2.5, maxZ: 2.5 },
  ],
};

export const FOUNTAIN = { x: 0, z: 0, basinRadius: 4.2, planterRadius: 5 } as const;

export const ATRIUM_COLUMNS: readonly { x: number; z: number }[] = [
  { x: -11, z: -11 },
  { x: 11, z: -11 },
  { x: -11, z: 11 },
  { x: 11, z: 11 },
];

// ─── Vertical circulation ───────────────────────────────────────────────

export interface EscalatorDef {
  id: string;
  label: string;
  fromFloor: number;
  toFloor: number;
  /** X where the incline meets the lower / upper floor (travel is along +X when rising). */
  bottomX: number;
  topX: number;
  /** Lane centre lines (Z). */
  upZ: number;
  downZ: number;
  /** Half width of the pair including balustrades. */
  halfWidth: number;
}

export const ESCALATORS: readonly EscalatorDef[] = [
  { id: "esc-a", label: "Escalator A", fromFloor: 0, toFloor: 1, bottomX: 26.5, topX: 36.5, upZ: -0.8, downZ: 0.8, halfWidth: 1.7 },
  { id: "esc-b", label: "Escalator B", fromFloor: 1, toFloor: 2, bottomX: 39.5, topX: 49.5, upZ: -0.8, downZ: 0.8, halfWidth: 1.7 },
];

export function getEscalator(id: string) {
  return ESCALATORS.find((e) => e.id === id);
}

/** Panoramic lift attached to the west edge of the atrium void; doors face west. */
export const ELEVATOR = {
  id: "lift",
  x: -9.6,
  z: -6,
  r: 1.35,
  /** Inside the cabin (walkable while the visitor rides or boards). */
  cabin: { minX: -10.55, maxX: -8.65, minZ: -6.95, maxZ: -5.05 } as Rect,
  /** Gap through the shaft wall, open only when the doors are. */
  doorway: { minX: -11.6, maxX: -10.4, minZ: -6.6, maxZ: -5.4 } as Rect,
  /** Where visitors wait and press the call button. */
  call: { x: -12.3, z: -6 },
  floors: [0, 1, 2],
} as const;

export const INFO_DESK = { x: 12.2, z: 7.4, r: 1.9 } as const;
export const ATRIUM_CAFE: Rect = { minX: -14.6, maxX: -6.6, minZ: 4.2, maxZ: 13.6 };

export interface PlanterTree {
  x: number;
  z: number;
  r: number;
  floor: number;
  height: number;
}

export const PLANTER_TREES: readonly PlanterTree[] = [
  // Atrium
  { x: -13.6, z: -1.8, r: 1.1, floor: 0, height: 6.4 },
  { x: 13.8, z: 3.4, r: 1.1, floor: 0, height: 6.4 },
  // Entrance hall
  { x: -9.2, z: 21, r: 1.0, floor: 0, height: 5.6 },
  { x: -9.2, z: 28, r: 1.0, floor: 0, height: 5.6 },
  { x: 9.2, z: 21, r: 1.0, floor: 0, height: 5.6 },
  { x: 9.2, z: 28, r: 1.0, floor: 0, height: 5.6 },
  // Ground-floor wings, against walls between storefronts
  { x: 20.4, z: 4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: 29.6, z: 4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: 47, z: -4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: 53, z: -4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: -20.4, z: -4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: -43, z: -4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: -51, z: -4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: -29.6, z: 4.9, r: 0.75, floor: 0, height: 3.4 },
  { x: -20.4, z: 4.9, r: 0.75, floor: 0, height: 3.4 },
  // Courts
  { x: -6.2, z: -18.6, r: 0.9, floor: 0, height: 4.2 },
  { x: 6.2, z: -18.6, r: 0.9, floor: 0, height: 4.2 },
  { x: -7.8, z: -36, r: 0.8, floor: 1, height: 3.6 },
  { x: 7.8, z: -36, r: 0.8, floor: 1, height: 3.6 },
  { x: -8.6, z: -18, r: 0.8, floor: 2, height: 3.8 },
  { x: 8.6, z: -18, r: 0.8, floor: 2, height: 3.8 },
  // Upper-level gallery corners
  { x: -14.6, z: 14.6, r: 0.7, floor: 1, height: 3 },
  { x: 14.6, z: 14.6, r: 0.7, floor: 1, height: 3 },
  { x: -14.6, z: 14.6, r: 0.7, floor: 2, height: 3 },
  { x: 14.6, z: 14.6, r: 0.7, floor: 2, height: 3 },
];

export const BENCHES: readonly { x: number; z: number; rotY: number; floor: number }[] = [
  { x: 25, z: 5.0, rotY: Math.PI, floor: 0 },
  { x: -47, z: -5.0, rotY: 0, floor: 0 },
  { x: -25, z: 5.0, rotY: Math.PI, floor: 0 },
  { x: -10.6, z: 24.5, rotY: Math.PI / 2, floor: 0 },
  { x: 10.6, z: 24.5, rotY: -Math.PI / 2, floor: 0 },
  { x: -6, z: 14.9, rotY: Math.PI, floor: 1 },
  { x: 6, z: 14.9, rotY: Math.PI, floor: 2 },
];
export const BENCH_SIZE = { length: 3.2, depth: 0.9 } as const;

export const DIRECTORY_KIOSKS: readonly { id: string; x: number; z: number; rotY: number; label: string; floor: number }[] = [
  { id: "kiosk-entrance", x: 4.8, z: 23, rotY: 0, label: "Entrance Hall directory", floor: 0 },
  { id: "kiosk-east", x: 18.6, z: -4.6, rotY: -Math.PI / 2, label: "Fashion Avenue directory", floor: 0 },
  { id: "kiosk-west", x: -18.6, z: 4.6, rotY: Math.PI / 2, label: "Lifestyle Walk directory", floor: 0 },
  { id: "kiosk-court", x: 8.6, z: -17.4, rotY: -Math.PI / 2, label: "Garden Court directory", floor: 0 },
  { id: "kiosk-l2", x: 3.6, z: 15.0, rotY: Math.PI, label: "Level 2 directory", floor: 1 },
  { id: "kiosk-l3", x: -3.6, z: 15.0, rotY: Math.PI, label: "Level 3 directory", floor: 2 },
];

export const EAST_LOUNGE: Rect = { minX: 53.6, maxX: 59.4, minZ: -3.6, maxZ: 3.6 };

/** Seating blocks per floor (café tables, food court, showroom plinths). */
export const COURT_FIXTURES: Record<number, readonly Rect[]> = {
  0: [
    { minX: -9.4, maxX: -3.2, minZ: -35, maxZ: -21 },
    { minX: 3.2, maxX: 9.4, minZ: -35, maxZ: -21 },
  ],
  1: [
    { minX: -8, maxX: -3.4, minZ: -31, maxZ: -22 },
    { minX: 3.4, maxX: 8, minZ: -31, maxZ: -22 },
  ],
  2: [
    { minX: -9.4, maxX: -3.0, minZ: -34, maxZ: -21 },
    { minX: 3.0, maxX: 9.4, minZ: -34, maxZ: -21 },
  ],
};
/** Back-compat alias for the ground-floor court seating. */
export const CAFE_SEATING = COURT_FIXTURES[0];

// ─── Zones ──────────────────────────────────────────────────────────────

const PUBLIC_ZONE_DEFS: { id: string; floor: number; name: string; rect: Rect }[] = [
  { id: "entrance", floor: 0, name: "Entrance Hall", rect: AREAS.entrance },
  { id: "atrium", floor: 0, name: "Central Atrium", rect: AREAS.atrium },
  { id: "east-wing", floor: 0, name: "Fashion Avenue", rect: AREAS.eastWing },
  { id: "west-wing", floor: 0, name: "Lifestyle Walk", rect: AREAS.westWing },
  { id: "north-court", floor: 0, name: "Garden Court", rect: AREAS.northCourt },
  { id: "atrium", floor: 1, name: "Atrium Gallery", rect: AREAS.atrium },
  { id: "east-wing", floor: 1, name: "Game Street", rect: AREAS.eastWing },
  { id: "west-wing", floor: 1, name: "Tech Gallery", rect: AREAS.westWing },
  { id: "north-court", floor: 1, name: "Showroom Court", rect: AREAS.northCourt },
  { id: "atrium", floor: 2, name: "Sky Gallery", rect: AREAS.atrium },
  { id: "east-wing", floor: 2, name: "Dining Terrace", rect: AREAS.eastWing },
  { id: "west-wing", floor: 2, name: "Noodle Lane", rect: AREAS.westWing },
  { id: "north-court", floor: 2, name: "Food Court", rect: AREAS.northCourt },
];

const FLOOR_THEMES = ["Fashion & Lifestyle", "Technology & Entertainment", "Food & Leisure"];

export const PUBLIC_ZONES: readonly Zone[] = PUBLIC_ZONE_DEFS.map((z) => ({
  id: `${z.id}@${z.floor}`,
  name: z.name,
  subtitle: `Level ${z.floor + 1} · ${FLOOR_THEMES[z.floor]}`,
  rect: z.rect,
  floor: z.floor,
  kind: "public",
}));

// ─── Derived store geometry ─────────────────────────────────────────────

export interface StoreFootprint {
  storeId: string;
  floor: number;
  /** Interior floor (world). */
  interior: Rect;
  /** Walkable part of the interior (inside the facade). */
  walkable: Rect;
  /** Opening through the facade wall. */
  doorway: Rect;
}

export const STORE_FOOTPRINTS: readonly StoreFootprint[] = STORES.map((store) => {
  const half = store.width / 2;
  return {
    storeId: store.id,
    floor: store.floor,
    interior: localRectToWorld(store, { minX: -half, maxX: half, minZ: -store.depth, maxZ: 0 }),
    walkable: localRectToWorld(store, {
      minX: -half + 0.2,
      maxX: half - 0.2,
      minZ: -store.depth + 0.2,
      maxZ: -FACADE_THICKNESS,
    }),
    doorway: localRectToWorld(store, {
      minX: -store.doorWidth / 2 + 0.1,
      maxX: store.doorWidth / 2 - 0.1,
      minZ: -0.9,
      maxZ: 0.9,
    }),
  };
});

export const STORE_ZONES: readonly Zone[] = STORES.map((store, i) => ({
  id: `store:${store.id}`,
  name: store.name,
  subtitle: `${store.categoryLabel} · Level ${store.floor + 1}`,
  rect: STORE_FOOTPRINTS[i].interior,
  floor: store.floor,
  kind: "store",
  storeId: store.id,
}));

/** Store zones first so a visitor standing in a doorway still reads as "inside". */
export const ALL_ZONES: readonly Zone[] = [...STORE_ZONES, ...PUBLIC_ZONES];

// ─── Collision worlds (one per floor) ──────────────────────────────────

export interface FloorCollision {
  walkable: Rect[];
  circles: Circle[];
  rects: Rect[];
}

function benchRect(b: { x: number; z: number; rotY: number }): Rect {
  const alongX = Math.abs(Math.sin(b.rotY)) < 0.5;
  const hx = (alongX ? BENCH_SIZE.length : BENCH_SIZE.depth) / 2;
  const hz = (alongX ? BENCH_SIZE.depth : BENCH_SIZE.length) / 2;
  return { minX: b.x - hx, maxX: b.x + hx, minZ: b.z - hz, maxZ: b.z + hz };
}

function escalatorFootprint(e: EscalatorDef): Rect {
  return { minX: e.bottomX, maxX: e.topX, minZ: -e.halfWidth, maxZ: e.halfWidth };
}

function buildFloor(floor: number): FloorCollision {
  const walkable: Rect[] =
    floor === 0
      ? [...Object.values(AREAS)]
      : [...GALLERY_RING, ...WALKWAYS, ...(BRIDGES[floor] ?? []), AREAS.northCourt];
  const circles: Circle[] = [];
  const rects: Rect[] = [];

  // Stores on this floor
  STORES.forEach((store, i) => {
    if (store.floor !== floor) return;
    walkable.push(STORE_FOOTPRINTS[i].walkable, STORE_FOOTPRINTS[i].doorway);
    for (const o of getStoreLayout(store).obstacles) {
      const w = localObstacleToWorld(store, o);
      if (w.circle) circles.push(w.circle);
      if (w.rect) rects.push(w.rect);
    }
  });

  // Structure present on every floor
  circles.push({ x: ELEVATOR.x, z: ELEVATOR.z, r: ELEVATOR.r + 0.1 });
  if (floor === 0) {
    circles.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: FOUNTAIN.planterRadius });
    ATRIUM_COLUMNS.forEach((c) => circles.push({ x: c.x, z: c.z, r: 0.65 }));
    circles.push({ x: INFO_DESK.x, z: INFO_DESK.z, r: INFO_DESK.r });
    rects.push(ATRIUM_CAFE, EAST_LOUNGE);
  } else {
    // Columns stand at the void corners and pass through the gallery slab.
    ATRIUM_COLUMNS.forEach((c) => circles.push({ x: c.x, z: c.z, r: 0.65 }));
  }
  // Escalator truss blocks the ground under its incline on its lower floor.
  for (const e of ESCALATORS) if (e.fromFloor === floor) rects.push(escalatorFootprint(e));

  for (const t of PLANTER_TREES) if (t.floor === floor) circles.push({ x: t.x, z: t.z, r: t.r });
  for (const k of DIRECTORY_KIOSKS) if (k.floor === floor) circles.push({ x: k.x, z: k.z, r: 0.55 });
  for (const b of BENCHES) if (b.floor === floor) rects.push(benchRect(b));
  rects.push(...(COURT_FIXTURES[floor] ?? []));

  return { walkable, circles, rects };
}

export const FLOOR_COLLISION: readonly FloorCollision[] = Array.from({ length: FLOOR_COUNT }, (_, f) => buildFloor(f));

/**
 * Open space a camera may occupy on a floor: walkable floor plus the voids (open air).
 * Used by the third-person camera to avoid pushing through walls.
 */
export const CAMERA_SPACE: readonly Rect[][] = Array.from({ length: FLOOR_COUNT }, (_, f) => [
  ...FLOOR_COLLISION[f].walkable,
  ...(f === 0 ? [] : [ATRIUM_VOID, ...WING_VOIDS]),
  ...(f === 0 ? [...WING_VOIDS] : []),
  ELEVATOR.cabin,
]);

/** Overall extents used by the minimap. */
export const MAP_BOUNDS: Rect = { minX: -78, maxX: 62, minZ: -54, maxZ: 36 };
