"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AREAS,
  ATRIUM_VOID,
  BRIDGES,
  ELEVATOR,
  ESCALATORS,
  FOUNTAIN,
  GALLERY_RING,
  WALKWAYS,
  WING_VOID_HALF_WIDTH,
} from "@/data/layout";
import { STORES } from "@/data/stores";
import { FLOOR_COUNT, floorY } from "@/data/floors";
import type { Rect, StoreConfig } from "@/types";
import { ATRIUM_ROOF, ENTRANCE_CEILING, G, H, SLAB } from "./constants";
import { boxFromBounds, type BoxSpec } from "./geometry";
import { FloorRects, Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { getLibrary } from "../materials/library";
import { LightPools } from "../environments/Furniture";

/**
 * The public building shell for all three levels: floors and slabs, perimeter walls with
 * storefront openings derived from the store data, glass balustrades around every void
 * (with gaps where the lift and escalators meet the galleries), bridges, and one roof
 * with skylights over the atrium and wing voids.
 */

const T = 0.4; // wall thickness
type Side = "+x" | "-x" | "+z" | "-z";

interface WallLine {
  at: number;
  from: number;
  to: number;
  inner: Side;
}

function wallBox(w: WallLine, y0: number, y1: number): BoxSpec {
  const alongX = w.inner === "+z" || w.inner === "-z";
  if (alongX) {
    const z0 = w.inner === "+z" ? w.at - T : w.at;
    return boxFromBounds(w.from, w.to, y0, y1, z0, z0 + T);
  }
  const x0 = w.inner === "+x" ? w.at - T : w.at;
  return boxFromBounds(x0, x0 + T, y0, y1, w.from, w.to);
}

/** The storefront span a store occupies on a wall line, if any. */
function storeSpan(store: StoreConfig, line: WallLine): [number, number] | null {
  const alongX = line.inner === "+z" || line.inner === "-z";
  const half = store.width / 2;
  if (alongX && (store.facing === "south" || store.facing === "north") && Math.abs(store.origin.z - line.at) < 0.01)
    return [store.origin.x - half, store.origin.x + half];
  if (!alongX && (store.facing === "east" || store.facing === "west") && Math.abs(store.origin.x - line.at) < 0.01)
    return [store.origin.z - half, store.origin.z + half];
  return null;
}

/** Split a wall line around the storefronts present on a floor. */
function wallsForFloor(lines: WallLine[], floor: number): WallLine[] {
  const out: WallLine[] = [];
  for (const line of lines) {
    const spans = STORES.filter((s) => s.floor === floor)
      .map((s) => storeSpan(s, line))
      .filter((s): s is [number, number] => !!s && s[1] > line.from && s[0] < line.to)
      .sort((a, b) => a[0] - b[0]);
    let cursor = line.from;
    for (const [a, b] of spans) {
      if (a > cursor + 0.01) out.push({ ...line, from: cursor, to: a });
      cursor = Math.max(cursor, b);
    }
    if (cursor < line.to - 0.01) out.push({ ...line, from: cursor, to: line.to });
  }
  return out;
}

/** Wall lines shared by every level (wing openings and courts left open). */
const COMMON_LINES: WallLine[] = [
  { at: -16, from: -16, to: -10, inner: "+z" },
  { at: -16, from: 10, to: 16, inner: "+z" },
  { at: 16, from: -16, to: -6, inner: "-x" },
  { at: 16, from: 6, to: 16, inner: "-x" },
  { at: -16, from: -16, to: -6, inner: "+x" },
  { at: -16, from: 6, to: 16, inner: "+x" },
  { at: -6, from: 16, to: 60, inner: "+z" },
  { at: 6, from: 16, to: 60, inner: "-z" },
  { at: -6, from: -60, to: -16, inner: "+z" },
  { at: 6, from: -60, to: -16, inner: "-z" },
  { at: -10, from: -38, to: -16, inner: "+x" },
  { at: 10, from: -38, to: -16, inner: "-x" },
  { at: -38, from: -10, to: 10, inner: "+z" },
  { at: -60, from: -6, to: 6, inner: "+x" },
];

function floorWalls(floor: number): BoxSpec[] {
  const y0 = floorY(floor);
  const lines: WallLine[] = [...COMMON_LINES];
  if (floor < 2) {
    lines.push({ at: 16, from: -16, to: -12, inner: "-z" }, { at: 16, from: 12, to: 16, inner: "-z" });
  } else {
    lines.push({ at: 16, from: -16, to: 16, inner: "-z" });
  }
  const boxes = wallsForFloor(lines, floor).map((l) => wallBox(l, y0, y0 + H));
  // Level 2 overlooks the double-height entrance hall: wall only above the hall ceiling.
  if (floor === 1) boxes.push(wallBox({ at: 16, from: -12, to: 12, inner: "-z" }, ENTRANCE_CEILING, y0 + H));
  if (floor === 0) {
    boxes.push(wallBox({ at: -12, from: 16, to: 34, inner: "+x" }, 0, ENTRANCE_CEILING));
    boxes.push(wallBox({ at: 12, from: 16, to: 34, inner: "-x" }, 0, ENTRANCE_CEILING));
  }
  return boxes;
}

/** Glass balustrade edges per upper floor: [x1, z1, x2, z2]. */
function railEdges(floor: number): [number, number, number, number][] {
  const V = ATRIUM_VOID;
  const W = WING_VOID_HALF_WIDTH;
  const liftGap: [number, number] = [ELEVATOR.z - 1.1, ELEVATOR.z + 1.1];
  const edges: [number, number, number, number][] = [
    [V.minX, V.minZ, V.maxX, V.minZ],
    [V.minX, V.maxZ, V.maxX, V.maxZ],
    [V.minX, V.minZ, V.minX, liftGap[0]],
    [V.minX, liftGap[1], V.minX, V.maxZ],
    [V.maxX, V.minZ, V.maxX, V.maxZ],
    [16, -W, 16, W],
    [-16, -W, -16, W],
  ];
  if (floor === 1) edges.push([-12, 16, 12, 16]);
  const bridges = BRIDGES[floor] ?? [];
  // Wing void long edges, interrupted by bridges.
  for (const [a, b] of [
    [16, 60],
    [-60, -16],
  ]) {
    const spans = bridges.filter((r) => r.minX >= a && r.maxX <= b).sort((p, q) => p.minX - q.minX);
    let cursor = a;
    for (const r of spans) {
      if (r.minX > cursor) edges.push([cursor, -W, r.minX, -W], [cursor, W, r.minX, W]);
      cursor = r.maxX;
    }
    if (cursor < b) edges.push([cursor, -W, b, -W], [cursor, W, b, W]);
  }
  // Bridge ends facing the void, leaving gaps where escalators arrive or depart.
  for (const r of bridges) {
    for (const x of [r.minX, r.maxX]) {
      if (x === 60 || x === -60) continue;
      const escHere = ESCALATORS.some(
        (e) => (e.toFloor === floor && Math.abs(e.topX - x) < 0.01) || (e.fromFloor === floor && Math.abs(e.bottomX - x) < 0.01),
      );
      if (escHere) edges.push([x, -W, x, -1.75], [x, 1.75, x, W]);
      else edges.push([x, -W, x, W]);
    }
  }
  return edges;
}

function railBoxes(floor: number) {
  const y = floorY(floor);
  const glass: BoxSpec[] = [];
  const brass: BoxSpec[] = [];
  const shoe: BoxSpec[] = [];
  const fascia: BoxSpec[] = [];
  for (const [x1, z1, x2, z2] of railEdges(floor)) {
    const alongX = z1 === z2;
    const len = Math.abs(alongX ? x2 - x1 : z2 - z1);
    if (len < 0.05) continue;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    glass.push({ x: cx, y: y + 0.6, z: cz, w: alongX ? len : 0.025, h: 1.05, d: alongX ? 0.025 : len });
    brass.push({ x: cx, y: y + 1.14, z: cz, w: alongX ? len : 0.07, h: 0.05, d: alongX ? 0.07 : len });
    shoe.push({ x: cx, y: y + 0.06, z: cz, w: alongX ? len : 0.1, h: 0.12, d: alongX ? 0.1 : len });
    fascia.push({ x: cx, y: y - SLAB / 2, z: cz, w: alongX ? len : 0.06, h: SLAB + 0.02, d: alongX ? 0.06 : len });
  }
  return { glass, brass, shoe, fascia };
}

/** Walkable surfaces of an upper level (also its slab footprint). */
function upperSurfaces(floor: number): Rect[] {
  return [...GALLERY_RING, ...WALKWAYS, ...(BRIDGES[floor] ?? []), AREAS.northCourt];
}

function downlightPositions(): { x: number; z: number; y: number }[] {
  const out: { x: number; z: number; y: number }[] = [];
  for (let f = 0; f < FLOOR_COUNT; f++) {
    const y = floorY(f) + G;
    const line = (alongX: boolean, fixed: number, from: number, to: number, step: number) => {
      for (let v = from; v <= to + 0.001; v += step) out.push(alongX ? { x: v, z: fixed, y } : { x: fixed, z: v, y });
    };
    line(true, -13.5, -14.5, 14.5, 3.2);
    line(true, 13.5, -14.5, 14.5, 3.2);
    line(false, 13.5, -8, 8, 3.2);
    line(false, -13.5, -8, 8, 3.2);
    for (const z of [-4.25, 4.25]) {
      line(true, z, 18, 58, 3.2);
      line(true, z, -58, -18, 3.2);
    }
    for (const x of [-6, 0, 6]) line(false, x, -35, -19, 4);
  }
  return out;
}

/** Vertical gradient strips at the foot of walls: baked contact shading. */
function wallAOGeometry(boxes: BoxSpec[]) {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of boxes) {
    const alongX = b.w > b.d;
    const len = alongX ? b.w : b.d;
    if (len < 0.5) continue;
    const yBase = b.y - b.h / 2;
    for (const side of [-1, 1]) {
      const p = new THREE.PlaneGeometry(len, 1.1);
      p.translate(0, 0.55, 0);
      if (alongX) {
        if (side < 0) p.rotateY(Math.PI);
        p.translate(b.x, yBase, b.z + side * (b.d / 2 + 0.01));
      } else {
        p.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
        p.translate(b.x + side * (b.w / 2 + 0.01), yBase, b.z);
      }
      parts.push(p);
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function archGeometry(span: number, rise: number, depth: number, thickness: number) {
  const shape = new THREE.Shape();
  const seg = 40;
  for (let i = 0; i <= seg; i++) {
    const t = Math.PI - (i / seg) * Math.PI;
    const x = Math.cos(t) * (span / 2 + thickness / 2);
    const y = Math.sin(t) * (rise + thickness / 2);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = seg; i >= 0; i--) {
    const t = Math.PI - (i / seg) * Math.PI;
    shape.lineTo(Math.cos(t) * (span / 2 - thickness / 2), Math.sin(t) * (rise - thickness / 2));
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export function MallShell() {
  const m = getLibrary();
  const V = ATRIUM_VOID;
  const W = WING_VOID_HALF_WIDTH;

  const data = useMemo(() => {
    const walls: BoxSpec[] = [];
    const slabs: BoxSpec[] = [];
    const rails = { glass: [] as BoxSpec[], brass: [] as BoxSpec[], shoe: [] as BoxSpec[], fascia: [] as BoxSpec[] };
    for (let f = 0; f < FLOOR_COUNT; f++) {
      walls.push(...floorWalls(f));
      if (f > 0) {
        const y = floorY(f);
        for (const r of upperSurfaces(f)) slabs.push(boxFromBounds(r.minX, r.maxX, y - SLAB, y - 0.004, r.minZ, r.maxZ));
        const rb = railBoxes(f);
        rails.glass.push(...rb.glass);
        rails.brass.push(...rb.brass);
        rails.shoe.push(...rb.shoe);
        rails.fascia.push(...rb.fascia);
      }
    }
    const top = floorY(FLOOR_COUNT - 1) + G;
    const roofs: BoxSpec[] = [
      ...[...GALLERY_RING, ...WALKWAYS, AREAS.northCourt].map((r) => boxFromBounds(r.minX, r.maxX, top, ATRIUM_ROOF, r.minZ, r.maxZ)),
      boxFromBounds(-12.4, 12.4, ENTRANCE_CEILING, ENTRANCE_CEILING + 0.3, 16, 34),
    ];
    const ribs: BoxSpec[] = [];
    for (const sign of [1, -1]) {
      for (let x = 17.5; x <= 59; x += 3) ribs.push({ x: x * sign, y: ATRIUM_ROOF + 0.15, z: 0, w: 0.12, h: 0.3, d: W * 2 });
      ribs.push({ x: 38 * sign, y: ATRIUM_ROOF + 0.1, z: -0.9, w: 44, h: 0.16, d: 0.1 });
      ribs.push({ x: 38 * sign, y: ATRIUM_ROOF + 0.1, z: 0.9, w: 44, h: 0.16, d: 0.1 });
    }
    const slats: BoxSpec[] = [];
    for (let x = -11.7; x <= 11.7; x += 0.45) slats.push({ x, y: ENTRANCE_CEILING - 0.15, z: 25, w: 0.12, h: 0.24, d: 18 });
    for (let f = 0; f < FLOOR_COUNT; f++)
      for (let x = -9.7; x <= 9.7; x += 0.4) slats.push({ x, y: floorY(f) + G - 0.12, z: -27, w: 0.1, h: 0.2, d: 22 });
    return { walls, slabs, rails, roofs, ribs, slats, lights: downlightPositions() };
  }, [W]);

  const downlights = useMemo<InstanceTransform[]>(
    () => data.lights.map((l) => ({ position: [l.x, l.y - 0.012, l.z], rotation: [Math.PI, 0, 0], scale: 0.16 })),
    [data.lights],
  );
  const pools = useMemo(() => data.lights.map((l) => ({ x: l.x, z: l.z, y: l.y - G, r: 1.5 })), [data.lights]);
  const wallAO = useDisposable(() => wallAOGeometry(data.walls.filter((b) => b.h > 2)));

  const vaultSpan = V.maxX - V.minX;
  const vaultRise = 4.5;
  const vault = useDisposable(() => {
    const g = new THREE.CylinderGeometry(vaultSpan / 2, vaultSpan / 2, V.maxZ - V.minZ, 40, 1, true, Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    g.scale(1, vaultRise / (vaultSpan / 2), 1);
    g.translate(0, ATRIUM_ROOF + 0.3, 0);
    return g;
  });
  const arch = useDisposable(() => archGeometry(vaultSpan, vaultRise, 0.38, 0.7));
  const arches = useMemo<InstanceTransform[]>(() => [-9, -6, -3, 0, 3, 6, 9].map((z) => ({ position: [0, ATRIUM_ROOF + 0.3, z] })), []);
  const purlins = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const t of [0.12, 0.3, 0.5, 0.7, 0.88]) {
      const a = Math.PI - t * Math.PI;
      out.push({ position: [Math.cos(a) * (vaultSpan / 2), ATRIUM_ROOF + 0.3 + Math.sin(a) * vaultRise, 0], scale: [0.14, 0.14, V.maxZ - V.minZ] });
    }
    return out;
  }, [vaultSpan, V.maxZ, V.minZ]);

  const inlay = useDisposable(() => new THREE.RingGeometry(FOUNTAIN.planterRadius + 0.6, FOUNTAIN.planterRadius + 1.1, 96).rotateX(-Math.PI / 2));
  const brassRing = useDisposable(() => new THREE.RingGeometry(FOUNTAIN.planterRadius + 2.6, FOUNTAIN.planterRadius + 2.7, 128).rotateX(-Math.PI / 2));

  const ground = useMemo(
    () => ({
      marble: [AREAS.entrance, AREAS.eastWing, AREAS.westWing] as Rect[],
      terrazzo: [AREAS.atrium, AREAS.northCourt] as Rect[],
      bands: [
        { minX: 16, maxX: 60, minZ: -4.4, maxZ: -3.8 },
        { minX: 16, maxX: 60, minZ: 3.8, maxZ: 4.4 },
        { minX: -60, maxX: -16, minZ: -4.4, maxZ: -3.8 },
        { minX: -60, maxX: -16, minZ: 3.8, maxZ: 4.4 },
        { minX: -0.3, maxX: 0.3, minZ: 16, maxZ: 33.4 },
      ] as Rect[],
    }),
    [],
  );
  const upper = useMemo(
    () =>
      Array.from({ length: FLOOR_COUNT - 1 }, (_, i) => {
        const f = i + 1;
        return { f, marble: [...WALKWAYS, ...(BRIDGES[f] ?? [])] as Rect[], terrazzo: [...GALLERY_RING, AREAS.northCourt] as Rect[] };
      }),
    [],
  );

  return (
    <group>
      {/* Floors */}
      <FloorRects rects={ground.marble} material={m.floorMarble} uvScale={2.4} />
      <FloorRects rects={ground.terrazzo} material={m.floorTerrazzo} uvScale={3} />
      <FloorRects rects={ground.bands} material={m.floorBand} uvScale={2.4} y={0.003} />
      {upper.map((u) => (
        <group key={u.f}>
          <FloorRects rects={u.marble} material={m.floorMarble} uvScale={2.4} y={floorY(u.f)} />
          <FloorRects rects={u.terrazzo} material={m.floorTerrazzo} uvScale={3} y={floorY(u.f)} />
        </group>
      ))}
      <mesh geometry={inlay} material={m.floorBand} position={[FOUNTAIN.x, 0.004, FOUNTAIN.z]} receiveShadow />
      <mesh geometry={brassRing} material={m.brass} position={[FOUNTAIN.x, 0.005, FOUNTAIN.z]} />

      {/* Walls, slabs and balustrades */}
      <StaticBoxes boxes={data.walls} material={m.wallStone} uvScale={2.4} castShadow />
      <mesh geometry={wallAO} material={m.wallAO} renderOrder={1} />
      <StaticBoxes boxes={data.slabs} material={m.ceiling} castShadow />
      <StaticBoxes boxes={data.rails.fascia} material={m.whiteSatin} />
      <StaticBoxes boxes={data.rails.glass} material={m.glassRail} receiveShadow={false} />
      <StaticBoxes boxes={data.rails.brass} material={m.brass} />
      <StaticBoxes boxes={data.rails.shoe} material={m.steel} />

      {/* Roof, ceilings, skylights */}
      <StaticBoxes boxes={data.roofs} material={m.ceiling} castShadow />
      <StaticBoxes boxes={data.ribs} material={m.whiteSatin} castShadow />
      <StaticBoxes boxes={data.slats} material={m.oak} castShadow />
      <mesh geometry={vault} material={m.vaultOuter} />
      <Instanced geometry={arch} material={m.oak} transforms={arches} castShadow />
      <Instanced geometry={geo.box()} material={m.oak} transforms={purlins} castShadow />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={geo.plane()} material={m.glass} position={[38 * s, ATRIUM_ROOF + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[44, W * 2, 1]} />
      ))}

      {/* Downlights and their light pools */}
      <Instanced geometry={geo.disk(20)} material={m.lightWarm} transforms={downlights} />
      <LightPools pools={pools} />
    </group>
  );
}
