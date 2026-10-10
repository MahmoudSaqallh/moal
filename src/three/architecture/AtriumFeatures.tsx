"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ATRIUM_COLUMNS, INFO_DESK, PLANTER_TREES } from "@/data/layout";
import { FLOOR_COUNT, floorY } from "@/data/floors";
import { ATRIUM_ROOF, G } from "./constants";
import type { BoxSpec } from "./geometry";
import { Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { getLibrary } from "../materials/library";
import { Trees } from "../environments/Plants";
import { BlobShadows, CafeSets, LightPools, type CafeSetSpec } from "../environments/Furniture";
import { TextSign, WayfindingSign } from "../environments/Signage";


function Columns() {
  const m = getLibrary();
  const shafts = useMemo<InstanceTransform[]>(
    () => ATRIUM_COLUMNS.map((c) => ({ position: [c.x, 0, c.z], scale: [0.55, ATRIUM_ROOF, 0.55] })),
    [],
  );
  const rings = useMemo<InstanceTransform[]>(
    () =>
      ATRIUM_COLUMNS.flatMap((c) =>
        Array.from({ length: FLOOR_COUNT }, (_, f) => [
          { position: [c.x, floorY(f), c.z] as const, scale: [0.62, 0.12, 0.62] as const },
          { position: [c.x, floorY(f) + G - 0.1, c.z] as const, scale: [0.6, 0.06, 0.6] as const },
        ]).flat(),
      ),
    [],
  );
  const shadows = useMemo(() => ATRIUM_COLUMNS.map((c) => ({ x: c.x, z: c.z, sx: 2.4, sz: 2.4 })), []);
  return (
    <group>
      <Instanced geometry={geo.cyl(32)} material={getLibrary().whiteSatin} transforms={shafts} castShadow receiveShadow />
      <Instanced geometry={geo.cyl(32)} material={m.brass} transforms={rings} />
      <BlobShadows items={shadows} />
    </group>
  );
}

function deskArc(outer: number, inner: number, depth: number) {
  const shape = new THREE.Shape();
  const a0 = -Math.PI * 0.62;
  const a1 = Math.PI * 0.62;
  shape.absarc(0, 0, outer, a0, a1, false);
  shape.absarc(0, 0, inner, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Curved oak information desk with a stone top. */
function InfoDesk() {
  const m = getLibrary();
  const body = useDisposable(() => deskArc(INFO_DESK.r - 0.05, INFO_DESK.r - 0.75, 1.02));
  const top = useDisposable(() => deskArc(INFO_DESK.r + 0.05, INFO_DESK.r - 0.82, 0.06));
  // Open side faces the wall; the curved front faces the fountain and entrance.
  const rotY = Math.PI;
  return (
    <group position={[INFO_DESK.x, 0, INFO_DESK.z]} rotation={[0, rotY, 0]}>
      <mesh geometry={body} material={m.oak} castShadow receiveShadow />
      <mesh geometry={top} material={m.whiteSatin} position={[0, 1.02, 0]} castShadow />
      <mesh geometry={geo.flat()} material={m.blobShadow} position={[0, 0.006, 0]} scale={[5, 1, 5]} renderOrder={1} />
      <group position={[0, 1.08, 0]}>
        <mesh geometry={geo.box()} material={m.screenDark} position={[0.4, 0.2, 0.7]} rotation={[0, -Math.PI / 2 + 0.4, 0]} scale={[0.5, 0.32, 0.03]} />
      </group>
      <TextSign
        text="Information"
        font="display"
        color="#3a2b1d"
        italic
        height={0.32}
        position={[INFO_DESK.r - 0.03, 0.6, 0]}
        rotY={Math.PI / 2}
      />
    </group>
  );
}

const CAFE_SETS: CafeSetSpec[] = [
  { x: -13.2, z: 5.9, rotY: 0.3, chairs: 3, umbrella: true },
  { x: -8.7, z: 6.4, rotY: 0, chairs: 2 },
  { x: -8.5, z: 10.4, rotY: 0.6, chairs: 3, umbrella: true },
  { x: -13.6, z: 8.9, rotY: 1.2, chairs: 2 },
  { x: -13.4, z: 12.9, rotY: 0.2, chairs: 3, umbrella: true },
  { x: -9.2, z: 13.3, rotY: 0.9, chairs: 2 },
];

/** Vertical oak slats with a warm backlit reveal, dressing the blank atrium walls. */
function FeatureWalls() {
  const m = getLibrary();
  const { slats, glow } = useMemo(() => {
    const slats: BoxSpec[] = [];
    const glow: BoxSpec[] = [];
    const panels: { alongX: boolean; at: number; from: number; to: number; inward: number }[] = [
      { alongX: false, at: 16, from: 7, to: 15, inward: -1 },
      { alongX: false, at: -16, from: -15, to: -7, inward: 1 },
      { alongX: false, at: 16, from: -15.5, to: -6.5, inward: -1 },
      { alongX: false, at: -16, from: 7, to: 15, inward: 1 },
    ];
    for (const p of panels) {
      for (let v = p.from; v <= p.to; v += 0.22) {
        const c = p.at + p.inward * 0.12;
        slats.push(p.alongX ? { x: v, y: 2.9, z: c, w: 0.08, h: 5.4, d: 0.12 } : { x: c, y: 2.9, z: v, w: 0.12, h: 5.4, d: 0.08 });
      }
      const g = p.at + p.inward * 0.02;
      const mid = (p.from + p.to) / 2;
      const len = p.to - p.from;
      glow.push(p.alongX ? { x: mid, y: 0.25, z: g, w: len, h: 0.08, d: 0.02 } : { x: g, y: 0.25, z: mid, w: 0.02, h: 0.08, d: len });
      glow.push(p.alongX ? { x: mid, y: 5.65, z: g, w: len, h: 0.08, d: 0.02 } : { x: g, y: 5.65, z: mid, w: 0.02, h: 0.08, d: len });
    }
    return { slats, glow };
  }, []);
  return (
    <group>
      <StaticBoxes boxes={slats} material={m.oak} />
      <StaticBoxes boxes={glow} material={m.lightWarm} receiveShadow={false} />
    </group>
  );
}

export function AtriumFeatures() {
  const atriumTrees = useMemo(
    () =>
      PLANTER_TREES.filter((t) => t.floor === 0 && Math.abs(t.x) <= 16 && Math.abs(t.z) <= 16).map((t) => ({
        x: t.x,
        z: t.z,
        height: t.height,
        planter: t.r,
      })),
    [],
  );
  const pools = useMemo(
    () => [
      { x: INFO_DESK.x, z: INFO_DESK.z, r: 3.4 },
      { x: -11, z: 9.5, r: 4.5 },
    ],
    [],
  );
  return (
    <group>
      <Columns />
      <InfoDesk />
      <FeatureWalls />
      <CafeSets sets={CAFE_SETS} />
      <Trees trees={atriumTrees} />
      <LightPools pools={pools} />
      <WayfindingSign
        position={[13.6, 5.4, 0]}
        rotY={-Math.PI / 2}
        dropTo={G}
        front={[
          { text: "Fashion Avenue", arrow: "up" },
          { text: "Maison Élan · Aurelia · Lounge", arrow: "none" },
        ]}
        back={[
          { text: "Central Atrium", arrow: "up" },
          { text: "Café Court · Main Exit", arrow: "none" },
        ]}
      />
      <WayfindingSign
        position={[-13.6, 5.4, 0]}
        rotY={Math.PI / 2}
        dropTo={G}
        front={[
          { text: "Tech & Lifestyle", arrow: "up" },
          { text: "Lumen · Stride · Casa Linea", arrow: "none" },
        ]}
        back={[
          { text: "Central Atrium", arrow: "up" },
          { text: "Café Court · Main Exit", arrow: "none" },
        ]}
      />
      <WayfindingSign
        position={[0, 5.4, -13.6]}
        rotY={0}
        dropTo={G}
        front={[
          { text: "Café Court", arrow: "up" },
          { text: "Atrium Roasters", arrow: "none" },
        ]}
        back={[
          { text: "Central Atrium", arrow: "up" },
          { text: "All stores · Main Exit", arrow: "none" },
        ]}
      />
      <WayfindingSign
        position={[0, 5.4, 13.6]}
        rotY={Math.PI}
        dropTo={G}
        front={[
          { text: "Main Exit", arrow: "up" },
          { text: "Plaza · Taxis", arrow: "none" },
        ]}
        back={[
          { text: "Central Atrium", arrow: "up" },
          { text: "Fashion · East   Tech · West", arrow: "none" },
        ]}
      />
    </group>
  );
}
