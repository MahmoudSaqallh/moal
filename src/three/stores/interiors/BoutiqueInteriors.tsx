"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { StoreConfig } from "@/types";
import { boxFromBounds, type BoxSpec } from "../../architecture/geometry";
import { Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "../../architecture/primitives";
import { geo } from "../../architecture/shared";
import { getLibrary } from "../../materials/library";
import { seeded } from "../../materials/textures";
import { paintMenuBoard } from "../../materials/signage";
import { toTexture } from "../../materials/textures";
import { CafeSets, LightPools } from "../../environments/Furniture";
import { StoreShell } from "../StoreInterior";

/* All coordinates below are store-local (see data/storeLayouts.ts for matching obstacles). */

const GARMENT_TONES = ["#d8cbb6", "#b48a5e", "#2a2d33", "#e9e2d4", "#8c8f86", "#6f6b4a", "#cdb79a", "#3d4f3e"];

/** Wall rail of hanging garments (one draw call for all garments). */
function GarmentRail({ x, z0, z1, side }: { x: number; z0: number; z1: number; side: 1 | -1 }) {
  const m = getLibrary();
  const { garments, colors } = useMemo(() => {
    const garments: InstanceTransform[] = [];
    const colors: string[] = [];
    const rand = seeded(Math.round(x * 10 + z0));
    for (let z = z0; z <= z1; z += 0.16) {
      const len = 0.8 + rand() * 0.35;
      garments.push({ position: [x + side * 0.02, 1.7 - len / 2, z], rotation: [0, 0, (rand() - 0.5) * 0.04], scale: [0.5, len, 0.05] });
      colors.push(GARMENT_TONES[Math.floor(rand() * GARMENT_TONES.length)]);
    }
    return { garments, colors };
  }, [x, z0, z1, side]);
  const len = z1 - z0 + 0.4;
  return (
    <group>
      <mesh geometry={geo.rod(10)} material={m.brass} position={[x, 1.74, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.016, len, 0.016]} />
      {[z0 - 0.15, z1 + 0.15].map((z) => (
        <mesh key={z} geometry={geo.box()} material={m.brass} position={[x - side * 0.3, 1.74, z]} scale={[0.6, 0.02, 0.02]} />
      ))}
      <Instanced geometry={geo.box()} material={m.fabricWhite} transforms={garments} colors={colors} castShadow />
      <mesh geometry={geo.box()} material={m.oak} position={[x - side * 0.05, 2.25, (z0 + z1) / 2]} scale={[0.6, 0.04, len]} />
    </group>
  );
}

export function BoutiqueInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
  const tableTop = useDisposable(() => new RoundedBoxGeometry(4.4, 0.06, 2.4, 4, 0.03));
  const stacks = useMemo<InstanceTransform[]>(
    () => [-1.6, -1.0, 1.0, 1.6].flatMap((x) => [0, 1, 2].map((k) => ({ position: [x, 0.88 + k * 0.05, -6.5] as const, rotation: [0, k * 0.05, 0] as const, scale: [0.36, 0.045, 0.28] as const }))),
    [],
  );
  const stackColors = useMemo(() => stacks.map((_, i) => GARMENT_TONES[(i * 3) % GARMENT_TONES.length]), [stacks]);
  const arches = useMemo(() => [-5, 0, 5], []);
  return (
    <StoreShell store={store}>
      <GarmentRail x={-half + 0.55} z0={-12} z1={-2.6} side={-1} />
      <GarmentRail x={half - 0.55} z0={-12} z1={-2.6} side={1} />
      {/* Central oak table with folded knitwear */}
      <mesh geometry={geo.boxBase()} material={m.oakDark} position={[0, 0, -6.5]} scale={[3.6, 0.82, 1.6]} castShadow />
      <mesh geometry={tableTop} material={m.oak} position={[0, 0.85, -6.5]} castShadow receiveShadow />
      <Instanced geometry={geo.box()} material={m.fabricWhite} transforms={stacks} colors={stackColors} />
      {/* Mannequin plinths */}
      {[
        [-4.5, -9.5],
        [4.5, -9.5],
        [0, -11.6],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.cyl(48)} material={m.whiteSatin} position={[x, 0, z]} scale={[0.75, 0.22, 0.75]} castShadow receiveShadow />
      ))}
      {/* Back wall: arched niches with lit shelves */}
      {arches.map((x) => (
        <group key={x} position={[x, 0, -d + 0.45]}>
          <mesh geometry={geo.boxBase()} material={m.oak} position={[0, 0, 0]} scale={[2.6, 3.4, 0.5]} />
          <mesh geometry={geo.plane()} material={m.frostedLight} position={[0, 1.9, 0.26]} scale={[2.2, 2.6, 1]} />
          {[1.0, 1.7, 2.4].map((y) => (
            <mesh key={y} geometry={geo.box()} material={m.whiteSatin} position={[0, y, 0.35]} scale={[2.2, 0.04, 0.3]} />
          ))}
          {[1.0, 1.7, 2.4].flatMap((y) =>
            [-0.6, 0, 0.6].map((dx) => (
              <mesh key={`${y}${dx}`} geometry={geo.boxBase()} material={(dx + y) % 2 > 1 ? m.leather : m.fabricCharcoal} position={[dx, y + 0.02, 0.35]} scale={[0.32, 0.22, 0.14]} />
            )),
          )}
        </group>
      ))}
      {/* Warm ceiling coves along both walls */}
      <mesh geometry={geo.box()} material={m.lightWarm} position={[-half + 0.2, store.height - 0.25, -7]} scale={[0.04, 0.04, d - 1]} />
      <mesh geometry={geo.box()} material={m.lightWarm} position={[half - 0.2, store.height - 0.25, -7]} scale={[0.04, 0.04, d - 1]} />
      <LightPools pools={[{ x: 0, z: -6.5, r: 3 }, { x: -4.5, z: -9.5, r: 1.6 }, { x: 4.5, z: -9.5, r: 1.6 }, { x: 0, z: -11.6, r: 1.6 }]} />
    </StoreShell>
  );
}

export function JewelInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const d = store.depth;
  const half = store.width / 2;
  const vitrines = [-4.5, 4.5];
  const bottles = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const y of [0.92, 1.52, 2.12]) for (let z = -10.6; z <= -7.2; z += 0.38) if (!(y === 1.52 && Math.abs(z + 9) < 0.3)) out.push({ position: [-half + 0.45, y, z], scale: [0.06, 0.12, 0.04] });
    return out;
  }, [half]);
  const bags = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const x of [-6, -3, 3, 6]) for (const y of [0.95, 1.75]) out.push({ position: [x, y, -d + 0.4], scale: [0.36, 0.26, 0.14] });
    return out;
  }, [d]);
  const bagColors = useMemo(() => bags.map((_, i) => ["#8a4f2a", "#1c1a19", "#e2d7c3", "#5b3a2e"][i % 4]), [bags]);
  return (
    <StoreShell store={store}>
      {/* Linear vitrines: bronze plinth, velvet tray, glass hood */}
      {vitrines.map((x) => (
        <group key={x} position={[x, 0, -6.5]}>
          <mesh geometry={geo.boxBase()} material={m.bronze} scale={[3.3, 0.9, 1.1]} castShadow />
          <mesh geometry={geo.boxBase()} material={m.velvet} position={[0, 0.9, 0]} scale={[3.1, 0.06, 0.95]} />
          <mesh geometry={geo.boxBase()} material={m.glassRail} position={[0, 0.96, 0]} scale={[3.2, 0.38, 1.0]} />
          <mesh geometry={geo.box()} material={m.lightWarm} position={[0, 1.33, 0]} scale={[3.0, 0.015, 0.04]} />
          <mesh geometry={geo.box()} material={m.brass} position={[0, 0.9, 0.56]} scale={[3.3, 0.04, 0.02]} />
        </group>
      ))}
      {/* Round centre vitrine */}
      <mesh geometry={geo.cyl(48)} material={m.bronze} position={[0, 0, -9.6]} scale={[0.85, 0.9, 0.85]} castShadow />
      <mesh geometry={geo.cyl(48)} material={m.velvet} position={[0, 0.9, -9.6]} scale={[0.8, 0.06, 0.8]} />
      <mesh geometry={geo.cyl(48)} material={m.glassRail} position={[0, 0.96, -9.6]} scale={[0.82, 0.4, 0.82]} />
      {/* Back wall of lit niches, mirror piers between them */}
      <StaticBoxes
        boxes={[-6, -3, 0, 3, 6].map((x) => boxFromBounds(x - 1.2, x + 1.2, 0.6, 2.6, -d, -d + 0.08))}
        material={m.lightAmber}
        receiveShadow={false}
      />
      <StaticBoxes
        boxes={[-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].map((x) => boxFromBounds(x - 0.3, x + 0.3, 0, 3.4, -d, -d + 0.12))}
        material={m.mirror}
      />
      <StaticBoxes
        boxes={[0.85, 1.65, 2.45].flatMap((y) => [boxFromBounds(-8.6, 8.6, y - 0.03, y + 0.03, -d, -d + 0.8)])}
        material={m.bronze}
      />
      <mesh geometry={geo.boxBase()} material={m.bronze} position={[0, 0, -d + 0.5]} scale={[store.width, 0.6, 1.0]} />
      <Instanced geometry={geo.boxBase()} material={m.satinWhiteTint} transforms={bags} colors={bagColors} castShadow />
      {/* Fragrance niche */}
      <mesh geometry={geo.plane()} material={m.lightAmber} position={[-half + 0.02, 1.6, -9]} rotation={[0, Math.PI / 2, 0]} scale={[4.2, 2.2, 1]} />
      {[0.9, 1.5, 2.1].map((y) => (
        <mesh key={y} geometry={geo.box()} material={m.brass} position={[-half + 0.45, y, -9]} scale={[0.9, 0.03, 4.4]} />
      ))}
      <Instanced geometry={geo.boxBase()} material={m.glassRail} transforms={bottles} />
      {/* Chandelier of brass rings */}
      {[1.6, 1.2, 0.8].map((r, i) => (
        <mesh key={r} geometry={geo.torus(0.02, 96)} material={m.brass} position={[0, store.height - 1.0 - i * 0.25, -8]} scale={r} />
      ))}
      <mesh geometry={geo.torus(0.012, 96)} material={m.lightWarm} position={[0, store.height - 1.0, -8]} scale={1.58} />
      <LightPools pools={[{ x: -4.5, z: -6.5, r: 2 }, { x: 4.5, z: -6.5, r: 2 }, { x: 0, z: -9.6, r: 1.5 }, { x: 0, z: -8, r: 4 }]} />
    </StoreShell>
  );
}

const SNEAKER_TONES = ["#f2f0ea", "#1d1d1d", "#b77757", "#6c7356", "#c3ab86", "#5d6670", "#e6dfd2", "#8a3b2e", "#2c4a6b"];

/** Floating plaster shelves with warm under-glow and rows of sneakers (sneaker store reference). */
function SneakerShelves({ alongX, fixed, from, to, depthSign, skip }: { alongX: boolean; fixed: number; from: number; to: number; depthSign: 1 | -1; skip?: [number, number][] }) {
  const m = getLibrary();
  const levels = [0.92, 1.3, 1.68, 2.06, 2.44];
  const { shelves, glows } = useMemo(() => {
    const shelves: BoxSpec[] = [];
    const glows: BoxSpec[] = [];
    const len = to - from;
    const mid = (from + to) / 2;
    for (const y of levels) {
      const c = fixed + depthSign * 0.3;
      shelves.push(alongX ? { x: mid, y: y - 0.04, z: c, w: len, h: 0.08, d: 0.55 } : { x: c, y: y - 0.04, z: mid, w: 0.55, h: 0.08, d: len });
      const g = fixed + depthSign * 0.5;
      glows.push(alongX ? { x: mid, y: y - 0.09, z: g, w: len, h: 0.012, d: 0.03 } : { x: g, y: y - 0.09, z: mid, w: 0.03, h: 0.012, d: len });
    }
    return { shelves, glows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alongX, fixed, from, to, depthSign]);
  const { uppers, soles, colors } = useMemo(() => {
    const uppers: InstanceTransform[] = [];
    const soles: InstanceTransform[] = [];
    const colors: string[] = [];
    const rand = seeded(Math.round(fixed * 7 + from));
    for (const y of levels) {
      for (let v = from + 0.4; v <= to - 0.3; v += 0.62) {
        if (skip?.some(([a, b]) => Math.abs(a - v) < 0.4 && Math.abs(b - y) < 0.1)) continue;
        const c = fixed + depthSign * 0.3;
        const x = alongX ? v : c;
        const z = alongX ? c : v;
        const rot = alongX ? 0.35 : Math.PI / 2 + 0.35;
        // Capsule laid on its side: Rz lays it along X, then Ry turns it on the shelf.
        uppers.push({ position: [x, y + 0.06, z], rotation: [0, rot, Math.PI / 2], scale: [0.075, 0.14, 0.1] });
        soles.push({ position: [x, y + 0.012, z], rotation: [0, rot, 0], scale: [0.29, 0.025, 0.105] });
        colors.push(SNEAKER_TONES[Math.floor(rand() * SNEAKER_TONES.length)]);
      }
    }
    return { uppers, soles, colors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alongX, fixed, from, to, depthSign, skip]);
  return (
    <group>
      <StaticBoxes boxes={shelves} material={m.wallPlaster} />
      <StaticBoxes boxes={glows} material={m.lightWarm} receiveShadow={false} />
      <Instanced geometry={geo.capsule()} material={m.fabricWhite} transforms={uppers} colors={colors} />
      <Instanced geometry={geo.box()} material={m.whiteSatin} transforms={soles} />
    </group>
  );
}

export function SneakerInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
  const bench = useDisposable(() => new RoundedBoxGeometry(5.6, 0.45, 1.8, 6, 0.22));
  const cove = useDisposable(() => {
    const g = new THREE.CircleGeometry(1, 64);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const skipRight = useMemo<[number, number][]>(() => [[-5.8, 1.3]], []);
  const skipBack = useMemo<[number, number][]>(() => [[2.2, 1.3]], []);
  return (
    <StoreShell store={store} ceilingLights={false}>
      <SneakerShelves alongX={false} fixed={half} from={-12.8} to={-2.4} depthSign={-1} skip={skipRight} />
      <SneakerShelves alongX fixed={-d} from={-8.4} to={8.4} depthSign={1} skip={skipBack} />
      {/* Stepped plinths along the left wall */}
      <mesh geometry={geo.boxBase()} material={m.wallPlaster} position={[-7.5, 0, -7.4]} scale={[0.8, 0.6, 9.6]} castShadow receiveShadow />
      <mesh geometry={geo.boxBase()} material={m.wallPlaster} position={[-8.45, 0, -7.4]} scale={[1.1, 1.0, 9.6]} castShadow receiveShadow />
      <mesh geometry={geo.box()} material={m.lightWarm} position={[-7.1, 0.05, -7.4]} scale={[0.02, 0.02, 9.4]} />
      {[-10.5, -9, -4.5, -3.2].map((z, i) => (
        <group key={z} position={[i % 2 ? -8.4 : -7.5, i % 2 ? 1.0 : 0.6, z]} rotation={[0, Math.PI / 2 + 0.3, 0]}>
          <mesh geometry={geo.capsule()} material={i % 2 ? m.fabricCharcoal : m.fabricCream} position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.075, 0.14, 0.1]} />
          <mesh geometry={geo.box()} material={m.whiteSatin} position={[0, 0.012, 0]} scale={[0.29, 0.025, 0.105]} />
        </group>
      ))}
      {/* Organic bench and hero plinth */}
      <mesh geometry={bench} material={m.wallPlaster} position={[0, 0.225, -7.5]} castShadow receiveShadow />
      <mesh geometry={geo.box()} material={m.lightWarm} position={[0, 0.03, -7.5]} scale={[5.4, 0.02, 1.6]} />
      <mesh geometry={geo.cyl(48)} material={m.wallPlaster} position={[-3.5, 0, -10.6]} scale={[0.7, 0.76, 0.7]} castShadow receiveShadow />
      {/* Floating ceiling disc with a warm cove (stands in for the reference's sculpted ceiling) */}
      <mesh geometry={cove} material={m.wallPlaster} position={[0, store.height - 0.5, -7.5]} scale={[6.4, 1, 4.6]} />
      <mesh geometry={geo.torus(0.02, 128)} material={m.lightWarm} position={[0, store.height - 0.48, -7.5]} scale={[6.5, 1, 4.7]} />
      <mesh geometry={cove} material={m.lightWarm} position={[0, store.height - 0.02, -7.5]} scale={[6.0, 1, 4.2]} />
      <LightPools pools={[{ x: 0, z: -7.5, r: 5.5 }, { x: half - 1.2, z: -7.5, r: 3 }, { x: 0, z: -d + 1.2, r: 3 }, { x: -3.5, z: -10.6, r: 1.4 }]} />
    </StoreShell>
  );
}

export function ShowroomInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const d = store.depth;
  const half = store.width / 2;
  const shelving = useMemo(() => {
    const boxes: BoxSpec[] = [];
    for (let x = -half + 0.3; x <= half - 0.29; x += 1.5) boxes.push(boxFromBounds(x - 0.03, x + 0.03, 0, 3.6, -d, -d + 0.45));
    for (const y of [0.05, 0.9, 1.75, 2.6, 3.45]) boxes.push(boxFromBounds(-half + 0.3, half - 0.3, y, y + 0.04, -d, -d + 0.45));
    return boxes;
  }, [half, d]);
  const objects = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    const rand = seeded(5);
    for (const y of [0.94, 1.79, 2.64])
      for (let x = -half + 0.8; x < half - 0.6; x += 0.7) if (rand() > 0.3) out.push({ position: [x, y, -d + 0.22], scale: [0.09 + rand() * 0.06, 0.1 + rand() * 0.2, 0.09 + rand() * 0.06] });
    return out;
  }, [half, d]);
  const objectColors = useMemo(() => objects.map((_, i) => ["#d9c8ad", "#45413c", "#9aa58c", "#efe8dc", "#b06c4c"][i % 5]), [objects]);
  return (
    <StoreShell store={store}>
      <mesh geometry={geo.boxBase()} material={m.fabricCream} position={[-2.6, 0, -8.3]} scale={[4.8, 0.012, 3.8]} receiveShadow />
      {/* Coffee table */}
      <mesh geometry={geo.cyl(48)} material={m.oak} position={[-2.6, 0.32, -8]} scale={[0.6, 0.06, 0.6]} castShadow />
      <mesh geometry={geo.cyl(24)} material={m.oakDark} position={[-2.6, 0, -8]} scale={[0.32, 0.32, 0.32]} />
      {/* Plinths for ceramics */}
      {[
        [-4.5, 0.5],
        [-6, 0.8],
        [-7.5, 0.65],
      ].map(([z, h]) => (
        <mesh key={z} geometry={geo.boxBase()} material={m.wallPlaster} position={[4.2, 0, z]} scale={[0.8, h, 0.8]} castShadow receiveShadow />
      ))}
      <mesh geometry={geo.sphere(24)} material={m.fabricSage} position={[4.2, 0.62, -4.5]} scale={[0.14, 0.12, 0.14]} />
      <mesh geometry={geo.cyl(24)} material={m.whiteSatin} position={[4.2, 0.65, -7.5]} scale={[0.1, 0.32, 0.1]} />
      {/* Dining set */}
      <mesh geometry={geo.boxBase()} material={m.oak} position={[1.6, 0.72, -12.45]} scale={[2.8, 0.05, 1.0]} castShadow />
      {[0.5, 2.7].map((x) => (
        <mesh key={x} geometry={geo.boxBase()} material={m.oakDark} position={[x, 0, -12.45]} scale={[0.08, 0.72, 0.8]} />
      ))}
      {[0.6, 1.6, 2.6].flatMap((x) =>
        [-13.2, -11.7].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh geometry={geo.boxBase()} material={m.oak} position={[0, 0.44, 0]} scale={[0.44, 0.04, 0.42]} />
            <mesh geometry={geo.boxBase()} material={m.oak} position={[0, 0.44, z < -12.45 ? -0.2 : 0.2]} scale={[0.44, 0.42, 0.03]} />
            {[-0.18, 0.18].flatMap((lx) => [-0.17, 0.17].map((lz) => <mesh key={`${lx}${lz}`} geometry={geo.boxBase()} material={m.oakDark} position={[lx, 0, lz]} scale={[0.03, 0.44, 0.03]} />))}
          </group>
        )),
      )}
      {[0.9, 2.3].map((x) => (
        <group key={x} position={[x, 0, -12.45]}>
          <mesh geometry={geo.sphere(24)} material={m.lightWarm} position={[0, 2.2, 0]} scale={0.22} />
          <mesh geometry={geo.rod(6)} material={m.blackMetal} position={[0, 3.9, 0]} scale={[0.006, 3.2, 0.006]} />
        </group>
      ))}
      {/* Shelving wall */}
      <StaticBoxes boxes={shelving} material={m.oak} />
      <Instanced geometry={geo.cyl(20)} material={m.satinWhiteTint} transforms={objects} colors={objectColors} castShadow />
      <mesh geometry={geo.boxBase()} material={m.oak} position={[half - 0.4, 0, -11.6]} scale={[0.8, 1.9, 4.8]} />
      <LightPools pools={[{ x: -2.6, z: -8.3, r: 3.2 }, { x: 4.2, z: -6, r: 2 }, { x: 1.6, z: -12.45, r: 2 }]} />
    </StoreShell>
  );
}

export function CafeInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const d = store.depth;
  const half = store.width / 2;
  const menu = useDisposable(() => {
    const tex = toTexture(paintMenuBoard(), { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.1, 1.1, 1.1) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  });
  const counterSlats = useMemo(() => {
    const boxes: BoxSpec[] = [];
    for (let x = -6.1; x <= 4.1; x += 0.16) boxes.push(boxFromBounds(x - 0.05, x + 0.05, 0.05, 1.0, -9.42, -9.36));
    return boxes;
  }, []);
  const bags = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const y of [0.82, 1.62]) for (let z = -8.8; z <= -2.8; z += 0.32) out.push({ position: [half - 0.45, y, z], rotation: [0, -Math.PI / 2, 0], scale: [0.12, 0.2, 0.07] });
    for (let z = -8.6; z <= -2.8; z += 0.32) if (Math.abs(z + 5.2) > 0.25) out.push({ position: [half - 0.45, 1.22, z], rotation: [0, -Math.PI / 2, 0], scale: [0.12, 0.2, 0.07] });
    return out;
  }, [half]);
  const bagColors = useMemo(() => bags.map((_, i) => ["#b48b5e", "#3b2a1e", "#c87f4a", "#e9e1d3"][i % 4]), [bags]);
  const jars = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const y of [1.55, 2.2]) for (let x = -7; x <= 7; x += 0.45) out.push({ position: [x, y, -d + 0.25], scale: [0.09, 0.22, 0.09] });
    return out;
  }, [d]);
  const sets = useMemo(
    () => [
      { x: -5.4, z: -4.2, rotY: 0.3, chairs: 3 },
      { x: -5.4, z: -7.2, rotY: 1.1, chairs: 2 },
      { x: 4.6, z: -4.2, rotY: 0.7, chairs: 3 },
    ],
    [],
  );
  return (
    <StoreShell store={store} ceilingLights={false}>
      {/* Front counter */}
      <mesh geometry={geo.boxBase()} material={m.oakDark} position={[-1, 0, -10.2]} scale={[10.4, 1.0, 1.5]} castShadow />
      <StaticBoxes boxes={counterSlats} material={m.oak} />
      <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[-1, 1.0, -10.2]} scale={[10.6, 0.06, 1.6]} receiveShadow />
      {/* Pastry vitrine */}
      <mesh geometry={geo.boxBase()} material={m.glassRail} position={[0.2, 1.06, -10.3]} scale={[1.6, 0.42, 0.8]} />
      <mesh geometry={geo.box()} material={m.lightWarm} position={[0.2, 1.47, -10.3]} scale={[1.5, 0.01, 0.04]} />
      {[-0.5, -0.15, 0.2, 0.55, 0.9].map((x) => (
        <mesh key={x} geometry={geo.sphere(14)} material={m.oak} position={[x, 1.12, -10.3]} scale={[0.09, 0.05, 0.09]} />
      ))}
      {/* Back bar, shelves, menu boards */}
      <mesh geometry={geo.boxBase()} material={m.oakDark} position={[0, 0, -d + 0.55]} scale={[store.width, 0.95, 1.1]} />
      <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[0, 0.95, -d + 0.55]} scale={[store.width, 0.05, 1.12]} />
      {[1.45, 2.1].map((y) => (
        <mesh key={y} geometry={geo.box()} material={m.oak} position={[0, y, -d + 0.22]} scale={[store.width - 0.4, 0.04, 0.4]} />
      ))}
      <Instanced geometry={geo.cyl(16)} material={m.glassRail} transforms={jars} />
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 3.4, -d + 0.04]}>
          <mesh geometry={geo.box()} material={m.oakDark} scale={[3.3, 1.7, 0.06]} />
          <mesh geometry={geo.plane()} material={menu} position={[0, 0, 0.035]} scale={[3.2, 1.6, 1]} />
        </group>
      ))}
      {/* Pendant lights over the counter */}
      {[-5, -2.5, 0, 2.5].map((x) => (
        <group key={x} position={[x, 0, -10.2]}>
          <mesh geometry={geo.rod(6)} material={m.blackMetal} position={[0, 3.9, 0]} scale={[0.006, 3.4, 0.006]} />
          <mesh geometry={geo.cyl(24)} material={m.brass} position={[0, 2.2, 0]} scale={[0.22, 0.18, 0.22]} />
          <mesh geometry={geo.disk(24)} material={m.lightWarm} position={[0, 2.19, 0]} rotation={[Math.PI, 0, 0]} scale={0.2} />
        </group>
      ))}
      {/* Retail shelf with beans and cups */}
      <mesh geometry={geo.boxBase()} material={m.oak} position={[half - 0.45, 0, -5.8]} scale={[0.9, 0.05, 6.8]} />
      {[0.8, 1.2, 1.6, 2.0].map((y) => (
        <mesh key={y} geometry={geo.box()} material={m.oak} position={[half - 0.45, y - 0.02, -5.8]} scale={[0.85, 0.04, 6.8]} />
      ))}
      <Instanced geometry={geo.boxBase()} material={m.satinWhiteTint} transforms={bags} colors={bagColors} />
      <CafeSets sets={sets} />
      <LightPools pools={[{ x: -1, z: -10.2, r: 4 }, { x: -5.4, z: -5.7, r: 2.6 }, { x: 4.6, z: -4.2, r: 1.8 }, { x: half - 1, z: -5.8, r: 2.4 }]} />
    </StoreShell>
  );
}
