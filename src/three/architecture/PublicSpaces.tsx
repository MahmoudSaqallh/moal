"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BENCHES, COURT_FIXTURES, DIRECTORY_KIOSKS, EAST_LOUNGE, PLANTER_TREES, DIMENSIONS } from "@/data/layout";
import { FLOOR_COUNT, floorY } from "@/data/floors";
import { ATRIUM_ROOF, ENTRANCE_CEILING, G } from "./constants";
import { boxFromBounds, type BoxSpec } from "./geometry";
import { Instanced, StaticBoxes, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { getLibrary } from "../materials/library";
import { Trees } from "../environments/Plants";
import { Benches, CafeSets, DirectoryKiosks, LightPools, LoungeSofa, type CafeSetSpec } from "../environments/Furniture";
import { TextSign } from "../environments/Signage";

const FZ = DIMENSIONS.entranceFacadeZ;
const DOOR_HALF = 3;

/** Interior face of the main entrance: full-height glazing with automatic sliding doors. */
export function EntranceFacade() {
  const m = getLibrary();
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const open = useRef(0);

  const { mullions, transoms, glass } = useMemo(() => {
    const mullions: BoxSpec[] = [];
    const transoms: BoxSpec[] = [];
    const glass: BoxSpec[] = [];
    for (let x = -12; x <= 12.001; x += 2) {
      if (Math.abs(x) < DOOR_HALF - 0.01) continue;
      mullions.push({ x, y: ENTRANCE_CEILING / 2, z: FZ, w: 0.09, h: ENTRANCE_CEILING, d: 0.22 });
    }
    for (const y of [3.4, 7.8]) transoms.push({ x: 0, y, z: FZ, w: 24, h: 0.12, d: 0.22 });
    glass.push(boxFromBounds(-12, -DOOR_HALF, 0, ENTRANCE_CEILING, FZ - 0.02, FZ + 0.02));
    glass.push(boxFromBounds(DOOR_HALF, 12, 0, ENTRANCE_CEILING, FZ - 0.02, FZ + 0.02));
    glass.push(boxFromBounds(-DOOR_HALF, DOOR_HALF, 3.4, ENTRANCE_CEILING, FZ - 0.02, FZ + 0.02));
    return { mullions, transoms, glass };
  }, []);

  // Doors open when the camera approaches, closing again once it has passed.
  useFrame((state, dt) => {
    const cam = state.camera.position;
    const near = Math.abs(cam.x) < 6 && Math.abs(cam.z - FZ) < 7 && cam.y < 6;
    open.current = THREE.MathUtils.damp(open.current, near ? 1 : 0, 4, dt);
    const shift = open.current * (DOOR_HALF - 0.1);
    if (left.current) left.current.position.x = -DOOR_HALF / 2 - shift;
    if (right.current) right.current.position.x = DOOR_HALF / 2 + shift;
  });

  return (
    <group>
      <StaticBoxes boxes={glass} material={m.glass} receiveShadow={false} />
      <StaticBoxes boxes={mullions} material={m.whiteSatin} />
      <StaticBoxes boxes={transoms} material={m.whiteSatin} />
      <mesh ref={left} geometry={geo.box()} material={m.glassRail} position={[-DOOR_HALF / 2, 1.7, FZ - 0.12]} scale={[DOOR_HALF, 3.4, 0.03]} />
      <mesh ref={right} geometry={geo.box()} material={m.glassRail} position={[DOOR_HALF / 2, 1.7, FZ - 0.12]} scale={[DOOR_HALF, 3.4, 0.03]} />
      <mesh geometry={geo.box()} material={m.steel} position={[0, 3.45, FZ - 0.15]} scale={[DOOR_HALF * 4, 0.18, 0.2]} />
      <mesh geometry={geo.flat()} material={m.fabricCharcoal} position={[0, 0.008, FZ - 2.2]} scale={[6, 1, 3.6]} />
      <TextSign text="MallVerse" font="display" italic color="#8a6a3f" height={1.3} position={[0, 9.6, FZ - 0.25]} rotY={Math.PI} glow={1.2} />
    </group>
  );
}

function courtSets(floor: number): CafeSetSpec[] {
  const sets: CafeSetSpec[] = [];
  (COURT_FIXTURES[floor] ?? []).forEach((r, ri) => {
    for (let z = r.minZ + 1.6; z <= r.maxZ - 1.3; z += 3.2) {
      sets.push({ x: (r.minX + r.maxX) / 2 + (ri ? 0.6 : -0.6), z, rotY: z * 0.7, chairs: 4, umbrella: floor === 2 && Math.round(z) % 2 === 0 });
    }
  });
  return sets;
}

/** Full-height frosted daylight wall closing the east wing, with the ground-floor lounge. */
function EastLounge() {
  const m = getLibrary();
  const cx = (EAST_LOUNGE.minX + EAST_LOUNGE.maxX) / 2;
  const h = ATRIUM_ROOF - 0.2;
  const mullions = useMemo(() => {
    const out: BoxSpec[] = [];
    for (let z = -6; z <= 6.001; z += 1.5) out.push({ x: 59.9, y: h / 2, z, w: 0.12, h, d: 0.1 });
    for (let f = 1; f < FLOOR_COUNT; f++) out.push({ x: 59.9, y: floorY(f) - 0.25, z: 0, w: 0.14, h: 0.5, d: 12.8 });
    return out;
  }, [h]);
  return (
    <group>
      <mesh geometry={geo.plane()} material={m.frostedLight} position={[60.05, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[12.8, h, 1]} />
      <StaticBoxes boxes={mullions} material={m.whiteSatin} />
      <mesh geometry={geo.boxBase()} material={m.fabricCharcoal} position={[cx, 0, 0]} scale={[5.2, 0.015, 6.2]} receiveShadow />
      <LoungeSofa x={cx} z={-2.5} rotY={0} length={3.4} />
      <LoungeSofa x={cx} z={2.5} rotY={Math.PI} length={3.4} material={m.fabricSage} />
      <mesh geometry={geo.cyl(40)} material={m.oak} position={[cx, 0, 0]} scale={[0.75, 0.38, 0.75]} castShadow />
      <mesh geometry={geo.sphere(24)} material={m.lightWarm} position={[cx, 4.6, 0]} scale={0.45} />
      <TextSign text="The Lounge" font="display" italic color="#6a5038" height={0.6} position={[59.8, 4.2, 0]} rotY={-Math.PI / 2} glow={0.9} />
    </group>
  );
}

/** Round light wells over each court, on every level. */
function CourtCeilings() {
  const m = getLibrary();
  const wells = useMemo(() => Array.from({ length: FLOOR_COUNT }, (_, f) => [-31, -23].map((z) => ({ x: 0, z, y: floorY(f) }))).flat(), []);
  const rings = useMemo<InstanceTransform[]>(() => wells.map((w) => ({ position: [w.x, w.y + G - 0.25, w.z], scale: 2.4 })), [wells]);
  const disks = useMemo<InstanceTransform[]>(
    () => wells.map((w) => ({ position: [w.x, w.y + G - 0.02, w.z], rotation: [Math.PI, 0, 0], scale: 2.3 })),
    [wells],
  );
  const pools = useMemo(() => wells.map((w) => ({ x: w.x, z: w.z, y: w.y, r: 4.2 })), [wells]);
  return (
    <group>
      <Instanced geometry={geo.torus(0.05, 96)} material={m.brass} transforms={rings} />
      <Instanced geometry={geo.disk(48)} material={m.lightNeutral} transforms={disks} />
      <LightPools pools={pools} />
    </group>
  );
}

/** Level 2 Showroom Court: lit plinths with screens showing the latest devices. */
function ShowroomCourt() {
  const m = getLibrary();
  const y = floorY(1);
  return (
    <group>
      {COURT_FIXTURES[1].map((r, i) => {
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        const face = i ? -Math.PI / 2 : Math.PI / 2;
        return (
          <group key={i} position={[cx, y, cz]}>
            <mesh geometry={geo.boxBase()} material={m.whiteSatin} scale={[r.maxX - r.minX - 0.4, 0.5, r.maxZ - r.minZ - 0.4]} castShadow receiveShadow />
            <mesh geometry={geo.box()} material={m.lightCool} position={[0, 0.03, 0]} scale={[r.maxX - r.minX - 0.3, 0.02, r.maxZ - r.minZ - 0.3]} />
            {[-2.6, 0, 2.6].map((dz) => (
              <group key={dz} position={[0, 0.5, dz]} rotation={[0, face, 0]}>
                <mesh geometry={geo.cyl(32)} material={m.steel} scale={[0.35, 0.6, 0.35]} />
                <mesh geometry={geo.box()} material={m.screenDark} position={[0, 1.15, 0]} scale={[0.9, 0.55, 0.04]} />
                <mesh geometry={geo.plane()} material={m.lightCool} position={[0, 1.15, 0.025]} scale={[0.8, 0.45, 1]} />
              </group>
            ))}
          </group>
        );
      })}
      <TextSign text="Showroom Court" font="sans" uppercase tracking={0.3} color="#2a2d33" height={0.42} position={[0, y + 4.2, -37.55]} />
    </group>
  );
}

/** Level 3 Food Court: counters along the court walls. */
function FoodStalls() {
  const m = getLibrary();
  const y = floorY(2);
  const stalls = [
    { x: -9.45, label: "Grill" },
    { x: 9.45, label: "Bakery" },
  ];
  return (
    <group>
      {stalls.map((s) => {
        const side = s.x < 0 ? 1 : -1;
        return (
          <group key={s.label} position={[s.x, y, -27]}>
            <mesh geometry={geo.boxBase()} material={m.oakDark} scale={[0.9, 1.05, 6]} castShadow />
            <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[0, 1.05, 0]} scale={[1.0, 0.05, 6.1]} />
            <mesh geometry={geo.box()} material={m.lightWarm} position={[side * 0.46, 0.08, 0]} scale={[0.02, 0.02, 5.8]} />
            <TextSign text={s.label} font="display" italic color="#6b4a32" height={0.5} position={[side * 0.5, 2.6, 0]} rotY={(side * Math.PI) / 2} />
          </group>
        );
      })}
      <TextSign text="Food Court" font="display" italic color="#5a3a28" height={0.7} position={[0, y + 4.6, -37.55]} />
    </group>
  );
}

export function PublicSpaces() {
  const lib = getLibrary();
  const trees = useMemo(
    () =>
      PLANTER_TREES.filter((t) => !(t.floor === 0 && Math.abs(t.x) <= 16 && Math.abs(t.z) <= 16)).map((t) => ({
        x: t.x,
        z: t.z,
        y: floorY(t.floor),
        planter: t.r,
        height: t.height,
      })),
    [],
  );
  const perFloor = useMemo(
    () =>
      Array.from({ length: FLOOR_COUNT }, (_, f) => ({
        f,
        benches: BENCHES.filter((b) => b.floor === f).map((b) => ({ x: b.x, z: b.z, rotY: b.rotY })),
        kiosks: DIRECTORY_KIOSKS.filter((k) => k.floor === f).map((k) => ({ x: k.x, z: k.z, rotY: k.rotY })),
        sets: f === 1 ? [] : courtSets(f),
      })),
    [],
  );
  const entranceSlots = useMemo(() => {
    const boxes: BoxSpec[] = [];
    for (const x of [-6, 0, 6]) boxes.push({ x, y: ENTRANCE_CEILING - 0.31, z: 25, w: 0.12, h: 0.02, d: 15 });
    return boxes;
  }, []);
  return (
    <group>
      <EntranceFacade />
      <StaticBoxes boxes={entranceSlots} material={lib.lightWarm} receiveShadow={false} />
      <LightPools pools={[{ x: 0, z: 25, r: 7 }]} />
      <Trees trees={trees} />
      {perFloor.map((p) => (
        <group key={p.f} position={[0, floorY(p.f), 0]}>
          <Benches benches={p.benches} />
          <DirectoryKiosks kiosks={p.kiosks} />
          <CafeSets sets={p.sets} />
        </group>
      ))}
      <CourtCeilings />
      <ShowroomCourt />
      <FoodStalls />
      <EastLounge />
    </group>
  );
}
