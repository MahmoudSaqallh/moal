"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { StoreConfig } from "@/types";
import { LUMEN_CENTER, lumenTable } from "@/data/storeLayouts";
import { Instanced, useDisposable, type InstanceTransform } from "../../architecture/primitives";
import { geo } from "../../architecture/shared";
import { getLibrary } from "../../materials/library";
import { paintPoster, paintScreen } from "../../materials/signage";
import { toTexture } from "../../materials/textures";
import { LightPools } from "../../environments/Furniture";
import { StoreShell } from "../StoreInterior";

/**
 * LUMEN — the detailed reference interior (after the electronics flagship reference):
 * an all-white hall, concentric halo rings overhead, a central column wrapped in a lit
 * device wall, four radial demo tables with blue under-glow over a dark circular floor,
 * and perimeter counters beneath light-box posters and screens.
 */

const C = LUMEN_CENTER;

function useCanvasMaterial(make: () => HTMLCanvasElement, brightness: number) {
  return useDisposable(() => {
    const tex = toTexture(make(), { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(brightness, brightness, brightness) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  });
}

function HaloCeiling({ height }: { height: number }) {
  const m = getLibrary();
  const rings = [6.4, 5.0, 3.4];
  const band = useDisposable(() => new THREE.CylinderGeometry(1, 1, 0.5, 96, 1, true));
  const halo = useDisposable(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#e6f0ff").multiplyScalar(2) }));
  // Barely perceptible "breathing" of the halo light: a living, not static, space.
  useFrame((state) => {
    const k = 2 + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
    halo.color.set("#e6f0ff").multiplyScalar(k);
  });
  return (
    <group position={[C.x, height, C.z]}>
      {rings.map((r, i) => (
        <group key={r}>
          <mesh geometry={geo.torus(0.025, 128)} material={halo} position={[0, -0.32 - i * 0.12, 0]} scale={r} />
          <mesh geometry={band} material={m.whiteSatin} position={[0, -0.12 - i * 0.06, 0]} scale={[r + 0.06, 0.6 + i * 0.25, r + 0.06]} />
        </group>
      ))}
      <mesh geometry={geo.disk(64)} material={m.lightCool} position={[0, -0.03, 0]} rotation={[Math.PI, 0, 0]} scale={2.4} />
    </group>
  );
}

function CentralColumn({ height }: { height: number }) {
  const m = getLibrary();
  const screen = useCanvasMaterial(() => paintScreen(0), 1.1);
  const devices = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    const cols = 22;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < cols; i++) {
        const a = (i / cols) * Math.PI * 2 + (row % 2) * 0.07;
        const r = 1.52;
        out.push({
          position: [C.x + Math.cos(a) * r, 1.45 + row * 0.36, C.z + Math.sin(a) * r],
          rotation: [0, Math.PI / 2 - a, 0],
          scale: [0.11, 0.22, 1],
        });
      }
    }
    return out;
  }, []);
  const counter = useDisposable(() => new THREE.CylinderGeometry(1.75, 1.62, 0.92, 64, 1).translate(0, 0.46, 0));
  return (
    <group>
      <mesh geometry={geo.cyl(64)} material={m.whiteSatin} position={[C.x, 0, C.z]} scale={[1.5, height, 1.5]} castShadow />
      <mesh geometry={counter} material={m.whiteSatin} position={[C.x, 0, C.z]} castShadow />
      <mesh geometry={geo.torus(0.02, 96)} material={m.lightBlue} position={[C.x, 0.06, C.z]} scale={1.66} />
      <mesh geometry={geo.torus(0.015, 96)} material={m.lightCool} position={[C.x, 0.93, C.z]} scale={1.76} />
      <Instanced geometry={geo.plane()} material={screen} transforms={devices} />
      <mesh geometry={geo.cyl(64)} material={m.lightCool} position={[C.x, 3.05, C.z]} scale={[1.53, 0.05, 1.53]} />
    </group>
  );
}

function DemoTables() {
  const m = getLibrary();
  const top = useDisposable(() => new RoundedBoxGeometry(2.6, 0.08, 0.95, 4, 0.04));
  const screen = useCanvasMaterial(() => paintScreen(3), 1.25);
  const tables = useMemo(() => [0, 1, 2, 3].map(lumenTable), []);
  const pedestals = useMemo<InstanceTransform[]>(
    () => tables.map((t) => ({ position: [t.x, 0.47, t.z], rotation: [0, t.rotY, 0], scale: [2.0, 0.74, 0.55] })),
    [tables],
  );
  const glow = useMemo<InstanceTransform[]>(
    () => tables.map((t) => ({ position: [t.x, 0.06, t.z], rotation: [0, t.rotY, 0], scale: [2.05, 0.03, 0.6] })),
    [tables],
  );
  // Secondary demo devices around each hero product.
  const devices = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    tables.forEach((t) => {
      for (const off of [-0.95, -0.6, 0.6, 0.95]) {
        const lx = off;
        const lz = 0.18;
        const c = Math.cos(t.rotY);
        const s = Math.sin(t.rotY);
        out.push({
          position: [t.x + lx * c + lz * s, 0.99, t.z - lx * s + lz * c],
          rotation: [-1.1, t.rotY, 0],
          scale: [0.07, 0.15, 1],
        });
      }
    });
    return out;
  }, [tables]);
  const pools = useMemo(() => tables.map((t) => ({ x: t.x, z: t.z, r: 1.6 })), [tables]);
  return (
    <group>
      <Instanced geometry={geo.box()} material={m.floorConcrete} transforms={pedestals} castShadow />
      <Instanced geometry={geo.box()} material={m.lightBlue} transforms={glow} />
      {tables.map((t, i) => (
        <mesh key={i} geometry={top} material={m.whiteSatin} position={[t.x, 0.88, t.z]} rotation={[0, t.rotY, 0]} castShadow receiveShadow />
      ))}
      <Instanced geometry={geo.plane()} material={screen} transforms={devices} />
      <LightPools pools={pools} cool />
    </group>
  );
}

function LightBox({ index, position }: { index: number; position: [number, number, number] }) {
  const m = getLibrary();
  const mat = useCanvasMaterial(() => paintPoster(index), 1.15);
  return (
    <group position={position}>
      <mesh geometry={geo.box()} material={m.whiteSatin} position={[0, 0, 0.03]} scale={[1.7, 2.5, 0.08]} />
      <mesh geometry={geo.plane()} material={mat} position={[0, 0, 0.08]} scale={[1.6, 2.4, 1]} />
    </group>
  );
}

function PerimeterDisplays({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
  const tv = useCanvasMaterial(() => paintScreen(1, 512, 288), 1.2);
  const shelfDevices = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (const side of [-1, 1]) {
      for (let z = -3.2; z >= -12.4; z -= 0.42) {
        for (const y of [1.55, 2.0]) {
          out.push({ position: [side * (half - 0.32), y, z], rotation: [0, -side * Math.PI / 2, 0], scale: [0.09, 0.18, 1] });
        }
      }
    }
    return out;
  }, [half]);
  const screen = useCanvasMaterial(() => paintScreen(3), 1.05);
  return (
    <group>
      {/* Counters */}
      <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[0, 0, -d + 0.5]} scale={[store.width - 0.4, 0.92, 1.0]} castShadow receiveShadow />
      <mesh geometry={geo.box()} material={m.lightCool} position={[0, 0.06, -d + 1.01]} scale={[store.width - 0.6, 0.02, 0.02]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[s * (half - 0.45), 0, -7.6]} scale={[0.9, 0.92, 10.8]} castShadow receiveShadow />
          <mesh geometry={geo.box()} material={m.lightCool} position={[s * (half - 0.91), 0.06, -7.6]} scale={[0.02, 0.02, 10.6]} />
          {/* Shelf ledges for the device wall */}
          {[1.45, 1.9].map((y) => (
            <mesh key={y} geometry={geo.box()} material={m.whiteSatin} position={[s * (half - 0.28), y - 0.12, -7.8]} scale={[0.3, 0.025, 9.6]} />
          ))}
        </group>
      ))}
      <Instanced geometry={geo.plane()} material={screen} transforms={shelfDevices} />
      {/* Back wall: light boxes and screens */}
      {[0, 1, 2, 3].map((i) => (
        <LightBox key={i} index={i} position={[-6.6 + i * 4.4, 3.3, -d + 0.04]} />
      ))}
      {[-4.4, 0, 4.4].map((x) => (
        <group key={x} position={[x, 2.1, -d + 0.08]}>
          <mesh geometry={geo.box()} material={m.screenDark} scale={[1.7, 0.98, 0.05]} />
          <mesh geometry={geo.plane()} material={tv} position={[0, 0, 0.03]} scale={[1.62, 0.9, 1]} />
        </group>
      ))}
      {/* Track spotlights */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo.box()} material={m.blackMetal} position={[s * (half - 1.4), store.height - 0.05, -7]} scale={[0.05, 0.05, 11]} />
          {[-11, -8.5, -6, -3.5].map((z) => (
            <group key={z} position={[s * (half - 1.4), store.height - 0.22, z]} rotation={[0, 0, s * 0.6]}>
              <mesh geometry={geo.rod(16)} material={m.whiteSatin} scale={[0.06, 0.22, 0.06]} />
              <mesh geometry={geo.disk(16)} material={m.lightCool} position={[0, -0.112, 0]} rotation={[Math.PI, 0, 0]} scale={0.05} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

export function LumenInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  return (
    <StoreShell store={store} ceilingLights={false}>
      {/* Dark circular demo zone on the pale floor */}
      <mesh geometry={geo.disk(96)} material={m.floorConcreteDark} position={[C.x, 0.004, C.z]} scale={6.3} receiveShadow />
      <mesh geometry={geo.torus(0.012, 128)} material={m.lightCool} position={[C.x, 0.006, C.z]} scale={6.3} />
      <HaloCeiling height={store.height} />
      <CentralColumn height={store.height} />
      <DemoTables />
      <PerimeterDisplays store={store} />
      <LightPools pools={[{ x: C.x, z: C.z, r: 7 }]} cool />
    </StoreShell>
  );
}
