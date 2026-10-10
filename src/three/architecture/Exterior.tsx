"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ATRIUM_VOID, WING_VOID_HALF_WIDTH, DIMENSIONS } from "@/data/layout";
import type { Rect } from "@/types";
import { boxFromBounds, type BoxSpec } from "./geometry";
import { FloorRects, Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { ENTRANCE_CEILING } from "./constants";
import { FLOOR_COUNT, FLOOR_HEIGHT, ROOF_HEIGHT } from "@/data/floors";
import { getLibrary } from "../materials/library";
import { Palms, Shrubs, Trees, type TreeSpec } from "../environments/Plants";
import { Bollards, LampPosts } from "../environments/Furniture";
import { TextSign } from "../environments/Signage";

/* ── Building envelope ─────────────────────────────────────────────────── */

const FRONT_Z = 22; // south face of the main block
const ROOF_Y = ROOF_HEIGHT + 0.6;
const BLOCK = { minX: -76, maxX: 62, minZ: -22, maxZ: FRONT_Z };
const FZ = DIMENSIONS.entranceFacadeZ;

/** The signature canopy: a leaf-shaped glass roof over the entrance pavilion. */
function canopyPoint(u: number, v: number, out = new THREE.Vector3()) {
  const x = -24 + 48 * u;
  const zFront = 40 + 6 * Math.sin(Math.PI * u);
  const z = 20 + (zFront - 20) * v;
  const y = 13.8 + 2.6 * Math.pow(v, 1.4) + 1.0 * Math.sin(Math.PI * u) * v;
  return out.set(x, y, z);
}

function canopyAt(x: number, z: number) {
  const u = (x + 24) / 48;
  const zFront = 40 + 6 * Math.sin(Math.PI * u);
  const v = (z - 20) / (zFront - 20);
  return canopyPoint(u, v);
}

function canopySurface() {
  const nu = 32;
  const nv = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      canopyPoint(i / nu, j / nv, p);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Triangulated lattice members as oriented instances of a unit box. */
function canopyLattice(): InstanceTransform[] {
  const nu = 12;
  const nv = 6;
  const pts: THREE.Vector3[][] = [];
  for (let j = 0; j <= nv; j++) {
    pts.push([]);
    for (let i = 0; i <= nu; i++) pts[j].push(canopyPoint(i / nu, j / nv));
  }
  const members: [THREE.Vector3, THREE.Vector3][] = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      if (i < nu) members.push([pts[j][i], pts[j][i + 1]]);
      if (j < nv) members.push([pts[j][i], pts[j + 1][i]]);
      if (i < nu && j < nv) members.push((i + j) % 2 ? [pts[j][i], pts[j + 1][i + 1]] : [pts[j][i + 1], pts[j + 1][i]]);
    }
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  return members.map(([a, b]) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    e.setFromQuaternion(q);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    return { position: [mid.x, mid.y - 0.05, mid.z], rotation: [e.x, e.y, e.z], scale: [0.09, len, 0.16] };
  });
}

function rimTube(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, radius, 10, false);
}

/** White branching "tree" columns carrying the canopy. */
function treeColumn(x: number, z: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunkTop = new THREE.Vector3(x, 7.2, z);
  const trunk = new THREE.CylinderGeometry(0.34, 0.48, 7.2, 20).translate(x, 3.6, z);
  parts.push(trunk);
  const targets = [
    [x - 3.8, z - 2.6],
    [x + 3.4, z - 3.0],
    [x - 2.6, z + 3.2],
    [x + 3.0, z + 3.4],
    [x + 0.4, z - 4.6],
  ];
  for (const [tx, tz] of targets) {
    const end = canopyAt(tx, tz);
    end.y -= 0.12;
    const dir = new THREE.Vector3().subVectors(end, trunkTop);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(0.1, 0.3, len, 12);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.applyQuaternion(q);
    g.translate(trunkTop.x, trunkTop.y, trunkTop.z);
    parts.push(g);
  }
  const node = new THREE.SphereGeometry(0.42, 16, 12).translate(trunkTop.x, trunkTop.y, trunkTop.z);
  parts.push(node);
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function Canopy() {
  const m = getLibrary();
  const surface = useDisposable(() => canopySurface());
  const lattice = useMemo(() => canopyLattice(), []);
  const rim = useDisposable(() => {
    const front: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) front.push(canopyPoint(i / 40, 1));
    return rimTube(front, 0.55);
  });
  const sides = useDisposable(() => {
    const parts = [0, 1].map((u) => {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 20; j++) pts.push(canopyPoint(u, j / 20));
      return rimTube(pts, 0.4);
    });
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
  });
  const columns = useDisposable(() => {
    const parts = [treeColumn(-8.5, 40.5), treeColumn(8.5, 40.5)];
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
  });
  return (
    <group>
      <mesh geometry={surface} material={m.canopyGlass} />
      <Instanced geometry={geo.box()} material={m.whiteSatin} transforms={lattice} castShadow />
      <mesh geometry={rim} material={m.whiteSatin} castShadow />
      <mesh geometry={sides} material={m.whiteSatin} castShadow />
      <mesh geometry={columns} material={m.whiteSatin} castShadow receiveShadow />
      {/* Uplights at the column bases */}
      {[-8.5, 8.5].map((x) => (
        <mesh key={x} geometry={geo.disk(24)} material={m.lightWarm} position={[x, 0.02, 40.5]} scale={0.7} />
      ))}
    </group>
  );
}

function curtainWall(minX: number, maxX: number, z: number, y0: number, y1: number, inward = -1) {
  const glass: BoxSpec[] = [boxFromBounds(minX, maxX, y0, y1, z - 0.03, z + 0.03)];
  const glow: BoxSpec[] = [boxFromBounds(minX, maxX, y0, y1, z + inward * 1.2 - 0.02, z + inward * 1.2 + 0.02)];
  const mullions: BoxSpec[] = [];
  for (let x = minX; x <= maxX + 0.01; x += 1.6) mullions.push({ x, y: (y0 + y1) / 2, z: z + 0.05, w: 0.08, h: y1 - y0, d: 0.16 });
  for (const y of [y0, (y0 + y1) / 2, y1]) mullions.push({ x: (minX + maxX) / 2, y, z: z + 0.05, w: maxX - minX, h: 0.1, d: 0.16 });
  return { glass, glow, mullions };
}

function Building() {
  const m = getLibrary();
  const data = useMemo(() => {
    const glass: BoxSpec[] = [];
    const glow: BoxSpec[] = [];
    const mullions: BoxSpec[] = [];
    const add = (r: ReturnType<typeof curtainWall>) => {
      glass.push(...r.glass);
      glow.push(...r.glow);
      mullions.push(...r.mullions);
    };
    // South elevations either side of the pavilion: shopfront glazing below, lit upper floor above.
    for (const [a, b] of [
      [BLOCK.minX, -18],
      [18, BLOCK.maxX],
    ]) {
      for (let f = 0; f < FLOOR_COUNT; f++) add(curtainWall(a, b, FRONT_Z, f * FLOOR_HEIGHT + 0.3, f * FLOOR_HEIGHT + 6.4));
    }
    // Pavilion glazing beyond the entrance hall, and its sides.
    add(curtainWall(-18, -12, FZ, 0, ENTRANCE_CEILING));
    add(curtainWall(12, 18, FZ, 0, ENTRANCE_CEILING));

    const white: BoxSpec[] = [
      // Floor bands and the projecting white roof fascia
      ...Array.from({ length: FLOOR_COUNT - 1 }, (_, i) => [
        boxFromBounds(BLOCK.minX, -18, (i + 1) * FLOOR_HEIGHT - 0.65, (i + 1) * FLOOR_HEIGHT + 0.3, FRONT_Z - 0.2, FRONT_Z + 0.5),
        boxFromBounds(18, BLOCK.maxX, (i + 1) * FLOOR_HEIGHT - 0.65, (i + 1) * FLOOR_HEIGHT + 0.3, FRONT_Z - 0.2, FRONT_Z + 0.5),
      ]).flat(),
      boxFromBounds(BLOCK.minX - 0.6, BLOCK.maxX + 0.6, ROOF_HEIGHT - 0.7, ROOF_Y + 0.4, FRONT_Z - 0.4, FRONT_Z + 1.4),
      // Pavilion sides and the band above the entrance glass
      boxFromBounds(-18.4, -18, 0, 13.8, FRONT_Z, FZ),
      boxFromBounds(18, 18.4, 0, 13.8, FRONT_Z, FZ),
      boxFromBounds(-18.4, 18.4, ENTRANCE_CEILING, ENTRANCE_CEILING + 0.6, FZ - 0.3, FZ + 0.3),
      // Base plinth
      boxFromBounds(BLOCK.minX, BLOCK.maxX, 0, 0.3, FRONT_Z - 0.3, FRONT_Z + 0.4),
    ];
    // Opaque mass: sides, back and roof (with openings over the interior skylights).
    const stone: BoxSpec[] = [
      boxFromBounds(BLOCK.minX - 0.4, BLOCK.minX, 0, ROOF_Y, BLOCK.minZ, FRONT_Z),
      boxFromBounds(BLOCK.maxX, BLOCK.maxX + 0.4, 0, ROOF_Y, BLOCK.minZ, FRONT_Z),
      boxFromBounds(BLOCK.minX, BLOCK.maxX, 0, ROOF_Y, BLOCK.minZ - 0.4, BLOCK.minZ),
      boxFromBounds(-10.4, 10.4, 0, ROOF_Y, -52.4, BLOCK.minZ),
    ];
    const roofHoles: Rect[] = [
      { minX: 16, maxX: 60, minZ: -WING_VOID_HALF_WIDTH, maxZ: WING_VOID_HALF_WIDTH },
      { minX: -60, maxX: -16, minZ: -WING_VOID_HALF_WIDTH, maxZ: WING_VOID_HALF_WIDTH },
      { minX: ATRIUM_VOID.minX, maxX: ATRIUM_VOID.maxX, minZ: ATRIUM_VOID.minZ, maxZ: ATRIUM_VOID.maxZ },
    ];
    const roof: BoxSpec[] = [];
    const W = WING_VOID_HALF_WIDTH;
    roof.push(boxFromBounds(BLOCK.minX, BLOCK.maxX, ROOF_Y, ROOF_Y + 0.3, BLOCK.minZ, -W));
    roof.push(boxFromBounds(BLOCK.minX, BLOCK.maxX, ROOF_Y, ROOF_Y + 0.3, W, FRONT_Z));
    roof.push(boxFromBounds(BLOCK.minX, -60, ROOF_Y, ROOF_Y + 0.3, -W, W));
    roof.push(boxFromBounds(60, BLOCK.maxX, ROOF_Y, ROOF_Y + 0.3, -W, W));
    roof.push(boxFromBounds(-16, 16, ROOF_Y, ROOF_Y + 0.3, -W, W));
    // Re-open the atrium void through the roof strips that cross it.
    const roofFinal = roof.flatMap((b) => cutHole(b, roofHoles[2]));
    roofFinal.push(boxFromBounds(-10.4, 10.4, ROOF_Y, ROOF_Y + 0.3, -52.4, BLOCK.minZ));
    return { glass, glow, mullions, white, stone, roof: roofFinal };
  }, []);

  return (
    <group>
      <StaticBoxes boxes={data.glow} material={m.shopGlow} uvScale={6.5} receiveShadow={false} />
      <StaticBoxes boxes={data.glass} material={m.glass} receiveShadow={false} />
      <StaticBoxes boxes={data.mullions} material={m.whiteSatin} />
      <StaticBoxes boxes={data.white} material={m.whiteSatin} castShadow />
      <StaticBoxes boxes={data.stone} material={m.wallStone} uvScale={2.4} castShadow />
      <StaticBoxes boxes={data.roof} material={m.whiteMatte} castShadow />
      <TextSign text="MallVerse" font="display" italic color="#8a6a3f" height={2.2} position={[-46, ROOF_HEIGHT - 2.4, FRONT_Z + 1.45]} glow={1.15} />
      <TextSign text="MallVerse" font="display" italic color="#f7efe2" height={1.05} position={[0, 13.0, FZ + 0.32]} glow={1.25} />
    </group>
  );
}

/** Split a box around a rectangular hole in plan (XZ). */
function cutHole(b: BoxSpec, hole: Rect): BoxSpec[] {
  const minX = b.x - b.w / 2;
  const maxX = b.x + b.w / 2;
  const minZ = b.z - b.d / 2;
  const maxZ = b.z + b.d / 2;
  if (hole.minX >= maxX || hole.maxX <= minX || hole.minZ >= maxZ || hole.maxZ <= minZ) return [b];
  const y0 = b.y - b.h / 2;
  const y1 = b.y + b.h / 2;
  const out: BoxSpec[] = [];
  if (hole.minX > minX) out.push(boxFromBounds(minX, hole.minX, y0, y1, minZ, maxZ));
  if (hole.maxX < maxX) out.push(boxFromBounds(hole.maxX, maxX, y0, y1, minZ, maxZ));
  const ix0 = Math.max(minX, hole.minX);
  const ix1 = Math.min(maxX, hole.maxX);
  if (hole.minZ > minZ) out.push(boxFromBounds(ix0, ix1, y0, y1, minZ, hole.minZ));
  if (hole.maxZ < maxZ) out.push(boxFromBounds(ix0, ix1, y0, y1, hole.maxZ, maxZ));
  return out;
}

/* ── Plaza and landscape ──────────────────────────────────────────────── */

const POOL = { x: -36, z: 62, rx: 19, rz: 11 };
const PLANTER = { x: 36, z: 62, r: 9.5 };

function poolShape(rx: number, rz: number) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

function ReflectingPool() {
  const m = getLibrary();
  const jets = useRef<THREE.InstancedMesh>(null);
  const water = useDisposable(() => new THREE.ShapeGeometry(poolShape(POOL.rx, POOL.rz), 64).rotateX(-Math.PI / 2));
  const coping = useDisposable(() => {
    const outer = poolShape(POOL.rx + 0.9, POOL.rz + 0.9);
    outer.holes.push(new THREE.Path().absellipse(0, 0, POOL.rx, POOL.rz, 0, Math.PI * 2, true, 0));
    return new THREE.ExtrudeGeometry(outer, { depth: 0.5, bevelEnabled: false, curveSegments: 64 }).rotateX(-Math.PI / 2);
  });
  const jetGeo = useDisposable(() => new THREE.ConeGeometry(0.16, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI));
  const jetPositions = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      out.push([POOL.x + Math.cos(a) * POOL.rx * 0.62, POOL.z + Math.sin(a) * POOL.rz * 0.62]);
    }
    out.push([POOL.x, POOL.z]);
    return out;
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((state) => {
    const mesh = jets.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    jetPositions.forEach(([x, z], i) => {
      const center = i === jetPositions.length - 1;
      const h = (center ? 4.2 : 2.2) + Math.sin(t * 1.6 + i * 0.9) * (center ? 0.5 : 0.35);
      // The cone tip is at the top after the flip; stretch to the current jet height.
      tmp.p.set(x, 0.2 + h, z);
      tmp.s.set(center ? 1.6 : 1, h, center ? 1.6 : 1);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={water} material={m.water} position={[POOL.x, 0.22, POOL.z]} />
      <mesh geometry={geo.disk(64)} material={m.floorDarkStone} position={[POOL.x, 0.05, POOL.z]} scale={[POOL.rx, 1, POOL.rz]} />
      <mesh geometry={coping} material={m.whiteSatin} position={[POOL.x, 0, POOL.z]} receiveShadow />
      <instancedMesh ref={jets} args={[jetGeo, m.waterStream, jetPositions.length]} frustumCulled={false} />
    </group>
  );
}

function RoundPlanter() {
  const m = getLibrary();
  const wall = useDisposable(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, PLANTER.r, 0, Math.PI * 2, false);
    s.holes.push(new THREE.Path().absarc(0, 0, PLANTER.r - 0.6, 0, Math.PI * 2, true));
    return new THREE.ExtrudeGeometry(s, { depth: 0.65, bevelEnabled: false, curveSegments: 72 }).rotateX(-Math.PI / 2);
  });
  const shrubs = useMemo(() => {
    const out = [];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const r = PLANTER.r - 1.6 - (i % 3) * 0.9;
      out.push({ x: PLANTER.x + Math.cos(a) * r, y: 0.6, z: PLANTER.z + Math.sin(a) * r, r: 0.9 + (i % 4) * 0.15, h: 0.7 });
    }
    return out;
  }, []);
  const bollards = useMemo(() => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      out.push({ x: PLANTER.x + Math.cos(a) * (PLANTER.r + 1.2), z: PLANTER.z + Math.sin(a) * (PLANTER.r + 1.2) });
    }
    return out;
  }, []);
  return (
    <group>
      <mesh geometry={wall} material={m.whiteSatin} position={[PLANTER.x, 0, PLANTER.z]} castShadow receiveShadow />
      <mesh geometry={geo.disk(64)} material={m.soil} position={[PLANTER.x, 0.5, PLANTER.z]} scale={PLANTER.r - 0.6} />
      <Shrubs shrubs={shrubs} />
      <Bollards bollards={bollards} />
    </group>
  );
}

function Inlays() {
  const m = getLibrary();
  const arcs = useDisposable(() => {
    const parts = [
      new THREE.RingGeometry(40, 41, 96, 1, Math.PI * 1.05, Math.PI * 0.42).translate(22, -95, 0),
      new THREE.RingGeometry(26, 26.8, 96, 1, Math.PI * 1.15, Math.PI * 0.5).translate(-6, -88, 0),
      new THREE.RingGeometry(14, 14.6, 96, 1, 0, Math.PI * 2).translate(PLANTER.x, -PLANTER.z, 0),
    ];
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g.rotateX(-Math.PI / 2);
  });
  return <mesh geometry={arcs} material={m.pavingDark} position={[0, 0.012, 0]} receiveShadow />;
}

const PALMS = [
  ...[-26, -36, -46, -56, -66].map((x, i) => ({ x, z: 29 + (i % 2) * 1.5, height: 9 + (i % 3) })),
  ...[26, 40, 52].map((x, i) => ({ x, z: 29 + (i % 2) * 1.5, height: 9.5 + (i % 2) })),
  { x: -16, z: 52, height: 10 },
  { x: -54, z: 48, height: 11 },
];

const PLAZA_TREES: TreeSpec[] = [
  { x: 52, z: 50, height: 9 },
  { x: 64, z: 72, height: 10 },
  { x: -66, z: 74, height: 9 },
  { x: -48, z: 96, height: 10 },
  { x: 30, z: 98, height: 8 },
  { x: PLANTER.x, z: PLANTER.z, height: 8.5, y: 0.5 },
  { x: 76, z: 40, height: 11 },
  { x: -86, z: 44, height: 11 },
];

function backdropTrees(): TreeSpec[] {
  const out: TreeSpec[] = [];
  for (let i = 0; i < 46; i++) {
    const a = Math.PI * (0.05 + (i / 45) * 0.9);
    const r = 150 + ((i * 37) % 40);
    out.push({ x: Math.cos(a) * r * 1.4, z: 30 + Math.sin(a) * r, height: 12 + ((i * 13) % 7), seed: i });
  }
  for (let i = 0; i < 18; i++) out.push({ x: -120 + i * 14, z: 128 + ((i * 7) % 12), height: 10 + (i % 4), seed: 100 + i });
  return out;
}

export function Exterior({ detail }: { detail: number }) {
  const m = getLibrary();
  const paving = useMemo<Rect[]>(() => [{ minX: -100, maxX: 90, minZ: 23, maxZ: 112 }], []);
  // The lawn stops at the building and plaza: a 3 cm offset under interior floors z-fights
  // on low-precision depth buffers (it tinted the atrium green). Under the building a fill
  // sheet sits 40 cm down so gaps between pavilions never show the void.
  const grass = useMemo<Rect[]>(
    () => [
      { minX: -3000, maxX: 3000, minZ: 112, maxZ: 3000 },
      { minX: -3000, maxX: 3000, minZ: -3000, maxZ: -58 },
      { minX: -3000, maxX: -80, minZ: -58, maxZ: 23 },
      { minX: 66, maxX: 3000, minZ: -58, maxZ: 23 },
      { minX: -3000, maxX: -100, minZ: 23, maxZ: 112 },
      { minX: 90, maxX: 3000, minZ: 23, maxZ: 112 },
    ],
    [],
  );
  const underBuilding = useMemo<Rect[]>(() => [{ minX: -80, maxX: 66, minZ: -58, maxZ: 23 }], []);
  const lamps = useMemo(() => [46, 62, 78, 94].flatMap((z) => [{ x: -15, z }, { x: 15, z }]), []);
  const bollards = useMemo(() => {
    const out = [];
    for (let x = -17; x <= 17; x += 2.2) if (Math.abs(x) > 4.5) out.push({ x, z: 36.5 });
    return out;
  }, []);
  const backdrop = useMemo(() => backdropTrees(), []);
  const hedges = useMemo(() => {
    const out = [];
    for (let i = 0; i < 26; i++) out.push({ x: -58 + i * 1.4, y: 0.4, z: 77 + Math.sin(i * 0.5) * 1.5, r: 0.9, h: 0.6 });
    for (let i = 0; i < 18; i++) out.push({ x: -90 + i * 1.4, y: 0.4, z: 36, r: 0.9, h: 0.7 });
    return out;
  }, []);
  return (
    <group>
      <FloorRects rects={grass} material={m.grass} uvScale={14} y={-0.03} />
      <FloorRects rects={underBuilding} material={m.grass} uvScale={14} y={-0.4} />
      <FloorRects rects={paving} material={m.paving} uvScale={3} />
      <Inlays />
      <Building />
      <Canopy />
      <ReflectingPool />
      <RoundPlanter />
      <Palms palms={PALMS} />
      <Trees trees={PLAZA_TREES} density={detail} />
      <Trees trees={backdrop} density={0.55 * detail} />
      <Shrubs shrubs={hedges} />
      <LampPosts posts={lamps} />
      <Bollards bollards={bollards} />
    </group>
  );
}
