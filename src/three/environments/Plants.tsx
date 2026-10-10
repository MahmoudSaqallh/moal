"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Instanced, useDisposable, type InstanceTransform } from "../architecture/primitives";
import { getLibrary } from "../materials/library";
import { seeded } from "../materials/textures";
import { leafClusterGeometry, lumpGeometry, palmCrownGeometry, palmTrunkGeometry } from "./plantGeometry";

export interface TreeSpec {
  x: number;
  z: number;
  /** Overall height in metres (trunk + canopy). */
  height: number;
  /** Planter radius; omit for trees planted directly in soil beds. */
  planter?: number;
  y?: number;
  seed?: number;
}

/**
 * Broadleaf trees (indoor ficus / plaza trees). Every tree in the set shares five
 * instanced draw calls: planter, soil, trunk, inner canopy volume and leaf cards.
 */
export function Trees({ trees, density = 1 }: { trees: readonly TreeSpec[]; density?: number }) {
  const m = getLibrary();
  const cluster = useDisposable(() => leafClusterGeometry());
  const lump = useDisposable(() => lumpGeometry(3, 1));
  const trunk = useDisposable(() => new THREE.CylinderGeometry(0.6, 1, 1, 7).translate(0, 0.5, 0));
  const pot = useDisposable(() => new THREE.CylinderGeometry(1, 0.92, 1, 28).translate(0, 0.5, 0));
  const disk = useDisposable(() => new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2));

  const sets = useMemo(() => {
    const pots: InstanceTransform[] = [];
    const soils: InstanceTransform[] = [];
    const trunks: InstanceTransform[] = [];
    const lumps: InstanceTransform[] = [];
    const leaves: InstanceTransform[] = [];
    for (const t of trees) {
      const rand = seeded(t.seed ?? Math.round(t.x * 31 + t.z * 17));
      const base = t.y ?? 0;
      const potH = t.planter ? 0.85 : 0;
      if (t.planter) {
        pots.push({ position: [t.x, base, t.z], scale: [t.planter, potH, t.planter] });
        soils.push({ position: [t.x, base + potH - 0.06, t.z], scale: t.planter * 0.93 });
      }
      const trunkH = t.height * 0.55;
      const trunkR = 0.06 + t.height * 0.018;
      trunks.push({ position: [t.x, base + potH, t.z], scale: [trunkR, trunkH, trunkR] });
      const crownY = base + potH + trunkH;
      const crownR = t.height * 0.26;
      lumps.push({ position: [t.x, crownY + crownR * 0.55, t.z], scale: [crownR * 0.8, crownR * 0.65, crownR * 0.8] });
      const count = Math.round((10 + t.height * 2) * density);
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const r = crownR * (0.25 + rand() * 0.75);
        const y = crownY + crownR * (0.1 + rand() * 1.1);
        const s = crownR * (0.75 + rand() * 0.5);
        leaves.push({
          position: [t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r],
          rotation: [0, rand() * Math.PI, 0],
          scale: s,
        });
      }
    }
    return { pots, soils, trunks, lumps, leaves };
  }, [trees, density]);

  return (
    <group>
      <Instanced geometry={pot} material={m.whiteSatin} transforms={sets.pots} receiveShadow castShadow />
      <Instanced geometry={disk} material={m.soil} transforms={sets.soils} />
      <Instanced geometry={trunk} material={m.trunk} transforms={sets.trunks} castShadow />
      <Instanced geometry={lump} material={m.hedge} transforms={sets.lumps} castShadow />
      <Instanced geometry={cluster} material={m.foliage} transforms={sets.leaves} castShadow />
    </group>
  );
}

export interface PalmSpec {
  x: number;
  z: number;
  height: number;
  rotY?: number;
}

const PALM_GIRTH = 1.7;

export function Palms({ palms }: { palms: readonly PalmSpec[] }) {
  const m = getLibrary();
  const trunk = useDisposable(() => palmTrunkGeometry());
  const crown = useDisposable(() => palmCrownGeometry());
  const { trunks, crowns } = useMemo(() => {
    const trunks: InstanceTransform[] = [];
    const crowns: InstanceTransform[] = [];
    palms.forEach((p, i) => {
      const rot = p.rotY ?? i * 1.7;
      // Height scales the trunk vertically; girth and lean stay at a natural palm scale.
      trunks.push({ position: [p.x, 0, p.z], rotation: [0, rot, 0], scale: [PALM_GIRTH, p.height, PALM_GIRTH] });
      // Crown sits at the top of the curved trunk (local top is at x=0.32, y=1).
      const topX = p.x + Math.cos(-rot) * 0.32 * PALM_GIRTH;
      const topZ = p.z + Math.sin(-rot) * 0.32 * PALM_GIRTH;
      crowns.push({ position: [topX, p.height, topZ], rotation: [0, rot * 2.3, 0], scale: 1.1 + p.height * 0.08 });
    });
    return { trunks, crowns };
  }, [palms]);
  return (
    <group>
      <Instanced geometry={trunk} material={m.palmTrunk} transforms={trunks} castShadow />
      <Instanced geometry={crown} material={m.frond} transforms={crowns} castShadow />
    </group>
  );
}

export interface ShrubSpec {
  x: number;
  y: number;
  z: number;
  /** Radius. */
  r: number;
  /** Vertical squash. */
  h?: number;
}

/** Clipped hedges and planting beds. */
export function Shrubs({ shrubs, withLeaves = true }: { shrubs: readonly ShrubSpec[]; withLeaves?: boolean }) {
  const m = getLibrary();
  const lump = useDisposable(() => lumpGeometry(9, 1));
  const cluster = useDisposable(() => leafClusterGeometry());
  const { lumps, leaves } = useMemo(() => {
    const lumps: InstanceTransform[] = [];
    const leaves: InstanceTransform[] = [];
    shrubs.forEach((s, i) => {
      const rand = seeded(i * 13 + 7);
      lumps.push({ position: [s.x, s.y, s.z], rotation: [0, rand() * 6, 0], scale: [s.r, s.r * (s.h ?? 0.8), s.r] });
      if (withLeaves) {
        leaves.push({
          position: [s.x, s.y + s.r * 0.3, s.z],
          rotation: [0, rand() * 6, 0],
          scale: s.r * 1.6,
        });
      }
    });
    return { lumps, leaves };
  }, [shrubs, withLeaves]);
  return (
    <group>
      <Instanced geometry={lump} material={m.hedge} transforms={lumps} receiveShadow />
      <Instanced geometry={cluster} material={m.foliage} transforms={leaves} />
    </group>
  );
}
