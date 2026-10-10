"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ELEVATOR, ESCALATORS, type EscalatorDef } from "@/data/layout";
import { FLOOR_COUNT, floorY } from "@/data/floors";
import { lift, stepLift } from "@/lib/elevator";
import { player } from "@/lib/runtime";
import { prefersReducedMotion } from "@/lib/motion";
import { ESCALATOR_SPEED } from "@/lib/transit";
import { ATRIUM_ROOF } from "./constants";
import { Instanced, useDisposable, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { getLibrary } from "../materials/library";
import { paintText } from "../materials/signage";
import { toTexture } from "../materials/textures";

const STEP = 0.4;

/** One escalator pair: oak-clad truss, glass balustrades and steps moving in each lane's direction. */
function Escalator({ e }: { e: EscalatorDef }) {
  const m = getLibrary();
  const up = useRef<THREE.Group>(null);
  const down = useRef<THREE.Group>(null);
  const y0 = floorY(e.fromFloor);
  const y1 = floorY(e.toFloor);
  const run = e.topX - e.bottomX;
  const rise = y1 - y0;
  const angle = Math.atan2(rise, run);
  const len = Math.hypot(run, rise);
  const midX = (e.bottomX + e.topX) / 2;
  const midY = (y0 + y1) / 2;
  // Travel direction along the incline (rising toward +X).
  const dir = useMemo(() => new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), [angle]);

  const { truss, glass, rails, landings } = useMemo(() => {
    const rot: [number, number, number] = [0, 0, angle];
    const truss: InstanceTransform[] = [{ position: [midX, midY - 0.55, 0], rotation: rot, scale: [len + 1.2, 0.95, e.halfWidth * 2] }];
    const glass: InstanceTransform[] = [];
    const rails: InstanceTransform[] = [];
    for (const z of [e.upZ - 0.62, 0, e.downZ + 0.62]) {
      glass.push({ position: [midX, midY + 0.55, z], rotation: rot, scale: [len, 0.95, 0.025] });
      rails.push({ position: [midX, midY + 1.04, z], rotation: rot, scale: [len + 0.6, 0.07, 0.08] });
    }
    const landings: InstanceTransform[] = [];
    for (const z of [e.upZ, e.downZ]) {
      landings.push({ position: [e.bottomX - 0.5, y0 + 0.02, z], scale: [1.0, 0.04, 1.24] });
      landings.push({ position: [e.topX + 0.5, y1 + 0.02, z], scale: [1.0, 0.04, 1.24] });
    }
    return { truss, glass, rails, landings };
  }, [angle, len, midX, midY, e, y0, y1]);

  const steps = useMemo(() => {
    const make = (z: number): InstanceTransform[] => {
      const n = Math.floor(len / STEP);
      return Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        return { position: [e.bottomX + t * run, y0 + t * rise + 0.08, z], scale: [STEP * Math.cos(angle) * 0.92, 0.16, 1.0] };
      });
    };
    return { up: make(e.upZ), down: make(e.downZ) };
  }, [len, run, rise, angle, e, y0]);

  // Step trains slide along the incline and wrap every step length: up lane rises, down lane falls.
  useFrame((state) => {
    if (prefersReducedMotion()) return;
    const s = (state.clock.elapsedTime * ESCALATOR_SPEED * 0.4) % STEP;
    up.current?.position.copy(dir).multiplyScalar(s);
    down.current?.position.copy(dir).multiplyScalar(-s);
  });

  return (
    <group>
      <Instanced geometry={geo.box()} material={m.oak} transforms={truss} castShadow receiveShadow />
      <Instanced geometry={geo.box()} material={m.glassRail} transforms={glass} />
      <Instanced geometry={geo.box()} material={m.blackMetal} transforms={rails} />
      <Instanced geometry={geo.box()} material={m.steel} transforms={landings} />
      <group ref={up}>
        <Instanced geometry={geo.box()} material={m.steel} transforms={steps.up} />
      </group>
      <group ref={down}>
        <Instanced geometry={geo.box()} material={m.steel} transforms={steps.down} />
      </group>
      {/* Direction lights at each comb plate: green arrow lane in, red lane out */}
      <mesh geometry={geo.box()} material={m.lightBlue} position={[e.bottomX - 0.95, y0 + 1.02, e.upZ]} scale={[0.06, 0.06, 0.5]} />
      <mesh geometry={geo.box()} material={m.lightBlue} position={[e.topX + 0.95, y1 + 1.02, e.downZ]} scale={[0.06, 0.06, 0.5]} />
    </group>
  );
}

export function Escalators() {
  return (
    <group>
      {ESCALATORS.map((e) => (
        <Escalator key={e.id} e={e} />
      ))}
    </group>
  );
}

// ─── Panoramic lift ─────────────────────────────────────────────────────

function useDigitMaterials() {
  return useDisposable(() => {
    const mats = Array.from({ length: FLOOR_COUNT }, (_, i) => {
      const painted = paintText(`L${i + 1}`, { font: "sans", color: "#f3d9a8", weight: 500, height: 128 });
      const tex = toTexture(painted.canvas, { repeat: false });
      return new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.4, 1.4, 1.4) });
    });
    return {
      mats,
      dispose: () => mats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      }),
    };
  });
}

const DOOR_W = 0.62;

/**
 * The lift: a glass shaft through all levels, a cabin that rides the shared lift state,
 * sliding cabin and landing doors, floor indicators and call buttons.
 */
export function GlassLift() {
  const m = getLibrary();
  const cabin = useRef<THREE.Group>(null);
  const cabinDoors = useRef<(THREE.Mesh | null)[]>([]);
  const landingDoors = useRef<(THREE.Mesh | null)[]>([]);
  const indicators = useRef<(THREE.Mesh | null)[]>([]);
  const callLights = useRef<(THREE.Mesh | null)[]>([]);
  const digits = useDigitMaterials();
  const callOn = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc46b").multiplyScalar(2) }), []);
  const callOff = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3b3631", roughness: 0.4 }), []);

  const shaft = useDisposable(() =>
    // Open on the west side where the doors are.
    new THREE.CylinderGeometry(ELEVATOR.r, ELEVATOR.r, ATRIUM_ROOF, 40, 1, true, Math.PI * 0.2, Math.PI * 1.6).translate(0, ATRIUM_ROOF / 2, 0),
  );
  const cabinGlass = useDisposable(() =>
    new THREE.CylinderGeometry(1.15, 1.15, 2.5, 32, 1, true, Math.PI * 0.22, Math.PI * 1.56).translate(0, 1.25, 0),
  );
  const rings = useMemo<InstanceTransform[]>(
    () =>
      [0.02, ...Array.from({ length: FLOOR_COUNT }, (_, f) => floorY(f) - 0.3).slice(1), ATRIUM_ROOF - 0.1].map((y) => ({
        position: [ELEVATOR.x, y, ELEVATOR.z],
        scale: [ELEVATOR.r + 0.05, 0.12, ELEVATOR.r + 0.05],
      })),
    [],
  );
  const posts = useMemo<InstanceTransform[]>(
    () =>
      [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return { position: [ELEVATOR.x + Math.cos(a) * ELEVATOR.r, 0, ELEVATOR.z + Math.sin(a) * ELEVATOR.r], scale: [0.06, ATRIUM_ROOF, 0.06] };
      }),
    [],
  );
  const doorX = ELEVATOR.cabin.minX - 0.42;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    // Something in the doorway keeps the doors from closing on it.
    const d = ELEVATOR.doorway;
    lift.blocked =
      Math.abs(player.y - lift.y) < 0.5 && player.x >= d.minX && player.x <= d.maxX && player.z >= d.minZ && player.z <= d.maxZ;
    stepLift(lift, dt);

    if (cabin.current) cabin.current.position.y = lift.y;
    const open = lift.doors * DOOR_W;
    cabinDoors.current.forEach((door, i) => {
      if (door) door.position.z = (i === 0 ? -1 : 1) * (DOOR_W / 2 + open);
    });
    landingDoors.current.forEach((door, i) => {
      if (!door) return;
      const f = Math.floor(i / 2);
      const here = Math.abs(lift.y - floorY(f)) < 0.01;
      door.position.z = ELEVATOR.z + (i % 2 === 0 ? -1 : 1) * (DOOR_W / 2 + (here ? open : 0));
    });
    indicators.current.forEach((ind) => {
      if (ind && ind.material !== digits.mats[lift.floor]) ind.material = digits.mats[lift.floor];
    });
    callLights.current.forEach((light, f) => {
      if (!light) return;
      const lit = lift.queue.includes(f);
      if ((light.material === callOn) !== lit) light.material = lit ? callOn : callOff;
    });
  });

  return (
    <group>
      <mesh geometry={shaft} material={m.glass} position={[ELEVATOR.x, 0, ELEVATOR.z]} />
      <Instanced geometry={geo.cyl(40)} material={m.steel} transforms={rings} />
      <Instanced geometry={geo.cyl(8)} material={m.steel} transforms={posts} />

      {/* Cabin */}
      <group ref={cabin} position={[ELEVATOR.x, 0, ELEVATOR.z]}>
        <mesh geometry={geo.cyl(32)} material={m.floorDarkStone} position={[0, -0.12, 0]} scale={[1.2, 0.12, 1.2]} receiveShadow />
        <mesh geometry={cabinGlass} material={m.glassRail} />
        <mesh geometry={geo.cyl(32)} material={m.whiteSatin} position={[0, 2.5, 0]} scale={[1.22, 0.14, 1.22]} />
        <mesh geometry={geo.torus(0.03, 48)} material={m.brass} position={[0, 1.05, 0]} scale={1.1} />
        <mesh geometry={geo.disk(24)} material={m.lightWarm} position={[0, 2.49, 0]} rotation={[Math.PI, 0, 0]} scale={0.7} />
        {[0, 1].map((i) => (
          <mesh
            key={i}
            ref={(el) => {
              cabinDoors.current[i] = el;
            }}
            geometry={geo.box()}
            material={m.glassRail}
            position={[doorX - ELEVATOR.x + 0.1, 1.2, 0]}
            scale={[0.03, 2.35, DOOR_W]}
          />
        ))}
        {/* Floor panel inside the cabin */}
        <mesh geometry={geo.box()} material={m.blackMetal} position={[0.9, 1.25, -0.55]} rotation={[0, -0.6, 0]} scale={[0.04, 0.5, 0.2]} />
      </group>

      {/* Landing doors, indicators and call buttons on every level */}
      {Array.from({ length: FLOOR_COUNT }, (_, f) => (
        <group key={f}>
          {[0, 1].map((side) => (
            <mesh
              key={side}
              ref={(el) => {
                landingDoors.current[f * 2 + side] = el;
              }}
              geometry={geo.box()}
              material={m.glassRail}
              position={[doorX - 0.06, floorY(f) + 1.2, ELEVATOR.z]}
              scale={[0.03, 2.4, DOOR_W]}
            />
          ))}
          <mesh geometry={geo.box()} material={m.steel} position={[doorX - 0.08, floorY(f) + 2.55, ELEVATOR.z]} scale={[0.06, 0.18, 1.5]} />
          <mesh
            ref={(el) => {
              indicators.current[f] = el;
            }}
            geometry={geo.plane()}
            material={digits.mats[0]}
            position={[doorX - 0.12, floorY(f) + 2.82, ELEVATOR.z]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[0.5, 0.25, 1]}
          />
          <mesh geometry={geo.box()} material={m.blackMetal} position={[doorX - 0.08, floorY(f) + 1.15, ELEVATOR.z - 0.95]} scale={[0.05, 0.3, 0.14]} />
          <mesh
            ref={(el) => {
              callLights.current[f] = el;
            }}
            geometry={geo.cyl(16)}
            material={callOff}
            position={[doorX - 0.11, floorY(f) + 1.15, ELEVATOR.z - 0.95]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.035, 0.02, 0.035]}
          />
        </group>
      ))}
    </group>
  );
}
