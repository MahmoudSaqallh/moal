"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { geo } from "../architecture/shared";
import { mergeBoxes, boxFromBounds } from "../architecture/geometry";
import { Instanced, useDisposable, type InstanceTransform } from "../architecture/primitives";
import { getLibrary } from "../materials/library";
import { paintDirectoryScreen } from "../materials/signage";
import { toTexture } from "../materials/textures";

interface Placement {
  x: number;
  z: number;
  rotY: number;
}

/** Blob shadows under props — baked contact shading, nearly free to render. */
export function BlobShadows({ items }: { items: readonly { x: number; z: number; sx: number; sz: number; rotY?: number; y?: number }[] }) {
  const m = getLibrary();
  const transforms = useMemo<InstanceTransform[]>(
    () => items.map((i) => ({ position: [i.x, (i.y ?? 0) + 0.006, i.z], rotation: [0, i.rotY ?? 0, 0], scale: [i.sx, 1, i.sz] })),
    [items],
  );
  return <Instanced geometry={geo.flat()} material={m.blobShadow} transforms={transforms} renderOrder={1} />;
}

/** Warm pools of light on the floor beneath downlights (additive decals). */
export function LightPools({
  pools,
  cool = false,
}: {
  pools: readonly { x: number; z: number; r: number; y?: number }[];
  cool?: boolean;
}) {
  const m = getLibrary();
  const transforms = useMemo<InstanceTransform[]>(
    () => pools.map((p) => ({ position: [p.x, (p.y ?? 0) + 0.01, p.z], scale: [p.r * 2, 1, p.r * 2] })),
    [pools],
  );
  return (
    <Instanced
      geometry={geo.flat()}
      material={cool ? m.lightPoolCool : m.lightPool}
      transforms={transforms}
      renderOrder={2}
    />
  );
}

/** Stone plinth bench with an oak seat (after the atrium reference). */
export function Benches({ benches }: { benches: readonly Placement[] }) {
  const m = getLibrary();
  const base = useMemo<InstanceTransform[]>(
    () => benches.map((b) => ({ position: [b.x, 0, b.z], rotation: [0, b.rotY, 0], scale: [2.9, 0.38, 0.62] })),
    [benches],
  );
  const seat = useMemo<InstanceTransform[]>(
    () => benches.map((b) => ({ position: [b.x, 0.38, b.z], rotation: [0, b.rotY, 0], scale: [3.2, 0.07, 0.86] })),
    [benches],
  );
  const shadows = useMemo(
    () => benches.map((b) => ({ x: b.x, z: b.z, sx: 4, sz: 1.6, rotY: b.rotY })),
    [benches],
  );
  return (
    <group>
      <Instanced geometry={geo.boxBase()} material={m.whiteSatin} transforms={base} receiveShadow />
      <Instanced geometry={geo.boxBase()} material={m.oak} transforms={seat} castShadow />
      <BlobShadows items={shadows} />
    </group>
  );
}

/** Directory totems whose screens show the real mall plan. */
export function DirectoryKiosks({ kiosks }: { kiosks: readonly Placement[] }) {
  const m = getLibrary();
  const screenMat = useDisposable(() => {
    const tex = toTexture(paintDirectoryScreen(), { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  });
  const bodies = useMemo<InstanceTransform[]>(
    () => kiosks.map((k) => ({ position: [k.x, 0, k.z], rotation: [0, k.rotY, 0], scale: [0.78, 2.15, 0.32] })),
    [kiosks],
  );
  const screens = useMemo<InstanceTransform[]>(
    () =>
      kiosks.map((k) => ({
        position: [k.x + Math.sin(k.rotY) * 0.165, 1.2, k.z + Math.cos(k.rotY) * 0.165],
        rotation: [0, k.rotY, 0],
        scale: [0.62, 1.08, 1],
      })),
    [kiosks],
  );
  const caps = useMemo<InstanceTransform[]>(
    () => kiosks.map((k) => ({ position: [k.x, 2.15, k.z], rotation: [0, k.rotY, 0], scale: [0.8, 0.03, 0.34] })),
    [kiosks],
  );
  const shadows = useMemo(() => kiosks.map((k) => ({ x: k.x, z: k.z, sx: 1.4, sz: 1, rotY: k.rotY })), [kiosks]);
  return (
    <group>
      <Instanced geometry={geo.boxBase()} material={m.bronze} transforms={bodies} castShadow />
      <Instanced geometry={geo.plane()} material={screenMat} transforms={screens} />
      <Instanced geometry={geo.boxBase()} material={m.lightWarm} transforms={caps} />
      <BlobShadows items={shadows} />
    </group>
  );
}

export interface CafeSetSpec extends Placement {
  chairs: number;
  umbrella?: boolean;
}

/** Bistro tables with rattan chairs and optional parasols (atrium café reference). */
export function CafeSets({ sets }: { sets: readonly CafeSetSpec[] }) {
  const m = getLibrary();
  const chair = useDisposable(() =>
    mergeBoxes([
      boxFromBounds(-0.22, 0.22, 0.44, 0.49, -0.22, 0.22),
      boxFromBounds(-0.22, 0.22, 0.49, 0.9, -0.24, -0.2),
      boxFromBounds(-0.21, -0.18, 0, 0.44, -0.21, -0.18),
      boxFromBounds(0.18, 0.21, 0, 0.44, -0.21, -0.18),
      boxFromBounds(-0.21, -0.18, 0, 0.44, 0.18, 0.21),
      boxFromBounds(0.18, 0.21, 0, 0.44, 0.18, 0.21),
    ]),
  );
  const canopy = useDisposable(() => new THREE.ConeGeometry(1.5, 0.45, 18, 1, true).translate(0, 2.45, 0));
  const { tops, stems, chairs, poles, umbrellas, shadows } = useMemo(() => {
    const tops: InstanceTransform[] = [];
    const stems: InstanceTransform[] = [];
    const chairs: InstanceTransform[] = [];
    const poles: InstanceTransform[] = [];
    const umbrellas: InstanceTransform[] = [];
    const shadows: { x: number; z: number; sx: number; sz: number }[] = [];
    for (const s of sets) {
      tops.push({ position: [s.x, 0.72, s.z], scale: [0.4, 0.03, 0.4] });
      stems.push({ position: [s.x, 0, s.z], scale: [0.05, 0.72, 0.05] });
      for (let i = 0; i < s.chairs; i++) {
        const a = s.rotY + (i / s.chairs) * Math.PI * 2;
        chairs.push({
          position: [s.x + Math.sin(a) * 0.72, 0, s.z + Math.cos(a) * 0.72],
          rotation: [0, a + Math.PI, 0],
        });
      }
      if (s.umbrella) {
        poles.push({ position: [s.x, 0, s.z], scale: [0.025, 2.5, 0.025] });
        umbrellas.push({ position: [s.x, 0, s.z] });
      }
      shadows.push({ x: s.x, z: s.z, sx: 2.4, sz: 2.4 });
    }
    return { tops, stems, chairs, poles, umbrellas, shadows };
  }, [sets]);
  return (
    <group>
      <Instanced geometry={geo.cyl(28)} material={m.whiteSatin} transforms={tops} castShadow />
      <Instanced geometry={geo.cyl(10)} material={m.blackMetal} transforms={stems} />
      <Instanced geometry={chair} material={m.oakDark} transforms={chairs} castShadow />
      <Instanced geometry={geo.cyl(8)} material={m.oak} transforms={poles} />
      <Instanced geometry={canopy} material={m.fabricCream} transforms={umbrellas} castShadow />
      <BlobShadows items={shadows} />
    </group>
  );
}

/** Low modular lounge sofa (used in the east lounge and atrium seating). */
export function LoungeSofa({ x, z, rotY, length = 3, material }: Placement & { length?: number; material?: THREE.Material }) {
  const m = getLibrary();
  const fabric = material ?? m.fabricCream;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh geometry={geo.boxBase()} material={m.oakDark} position={[0, 0, 0]} scale={[length, 0.12, 0.95]} />
      <mesh geometry={geo.boxBase()} material={fabric} position={[0, 0.12, 0.05]} scale={[length - 0.1, 0.26, 0.85]} castShadow />
      <mesh geometry={geo.boxBase()} material={fabric} position={[0, 0.12, -0.36]} scale={[length - 0.1, 0.62, 0.22]} castShadow />
      <mesh geometry={geo.boxBase()} material={fabric} position={[-length / 2 + 0.11, 0.12, 0]} scale={[0.22, 0.42, 0.95]} />
      <mesh geometry={geo.boxBase()} material={fabric} position={[length / 2 - 0.11, 0.12, 0]} scale={[0.22, 0.42, 0.95]} />
      <mesh geometry={geo.flat()} material={m.blobShadow} position={[0, 0.006, 0]} scale={[length + 1, 1, 1.9]} renderOrder={1} />
    </group>
  );
}

export function LampPosts({ posts, height = 5.5 }: { posts: readonly { x: number; z: number }[]; height?: number }) {
  const m = getLibrary();
  const poles = useMemo<InstanceTransform[]>(
    () => posts.map((p) => ({ position: [p.x, 0, p.z], scale: [0.07, height, 0.07] })),
    [posts, height],
  );
  const heads = useMemo<InstanceTransform[]>(
    () => posts.map((p) => ({ position: [p.x, height, p.z], scale: [0.22, 0.42, 0.22] })),
    [posts, height],
  );
  const caps = useMemo<InstanceTransform[]>(
    () => posts.map((p) => ({ position: [p.x, height + 0.42, p.z], scale: [0.3, 0.06, 0.3] })),
    [posts, height],
  );
  return (
    <group>
      <Instanced geometry={geo.cyl(10)} material={m.blackMetal} transforms={poles} castShadow />
      <Instanced geometry={geo.boxBase()} material={m.lightWarm} transforms={heads} />
      <Instanced geometry={geo.boxBase()} material={m.blackMetal} transforms={caps} />
    </group>
  );
}

export function Bollards({ bollards }: { bollards: readonly { x: number; z: number }[] }) {
  const m = getLibrary();
  const bodies = useMemo<InstanceTransform[]>(
    () => bollards.map((b) => ({ position: [b.x, 0, b.z], scale: [0.11, 0.9, 0.11] })),
    [bollards],
  );
  const lamps = useMemo<InstanceTransform[]>(
    () => bollards.map((b) => ({ position: [b.x, 0.62, b.z], scale: [0.115, 0.14, 0.115] })),
    [bollards],
  );
  return (
    <group>
      <Instanced geometry={geo.cyl(12)} material={m.steel} transforms={bodies} />
      <Instanced geometry={geo.cyl(12)} material={m.lightWarm} transforms={lamps} />
    </group>
  );
}
