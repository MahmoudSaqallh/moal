import type { Destination, Interactable, NavEdge, NavNode, Transit, Vec2 } from "@/types";
import { STORES } from "./stores";
import { getStoreLayout } from "./storeLayouts";
import { getProduct } from "./products";
import { DIRECTORY_KIOSKS, EAST_LOUNGE, INFO_DESK, FOUNTAIN, ELEVATOR, ESCALATORS } from "./layout";
import { FLOOR_COUNT } from "./floors";
import { localToWorld, localYawToWorld } from "@/lib/space";

/**
 * Wayfinding graph across all three levels. Walk edges are bidirectional and validated
 * against collision in tests; escalator lanes and lift trips are directed transit edges.
 */

type N = [id: string, floor: number, x: number, z: number, label?: string];

const RAW_NODES: N[] = [
  // ── Level 1 ──
  ["entrance", 0, 0, 30.5, "Main Entrance"],
  ["entrance-mid", 0, 0, 20],
  ["atrium-s", 0, 0, 8],
  ["atrium-e", 0, 8, 0],
  ["atrium-n", 0, 0, -8],
  ["atrium-w", 0, -8, 0],
  ["info", 0, 8.4, 4.6, "Information Desk"],
  ["e0-mouth", 0, 17, 0],
  ["e0-n24", 0, 24, -3.3],
  ["e0-s24", 0, 24, 3.3],
  ["e0-n31", 0, 31, -3.3],
  ["e0-n39", 0, 39, -3.3],
  ["e0-s39", 0, 39, 3.3],
  ["e0-43", 0, 43, 0],
  ["e0-51", 0, 51, 0, "East Lounge"],
  ["esc-a-0", 0, 25.4, 0, "Escalator A (L1)"],
  ["w0-mouth", 0, -17, 0],
  ["w0-31", 0, -31, 0],
  ["w0-43", 0, -43, 0],
  ["w0-55", 0, -55, 0],
  ["c0-s", 0, 0, -18, "Garden Court"],
  ["c0-n", 0, 0, -33],
];

/** Upper levels share one plan; only bridges and store doors differ. */
function upperLevel(f: number): N[] {
  const p = (id: string) => `${id}-${f}`;
  const nodes: N[] = [
    [p("r-s"), f, 0, 13.5],
    [p("r-sw"), f, -13.5, 13.5],
    [p("r-se"), f, 13.5, 13.5],
    [p("r-nw"), f, -13.5, -13.5],
    [p("r-n"), f, 0, -13.5],
    [p("r-ne"), f, 13.5, -13.5],
    [p("r-en"), f, 13.5, -4.25],
    [p("r-es"), f, 13.5, 4.25],
    [p("r-wn"), f, -13.5, -4.25],
    [p("r-ws"), f, -13.5, 4.25],
    [p("en-17"), f, 17, -4.25],
    [p("es-17"), f, 17, 4.25],
    [p("en-31"), f, 31, -4.25],
    [p("en-58"), f, 58.5, -4.25],
    [p("es-58"), f, 58.5, 4.25],
    [p("e-end"), f, 58.5, 0],
    [p("wn-17"), f, -17, -4.25],
    [p("ws-17"), f, -17, 4.25],
    [p("wn-31"), f, -31, -4.25],
    [p("wn-38"), f, -38, -4.25],
    [p("ws-38"), f, -38, 4.25],
    [p("w-bridge"), f, -38, 0],
    [p("wn-58"), f, -58.5, -4.25],
    [p("ws-58"), f, -58.5, 4.25],
    [p("w-end"), f, -58.5, 0],
    [p("c-s"), f, 0, -18, f === 1 ? "Showroom Court" : "Food Court"],
    [p("c-n"), f, 0, -33],
  ];
  // The bridge where escalators land differs per level.
  const bx = f === 1 ? 38 : 51;
  nodes.push([p("en-b"), f, bx, -4.25], [p("es-b"), f, bx, 4.25], [p("e-bridge"), f, bx, 0, `Escalator landing (L${f + 1})`]);
  return nodes;
}

function upperEdges(f: number): [string, string][] {
  const p = (id: string) => `${id}-${f}`;
  return [
    [p("r-s"), p("r-sw")],
    [p("r-s"), p("r-se")],
    [p("r-se"), p("r-es")],
    [p("r-es"), p("r-en")],
    [p("r-en"), p("r-ne")],
    [p("r-ne"), p("r-n")],
    [p("r-n"), p("r-nw")],
    [p("r-nw"), p("r-wn")],
    [p("r-wn"), p("r-ws")],
    [p("r-ws"), p("r-sw")],
    [p("r-en"), p("en-17")],
    [p("r-es"), p("es-17")],
    [p("en-17"), p("en-31")],
    [p("en-31"), p("en-b")],
    [p("en-b"), p("en-58")],
    [p("es-17"), p("es-b")],
    [p("es-b"), p("es-58")],
    [p("en-b"), p("e-bridge")],
    [p("es-b"), p("e-bridge")],
    [p("en-58"), p("e-end")],
    [p("es-58"), p("e-end")],
    [p("r-wn"), p("wn-17")],
    [p("r-ws"), p("ws-17")],
    [p("wn-17"), p("wn-31")],
    [p("wn-31"), p("wn-38")],
    [p("wn-38"), p("wn-58")],
    [p("ws-17"), p("ws-38")],
    [p("ws-38"), p("ws-58")],
    [p("wn-38"), p("w-bridge")],
    [p("ws-38"), p("w-bridge")],
    [p("wn-58"), p("w-end")],
    [p("ws-58"), p("w-end")],
    [p("r-n"), p("c-s")],
    [p("c-s"), p("c-n")],
  ];
}

const GROUND_EDGES: [string, string][] = [
  ["entrance", "entrance-mid"],
  ["entrance-mid", "atrium-s"],
  ["atrium-s", "atrium-e"],
  ["atrium-e", "atrium-n"],
  ["atrium-n", "atrium-w"],
  ["atrium-w", "atrium-s"],
  ["atrium-e", "info"],
  ["atrium-s", "info"],
  ["atrium-e", "e0-mouth"],
  ["e0-mouth", "e0-n24"],
  ["e0-mouth", "e0-s24"],
  ["e0-n24", "esc-a-0"],
  ["e0-s24", "esc-a-0"],
  ["e0-n24", "e0-n31"],
  ["e0-n31", "e0-n39"],
  ["e0-s24", "e0-s39"],
  ["e0-n39", "e0-43"],
  ["e0-s39", "e0-43"],
  ["e0-43", "e0-51"],
  ["atrium-w", "w0-mouth"],
  ["w0-mouth", "w0-31"],
  ["w0-31", "w0-43"],
  ["w0-43", "w0-55"],
  ["atrium-n", "c0-s"],
  ["c0-s", "c0-n"],
];

// ── Lift ──
export function liftNodeId(floor: number) {
  return `lift-${floor}`;
}
const LIFT_NODES: N[] = ELEVATOR.floors.map((f) => [liftNodeId(f), f, ELEVATOR.call.x, ELEVATOR.call.z, `Lift (L${f + 1})`]);
const LIFT_WALK_EDGES: [string, string][] = [
  [liftNodeId(0), "atrium-w"],
  [liftNodeId(0), "w0-mouth"],
  [liftNodeId(1), "r-wn-1"],
  [liftNodeId(1), "r-nw-1"],
  [liftNodeId(2), "r-wn-2"],
  [liftNodeId(2), "r-nw-2"],
];

// ── Stores ──
/** The corridor node each store's door connects to. */
const STORE_CORRIDOR_NODE: Record<string, string> = {
  "maison-elan": "e0-n31",
  aurelia: "e0-43",
  stride: "w0-43",
  "casa-linea": "w0-55",
  lumen: "wn-31-1",
  "pixel-forge": "en-31-1",
  "saffron-table": "en-31-2",
  "umami-street": "wn-31-2",
  "atrium-roasters": "c-n-2",
};

export function doorOutsideNodeId(storeId: string) {
  return `door-out:${storeId}`;
}
export function doorInsideNodeId(storeId: string) {
  return `door-in:${storeId}`;
}

const STORE_NODES: NavNode[] = STORES.flatMap((store) => {
  const layout = getStoreLayout(store);
  return [
    { id: doorOutsideNodeId(store.id), floor: store.floor, position: localToWorld(store, 0, 1.8), label: `${store.name} entrance` },
    {
      id: doorInsideNodeId(store.id),
      floor: store.floor,
      position: localToWorld(store, layout.entryPoint.x, layout.entryPoint.z),
      label: store.name,
    },
  ];
});

const WALK: Transit = { type: "walk" };
const walk = ([from, to]: [string, string]): NavEdge => ({ from, to, transit: WALK, bidirectional: true });

const ESCALATOR_NODE: Record<string, { bottom: string; top: string }> = {
  "esc-a": { bottom: "esc-a-0", top: "e-bridge-1" },
  "esc-b": { bottom: "e-bridge-1", top: "e-bridge-2" },
};

const ESCALATOR_EDGES: NavEdge[] = ESCALATORS.flatMap((e) => {
  const n = ESCALATOR_NODE[e.id];
  return [
    { from: n.bottom, to: n.top, transit: { type: "escalator", escalatorId: e.id, direction: "up" }, bidirectional: false },
    { from: n.top, to: n.bottom, transit: { type: "escalator", escalatorId: e.id, direction: "down" }, bidirectional: false },
  ] satisfies NavEdge[];
});

const LIFT_EDGES: NavEdge[] = ELEVATOR.floors.flatMap((a) =>
  ELEVATOR.floors
    .filter((b) => b !== a)
    .map((b): NavEdge => ({ from: liftNodeId(a), to: liftNodeId(b), transit: { type: "elevator", toFloor: b }, bidirectional: false })),
);

const toNode = ([id, floor, x, z, label]: N): NavNode => ({ id, floor, position: { x, z }, label });

export const NAV_NODES: readonly NavNode[] = [
  ...RAW_NODES.map(toNode),
  ...Array.from({ length: FLOOR_COUNT - 1 }, (_, i) => upperLevel(i + 1).map(toNode)).flat(),
  ...LIFT_NODES.map(toNode),
  ...STORE_NODES,
];

export const NAV_EDGES: readonly NavEdge[] = [
  ...GROUND_EDGES.map(walk),
  ...Array.from({ length: FLOOR_COUNT - 1 }, (_, i) => upperEdges(i + 1).map(walk)).flat(),
  ...LIFT_WALK_EDGES.map(walk),
  ...STORES.flatMap((store) => [
    walk([STORE_CORRIDOR_NODE[store.id], doorOutsideNodeId(store.id)]),
    walk([doorOutsideNodeId(store.id), doorInsideNodeId(store.id)]),
  ]),
  ...ESCALATOR_EDGES,
  ...LIFT_EDGES,
];

const NODE_BY_ID = new Map(NAV_NODES.map((n) => [n.id, n]));
export function getNavNode(id: string): NavNode | undefined {
  return NODE_BY_ID.get(id);
}

// ─── Destinations (directory, assistant, click-to-navigate) ────────────

export const DESTINATIONS: readonly Destination[] = [
  ...STORES.map<Destination>((store) => {
    const layout = getStoreLayout(store);
    return {
      id: store.id,
      label: store.name,
      nodeId: doorInsideNodeId(store.id),
      floor: store.floor,
      lookAt: localToWorld(store, layout.entryLook.x, layout.entryLook.z),
      storeId: store.id,
      kind: "store",
    };
  }),
  { id: "landmark-fountain", label: "Spiral Fountain", nodeId: "atrium-s", floor: 0, lookAt: FOUNTAIN, kind: "landmark" },
  { id: "landmark-info", label: "Information Desk", nodeId: "info", floor: 0, lookAt: INFO_DESK, kind: "landmark" },
  {
    id: "landmark-lounge",
    label: "East Lounge",
    nodeId: "e0-51",
    floor: 0,
    lookAt: { x: (EAST_LOUNGE.minX + EAST_LOUNGE.maxX) / 2, z: 0 },
    kind: "landmark",
  },
  { id: "landmark-garden-court", label: "Garden Court", nodeId: "c0-s", floor: 0, lookAt: { x: 0, z: -30 }, kind: "landmark" },
  { id: "landmark-showroom-court", label: "Showroom Court", nodeId: "c-s-1", floor: 1, lookAt: { x: 0, z: -30 }, kind: "landmark" },
  { id: "landmark-food-court", label: "Food Court", nodeId: "c-s-2", floor: 2, lookAt: { x: 0, z: -30 }, kind: "landmark" },
  { id: "landmark-entrance", label: "Main Entrance", nodeId: "entrance", floor: 0, lookAt: { x: 0, z: 40 }, kind: "landmark" },
  ...ELEVATOR.floors.map<Destination>((f) => ({
    id: `lift-${f}`,
    label: `Lift · Level ${f + 1}`,
    nodeId: liftNodeId(f),
    floor: f,
    lookAt: { x: ELEVATOR.x, z: ELEVATOR.z },
    kind: "transport",
  })),
  { id: "escalator-l1", label: "Escalator A · Level 1", nodeId: "esc-a-0", floor: 0, lookAt: { x: 36, z: 0 }, kind: "transport" },
  { id: "escalator-l2", label: "Escalators · Level 2", nodeId: "e-bridge-1", floor: 1, lookAt: { x: 48, z: 0 }, kind: "transport" },
  { id: "escalator-l3", label: "Escalator B · Level 3", nodeId: "e-bridge-2", floor: 2, lookAt: { x: 40, z: 0 }, kind: "transport" },
];

export function getDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

// ─── Product placements & interactables ────────────────────────────────

export interface ProductPlacement {
  productId: string;
  storeId: string;
  floor: number;
  position: Vec2;
  /** Height above the store's floor. */
  y: number;
  /** World yaw of the model. */
  rotY: number;
  /** World yaw pointing from the product towards the shopper's viewing position. */
  viewYaw: number;
  viewDistance: number;
}

export const PRODUCT_PLACEMENTS: readonly ProductPlacement[] = STORES.flatMap((store) =>
  getStoreLayout(store).slots.map((slot) => ({
    productId: slot.productId,
    storeId: store.id,
    floor: store.floor,
    position: localToWorld(store, slot.x, slot.z),
    y: slot.y,
    rotY: localYawToWorld(store, slot.rotY),
    viewYaw: localYawToWorld(store, slot.viewYaw),
    viewDistance: slot.viewDistance,
  })),
);

const PLACEMENT_BY_PRODUCT = new Map(PRODUCT_PLACEMENTS.map((p) => [p.productId, p]));
export function getPlacement(productId: string) {
  return PLACEMENT_BY_PRODUCT.get(productId);
}

export const INTERACTABLES: readonly Interactable[] = [
  ...STORES.flatMap<Interactable>((store) => [
    {
      id: `enter:${store.id}`,
      kind: "enter-store",
      label: store.name,
      verb: "Enter",
      position: localToWorld(store, 0, 0.6),
      floor: store.floor,
      y: 1.6,
      range: 4.2,
      storeId: store.id,
    },
    {
      id: `exit:${store.id}`,
      kind: "exit-store",
      label: store.name,
      verb: "Leave",
      position: localToWorld(store, 0, -1.0),
      floor: store.floor,
      y: 1.6,
      range: 2.6,
      storeId: store.id,
    },
  ]),
  ...DIRECTORY_KIOSKS.map<Interactable>((k) => ({
    id: k.id,
    kind: "directory",
    label: "Mall directory",
    verb: "Open",
    position: { x: k.x, z: k.z },
    floor: k.floor,
    y: 1.3,
    range: 2.8,
  })),
  {
    id: "info-desk",
    kind: "directory",
    label: "Information desk",
    verb: "Ask",
    position: { x: INFO_DESK.x, z: INFO_DESK.z },
    floor: 0,
    y: 1.1,
    range: 3.6,
  },
  ...ELEVATOR.floors.map<Interactable>((f) => ({
    id: `call-lift-${f}`,
    kind: "call-elevator",
    label: "Lift",
    verb: "Call",
    position: { x: ELEVATOR.call.x + 0.5, z: ELEVATOR.call.z },
    floor: f,
    y: 1.2,
    range: 2.4,
  })),
  ...PRODUCT_PLACEMENTS.map<Interactable>((p) => ({
    id: `product:${p.productId}`,
    kind: "product",
    label: getProduct(p.productId)?.name ?? p.productId,
    verb: "Inspect",
    position: p.position,
    floor: p.floor,
    y: p.y + 0.2,
    range: 3.4,
    storeId: p.storeId,
    productId: p.productId,
  })),
];
