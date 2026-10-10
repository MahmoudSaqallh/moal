import type { InteriorKind, LocalObstacle, ProductSlot, StoreConfig } from "@/types";
import { getStoreProducts } from "./products";

/**
 * Interior layouts in store-local space (see `lib/space.ts`):
 *   local X runs along the facade, interior spans local Z in [-depth, 0], door centred on X = 0.
 *
 * Every 3D fixture that blocks movement is mirrored here as an obstacle so collision,
 * wayfinding and the rendered scene stay in sync. Product slots decide where each
 * catalogue item sits and from which side a shopper looks at it.
 */

export interface DisplayWindow {
  minX: number;
  maxX: number;
  /** "niche" windows have a lit backdrop (fashion), "open" windows show the interior. */
  kind: "niche" | "open";
}

export interface StoreLayout {
  obstacles: LocalObstacle[];
  slots: ProductSlot[];
  windows: DisplayWindow[];
  /** Local point just inside the door, where guided entry ends. */
  entryPoint: { x: number; z: number };
  /** Local point the visitor faces after entering. */
  entryLook: { x: number; z: number };
}

const FACADE_THICKNESS = 0.35;
export const WINDOW_SILL_DEPTH = { niche: 1.6, open: 0.9 } as const;
export { FACADE_THICKNESS };

/** Lumen halo centre (shared with the 3D interior). */
export const LUMEN_CENTER = { x: 0, z: -7.6 };
export const LUMEN_TABLE_RADIUS = 4.6;
export const LUMEN_TABLE_ANGLES = [35, 145, 215, 325].map((d) => (d * Math.PI) / 180);

export function lumenTable(i: number) {
  const a = LUMEN_TABLE_ANGLES[i];
  return {
    x: LUMEN_CENTER.x + Math.cos(a) * LUMEN_TABLE_RADIUS,
    z: LUMEN_CENTER.z + Math.sin(a) * LUMEN_TABLE_RADIUS,
    /** Long axis tangent to the ring. */
    rotY: -a - Math.PI / 2,
    /** Shoppers stand outside the ring looking in. */
    viewYaw: Math.PI / 2 - a,
  };
}

function windowsFor(store: StoreConfig, kind: DisplayWindow["kind"]): DisplayWindow[] {
  const half = store.width / 2;
  const gap = store.doorWidth / 2 + 1.1;
  return [
    { minX: -half + 1, maxX: -gap, kind },
    { minX: gap, maxX: half - 1, kind },
  ];
}

function windowObstacles(windows: DisplayWindow[]): LocalObstacle[] {
  return windows.map((w) => ({
    type: "rect" as const,
    minX: w.minX - 0.1,
    maxX: w.maxX + 0.1,
    minZ: -WINDOW_SILL_DEPTH[w.kind],
    maxZ: 0,
  }));
}

const BUILDERS: Partial<Record<InteriorKind, (store: StoreConfig) => StoreLayout>> = {
  lumen(store) {
    const windows = windowsFor(store, "open");
    const tables = [0, 1, 2, 3].map(lumenTable);
    const ids = ["lumen-aero-phone", "lumen-slate-laptop", "lumen-halo-headphones", "lumen-orbit-watch"];
    return {
      windows,
      entryPoint: { x: 0, z: -2.2 },
      entryLook: LUMEN_CENTER,
      obstacles: [
        ...windowObstacles(windows),
        { type: "circle", x: LUMEN_CENTER.x, z: LUMEN_CENTER.z, r: 1.75 },
        ...tables.map((t) => ({ type: "circle" as const, x: t.x, z: t.z, r: 1.45 })),
        // Perimeter display counters (back + sides).
        { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -13.0 },
        { type: "rect", minX: -9, maxX: -8.1, minZ: -13, maxZ: -2.2 },
        { type: "rect", minX: 8.1, maxX: 9, minZ: -13, maxZ: -2.2 },
      ],
      slots: [
        ...tables.map((t, i) => ({
          productId: ids[i],
          x: t.x,
          y: 0.93,
          z: t.z,
          rotY: t.viewYaw,
          viewYaw: t.viewYaw,
          viewDistance: [0.6, 0.95, 0.75, 0.5][i],
        })),
        { productId: "lumen-canvas-tablet", x: -3.2, y: 0.93, z: -13.35, rotY: 0, viewYaw: 0, viewDistance: 0.8 },
        { productId: "lumen-pillar-speaker", x: 3.2, y: 0.93, z: -13.35, rotY: 0, viewYaw: 0, viewDistance: 0.85 },
      ],
    };
  },

  boutique(store) {
    const windows = windowsFor(store, "niche");
    return {
      windows,
      entryPoint: { x: 0, z: -2.4 },
      entryLook: { x: 0, z: -11 },
      obstacles: [
        ...windowObstacles(windows),
        { type: "rect", minX: -2.3, maxX: 2.3, minZ: -7.8, maxZ: -5.2 }, // central table
        { type: "circle", x: -4.5, z: -9.5, r: 0.85 },
        { type: "circle", x: 4.5, z: -9.5, r: 0.85 },
        { type: "circle", x: 0, z: -11.6, r: 0.85 },
        { type: "rect", minX: -9, maxX: -7.7, minZ: -12.6, maxZ: -2.0 }, // left rail
        { type: "rect", minX: 7.7, maxX: 9, minZ: -12.6, maxZ: -2.0 }, // right rail
        { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -13.1 }, // back shelving
      ],
      slots: [
        { productId: "elan-cashmere-knit", x: 0, y: 0.88, z: -6.5, rotY: 0, viewYaw: 0, viewDistance: 1.0 },
        { productId: "elan-wool-coat", x: -4.5, y: 0.22, z: -9.5, rotY: 0.35, viewYaw: 0.35, viewDistance: 2.4 },
        { productId: "elan-silk-dress", x: 4.5, y: 0.22, z: -9.5, rotY: -0.35, viewYaw: -0.35, viewDistance: 2.4 },
        { productId: "elan-trench", x: 0, y: 0.22, z: -11.6, rotY: 0, viewYaw: 0, viewDistance: 2.6 },
      ],
    };
  },

  jewel(store) {
    const windows = windowsFor(store, "niche");
    return {
      windows,
      entryPoint: { x: 0, z: -2.4 },
      entryLook: { x: 0, z: -13 },
      obstacles: [
        ...windowObstacles(windows),
        { type: "rect", minX: -6.2, maxX: -2.8, minZ: -7.1, maxZ: -5.9 },
        { type: "rect", minX: 2.8, maxX: 6.2, minZ: -7.1, maxZ: -5.9 },
        { type: "circle", x: 0, z: -9.6, r: 0.95 },
        { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -13.0 },
        { type: "rect", minX: -9, maxX: -8.0, minZ: -11.2, maxZ: -6.8 },
        { type: "rect", minX: 8.0, maxX: 9, minZ: -11.2, maxZ: -6.8 },
      ],
      slots: [
        { productId: "aurelia-arc-bag", x: 0, y: 1.68, z: -13.35, rotY: 0, viewYaw: 0, viewDistance: 1.1 },
        { productId: "aurelia-meridian-watch", x: -4.5, y: 1.02, z: -6.5, rotY: 0, viewYaw: 0, viewDistance: 0.5 },
        { productId: "aurelia-solstice-necklace", x: 4.5, y: 1.02, z: -6.5, rotY: 0, viewYaw: 0, viewDistance: 0.7 },
        { productId: "aurelia-noon-sunglasses", x: 0, y: 1.02, z: -9.6, rotY: 0, viewYaw: 0, viewDistance: 0.55 },
        {
          productId: "aurelia-ambre-perfume",
          x: -8.4,
          y: 1.52,
          z: -9,
          rotY: Math.PI / 2,
          viewYaw: Math.PI / 2,
          viewDistance: 0.6,
        },
      ],
    };
  },

  sneaker(store) {
    const windows = windowsFor(store, "open");
    return {
      windows,
      entryPoint: { x: 0, z: -2.4 },
      entryLook: { x: 0, z: -13 },
      obstacles: [
        ...windowObstacles(windows),
        { type: "rect", minX: 7.9, maxX: 9, minZ: -13, maxZ: -2.2 }, // right shelf wall
        { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -13.0 }, // back shelf wall
        { type: "rect", minX: -9, maxX: -7.1, minZ: -12.2, maxZ: -2.6 }, // stepped plinths
        { type: "rect", minX: -2.9, maxX: 2.9, minZ: -8.5, maxZ: -6.5 }, // curved bench
        { type: "circle", x: -3.5, z: -10.6, r: 0.8 }, // hero plinth
      ],
      slots: [
        { productId: "stride-arc-runner", x: -3.5, y: 0.78, z: -10.6, rotY: 0.5, viewYaw: 0.35, viewDistance: 0.8 },
        {
          productId: "stride-court-low",
          x: 8.6,
          y: 1.31,
          z: -5.8,
          rotY: -Math.PI / 2,
          viewYaw: -Math.PI / 2,
          viewDistance: 0.8,
        },
        { productId: "stride-trail-mid", x: 2.2, y: 1.31, z: -13.65, rotY: 0, viewYaw: 0, viewDistance: 0.8 },
        {
          productId: "stride-slip-on",
          x: -7.5,
          y: 0.62,
          z: -6.2,
          rotY: Math.PI / 2,
          viewYaw: Math.PI / 2,
          viewDistance: 0.85,
        },
      ],
    };
  },

  showroom(store) {
    const windows = windowsFor(store, "open");
    return {
      windows,
      entryPoint: { x: 0, z: -2.4 },
      entryLook: { x: -2.5, z: -9 },
      obstacles: [
        ...windowObstacles(windows),
        { type: "rect", minX: -5.7, maxX: -3.9, minZ: -9.4, maxZ: -6.6 }, // sofa
        { type: "circle", x: -2.6, z: -8, r: 0.65 }, // coffee table
        { type: "circle", x: -0.6, z: -9.7, r: 0.65 }, // lounge chair
        { type: "circle", x: -5.0, z: -10.9, r: 0.4 }, // floor lamp
        { type: "rect", minX: 3.5, maxX: 4.9, minZ: -8.3, maxZ: -3.7 }, // plinths
        { type: "rect", minX: 0, maxX: 3.2, minZ: -13.5, maxZ: -11.4 }, // dining table
        { type: "rect", minX: -6, maxX: 6, minZ: -16, maxZ: -15.0 }, // shelving wall
        { type: "rect", minX: 5.2, maxX: 6, minZ: -14, maxZ: -9.2 }, // side shelf
      ],
      slots: [
        {
          productId: "casa-curve-sofa",
          x: -4.8,
          y: 0,
          z: -8,
          rotY: Math.PI / 2,
          viewYaw: Math.PI / 2,
          viewDistance: 3.2,
        },
        {
          productId: "casa-lounge-chair",
          x: -0.6,
          y: 0,
          z: -9.7,
          rotY: -Math.PI / 4,
          viewYaw: -Math.PI / 4 + 0.2,
          viewDistance: 2.2,
        },
        {
          productId: "casa-arc-lamp",
          x: -5.0,
          y: 0,
          z: -10.9,
          rotY: Math.PI / 2,
          viewYaw: Math.PI / 2 - 0.35,
          viewDistance: 3.2,
        },
        {
          productId: "casa-ceramic-vase",
          x: 4.2,
          y: 0.8,
          z: -6,
          rotY: -Math.PI / 2,
          viewYaw: -Math.PI / 2,
          viewDistance: 1.4,
        },
      ],
    };
  },

  cafe(store) {
    const windows = windowsFor(store, "open");
    return {
      windows,
      entryPoint: { x: 0, z: -2.4 },
      entryLook: { x: 0, z: -12 },
      obstacles: [
        ...windowObstacles(windows),
        { type: "rect", minX: -6.2, maxX: 4.2, minZ: -11.0, maxZ: -9.4 }, // front counter
        { type: "rect", minX: -8, maxX: 8, minZ: -14, maxZ: -12.9 }, // back bar
        { type: "circle", x: -5.4, z: -4.2, r: 1.05 },
        { type: "circle", x: -5.4, z: -7.2, r: 1.05 },
        { type: "circle", x: 4.6, z: -4.2, r: 1.05 },
        { type: "rect", minX: 7.1, maxX: 8, minZ: -9.2, maxZ: -2.4 }, // retail shelf
      ],
      slots: [
        {
          productId: "roasters-house-blend",
          x: 7.35,
          y: 1.22,
          z: -5.2,
          rotY: -Math.PI / 2,
          viewYaw: -Math.PI / 2,
          viewDistance: 0.75,
        },
        { productId: "roasters-ceramic-mug", x: 2.6, y: 1.06, z: -10.2, rotY: 0, viewYaw: 0, viewDistance: 0.5 },
        { productId: "roasters-home-espresso", x: -3.2, y: 1.06, z: -10.3, rotY: 0, viewYaw: 0, viewDistance: 1.1 },
      ],
    };
  },
};

/** Products of a store in catalogue order (used by layouts shared between stores). */
function idsFor(store: StoreConfig): string[] {
  return getStoreProducts(store.id).map((p) => p.id);
}

BUILDERS.arcade = (store) => {
  const windows = windowsFor(store, "open");
  const [consoleId, controllerId, headsetId, handheldId] = idsFor(store);
  return {
    windows,
    entryPoint: { x: 0, z: -2.4 },
    entryLook: { x: 0, z: -9 },
    obstacles: [
      ...windowObstacles(windows),
      { type: "rect", minX: -2.4, maxX: 2.4, minZ: -8.6, maxZ: -5.4 }, // central console island
      { type: "rect", minX: -9, maxX: -7.1, minZ: -11.8, maxZ: -2.4 }, // demo pods
      { type: "rect", minX: 7.5, maxX: 9, minZ: -12.6, maxZ: -2.4 }, // game wall
      { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -12.7 }, // LED wall + counter
    ],
    slots: [
      { productId: consoleId, x: -1.0, y: 0.93, z: -7, rotY: 0, viewYaw: 0, viewDistance: 1.0 },
      { productId: controllerId, x: 1.2, y: 0.93, z: -7, rotY: 0, viewYaw: 0, viewDistance: 0.6 },
      { productId: headsetId, x: 8.6, y: 1.35, z: -5.4, rotY: -Math.PI / 2, viewYaw: -Math.PI / 2, viewDistance: 0.8 },
      { productId: handheldId, x: -7.75, y: 0.79, z: -7.1, rotY: Math.PI / 2, viewYaw: Math.PI / 2, viewDistance: 0.7 },
    ],
  };
};

BUILDERS.restaurant = (store) => {
  const windows = windowsFor(store, "open");
  const ids = idsFor(store);
  const tables: [number, number][] = [
    [-5.2, -4.6],
    [-5.2, -8.2],
    [5.2, -4.6],
    [5.2, -8.2],
  ];
  return {
    windows,
    entryPoint: { x: 0, z: -2.4 },
    entryLook: { x: 0, z: -12 },
    obstacles: [
      ...windowObstacles(windows),
      ...tables.map(([x, z]) => ({ type: "circle" as const, x, z, r: 1.25 })),
      { type: "rect", minX: -7.2, maxX: 7.2, minZ: -12.7, maxZ: -11.1 }, // chef's pass
      { type: "rect", minX: -9, maxX: -8.1, minZ: -10.1, maxZ: -2.7 }, // banquettes
      { type: "rect", minX: 8.1, maxX: 9, minZ: -10.1, maxZ: -2.7 },
      { type: "rect", minX: -9, maxX: 9, minZ: -14, maxZ: -12.7 }, // kitchen
    ],
    slots: ids.slice(0, 3).map((productId, i) => ({
      productId,
      x: -3 + i * 3,
      y: 1.06,
      z: -11.85,
      rotY: 0,
      viewYaw: 0,
      viewDistance: 0.75,
    })),
  };
};

const cache = new Map<string, StoreLayout>();

export function getStoreLayout(store: StoreConfig): StoreLayout {
  let layout = cache.get(store.id);
  if (!layout) {
    const build = BUILDERS[store.interior];
    if (!build) throw new Error(`No interior layout for ${store.interior}`);
    layout = build(store);
    cache.set(store.id, layout);
  }
  return layout;
}
