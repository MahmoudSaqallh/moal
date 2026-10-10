import { describe, expect, it } from "vitest";
import { isWalkable, moveWithCollision, segmentClear } from "@/lib/collision";
import { planRoute, shortestPath } from "@/lib/pathfinding";
import { laneGeometry } from "@/lib/transit";
import {
  DESTINATIONS,
  INTERACTABLES,
  NAV_EDGES,
  NAV_NODES,
  PRODUCT_PLACEMENTS,
  doorInsideNodeId,
  getNavNode,
} from "@/data/navigation";
import { STORES } from "@/data/stores";
import { PRODUCTS } from "@/data/products";
import { ELEVATOR, ESCALATORS, FLOOR_COLLISION, STORE_FOOTPRINTS } from "@/data/layout";
import { FLOOR_COUNT } from "@/data/floors";
import { findZone } from "@/lib/runtime";
import { rectContains } from "@/lib/space";
import { ATRIUM_START } from "@/features/exploration/actions";

const overlaps = (a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: typeof a) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe("floor plan", () => {
  it("places every nav node on walkable floor of its level", () => {
    for (const node of NAV_NODES) {
      expect(isWalkable(node.floor, node.position.x, node.position.z), node.id).toBe(true);
    }
  });

  it("keeps every walking edge on one level and free of obstacles", () => {
    for (const e of NAV_EDGES.filter((e) => e.transit.type === "walk")) {
      const a = getNavNode(e.from)!;
      const b = getNavNode(e.to)!;
      expect(a.floor, `${e.from} -> ${e.to}`).toBe(b.floor);
      expect(segmentClear(a.floor, a.position, b.position), `${e.from} -> ${e.to}`).toBe(true);
    }
  });

  it("connects escalator and lift edges between the right levels", () => {
    for (const e of NAV_EDGES) {
      const a = getNavNode(e.from)!;
      const b = getNavNode(e.to)!;
      if (e.transit.type === "escalator") {
        expect(Math.abs(a.floor - b.floor), e.from).toBe(1);
        expect(e.transit.direction === "up" ? b.floor > a.floor : b.floor < a.floor).toBe(true);
      }
      if (e.transit.type === "elevator") expect(b.floor).toBe(e.transit.toFloor);
    }
  });

  it("puts every escalator landing on walkable floor", () => {
    for (const esc of ESCALATORS) {
      for (const dir of ["up", "down"] as const) {
        const lane = laneGeometry(esc, dir);
        expect(isWalkable(lane.entry.floor, lane.entry.x, lane.entry.z), `${esc.id} ${dir} entry`).toBe(true);
        expect(isWalkable(lane.exit.floor, lane.exit.x, lane.exit.z), `${esc.id} ${dir} exit`).toBe(true);
      }
    }
  });

  it("gates the lift: the shaft blocks when closed and admits visitors when open", () => {
    const cx = (ELEVATOR.cabin.minX + ELEVATOR.cabin.maxX) / 2;
    const cz = (ELEVATOR.cabin.minZ + ELEVATOR.cabin.maxZ) / 2;
    for (let f = 0; f < FLOOR_COUNT; f++) {
      expect(isWalkable(f, ELEVATOR.call.x, ELEVATOR.call.z), `call point L${f + 1}`).toBe(true);
      expect(isWalkable(f, cx, cz)).toBe(false);
      expect(isWalkable(f, cx, cz, { lift: "open" })).toBe(true);
      const walkedIn = moveWithCollision(f, ELEVATOR.call, cx - ELEVATOR.call.x, 0, { lift: "open" });
      expect(walkedIn.x).toBeGreaterThan(-10.2);
      // Riding: confined to the cabin
      expect(isWalkable(f, ELEVATOR.call.x, ELEVATOR.call.z, { lift: "riding" })).toBe(false);
    }
  });

  it("starts the visitor on walkable floor after the intro", () => {
    expect(isWalkable(0, ATRIUM_START.x, ATRIUM_START.z)).toBe(true);
  });

  it("does not let store interiors overlap each other or public space on the same level", () => {
    for (let i = 0; i < STORE_FOOTPRINTS.length; i++) {
      const a = STORE_FOOTPRINTS[i];
      for (let j = i + 1; j < STORE_FOOTPRINTS.length; j++) {
        const b = STORE_FOOTPRINTS[j];
        if (a.floor !== b.floor) continue;
        expect(overlaps(a.interior, b.interior), `${a.storeId} vs ${b.storeId}`).toBe(false);
      }
    }
  });

  it("reports the store zone when standing inside a store", () => {
    for (const store of STORES) {
      const node = getNavNode(doorInsideNodeId(store.id))!;
      expect(findZone(store.floor, node.position.x, node.position.z)?.storeId, store.id).toBe(store.id);
    }
    expect(findZone(0, 0, 0)?.name).toBe("Central Atrium");
    expect(findZone(1, 40, -4)?.name).toBe("Game Street");
    expect(findZone(2, 0, -25)?.name).toBe("Food Court");
  });

  it("builds a collision world for every level", () => {
    expect(FLOOR_COLLISION).toHaveLength(FLOOR_COUNT);
  });
});

describe("collision", () => {
  it("stops the visitor at a storefront wall", () => {
    const end = moveWithCollision(0, { x: 26, z: -3 }, 0, -6);
    expect(end.z).toBeGreaterThanOrEqual(-6 + 0.3);
  });

  it("lets the visitor walk through an open doorway", () => {
    const end = moveWithCollision(0, { x: 31, z: -3.3 }, 0, -6);
    expect(end.z).toBeLessThan(-7);
  });

  it("slides along walls instead of sticking", () => {
    const end = moveWithCollision(0, { x: 22, z: -5.5 }, 2, -2);
    expect(end.x).toBeGreaterThan(23.5);
  });

  it("cannot tunnel through the fountain on a large frame step", () => {
    const end = moveWithCollision(0, { x: 0, z: 7 }, 0, -14);
    expect(Math.hypot(end.x, end.z)).toBeGreaterThan(5);
  });

  it("does not leave the building through the entrance glass", () => {
    const end = moveWithCollision(0, { x: 0, z: 30 }, 0, 20);
    expect(end.z).toBeLessThan(34);
  });

  it("never lets the visitor step off an upper gallery into a void", () => {
    const wing = moveWithCollision(1, { x: 20, z: -4 }, 0, 6);
    expect(wing.z).toBeLessThanOrEqual(-2.5);
    const atrium = moveWithCollision(2, { x: 0, z: 13.5 }, 0, -8);
    expect(atrium.z).toBeGreaterThanOrEqual(11);
  });

  it("crosses a wing void on a bridge", () => {
    const end = moveWithCollision(1, { x: 38, z: -4 }, 0, 8);
    expect(end.z).toBeGreaterThan(4);
  });
});

describe("wayfinding", () => {
  it("reaches every destination from the entrance", () => {
    for (const dest of DESTINATIONS) {
      expect(shortestPath("entrance", dest.nodeId), dest.id).not.toBeNull();
    }
  });

  it("plans clear multi-level routes from the atrium to every store interior", () => {
    for (const store of STORES) {
      const route = planRoute({ x: ATRIUM_START.x, z: ATRIUM_START.z, floor: 0 }, doorInsideNodeId(store.id), store.name);
      expect(route, store.id).not.toBeNull();
      for (const leg of route!.legs) {
        if (leg.transit.type !== "walk") continue;
        for (let i = 1; i < leg.points.length; i++) {
          const a = leg.points[i - 1];
          const b = leg.points[i];
          expect(a.floor).toBe(b.floor);
          expect(segmentClear(a.floor, a, b), `${store.id} leg ${i}`).toBe(true);
        }
      }
      const last = route!.legs[route!.legs.length - 1].points.at(-1)!;
      expect(findZone(last.floor, last.x, last.z)?.storeId).toBe(store.id);
      if (store.floor > 0) expect(route!.legs.some((l) => l.transit.type !== "walk"), store.id).toBe(true);
    }
  });

  it("routes back down from the top floor", () => {
    const top = getNavNode(doorInsideNodeId("atrium-roasters"))!;
    const route = planRoute({ ...top.position, floor: top.floor }, "entrance", "Main Entrance");
    expect(route).not.toBeNull();
    expect(route!.legs.at(-1)!.points.at(-1)!.floor).toBe(0);
  });
});

describe("catalogue placement", () => {
  it("places every sample product exactly once, inside its own store", () => {
    expect(PRODUCT_PLACEMENTS.length).toBe(PRODUCTS.length);
    for (const product of PRODUCTS) {
      const placements = PRODUCT_PLACEMENTS.filter((p) => p.productId === product.id);
      expect(placements.length, product.id).toBe(1);
      const footprint = STORE_FOOTPRINTS.find((f) => f.storeId === product.storeId)!;
      expect(rectContains(footprint.interior, placements[0].position.x, placements[0].position.z), product.id).toBe(true);
    }
  });

  it("puts the product focus camera inside the store", () => {
    for (const p of PRODUCT_PLACEMENTS) {
      const cx = p.position.x + Math.sin(p.viewYaw) * p.viewDistance;
      const cz = p.position.z + Math.cos(p.viewYaw) * p.viewDistance;
      const footprint = STORE_FOOTPRINTS.find((f) => f.storeId === p.storeId)!;
      expect(rectContains(footprint.walkable, cx, cz), p.productId).toBe(true);
    }
  });

  it("makes every product inspectable from somewhere walkable", () => {
    for (const it of INTERACTABLES.filter((i) => i.kind === "product")) {
      let reachable = false;
      for (let a = 0; a < Math.PI * 2 && !reachable; a += Math.PI / 16) {
        for (let d = 0.8; d <= it.range - 0.4 && !reachable; d += 0.2) {
          if (isWalkable(it.floor, it.position.x + Math.cos(a) * d, it.position.z + Math.sin(a) * d)) reachable = true;
        }
      }
      expect(reachable, it.id).toBe(true);
    }
  });
});
