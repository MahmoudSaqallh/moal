"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { StoreConfig } from "@/types";
import { boxFromBounds, type BoxSpec } from "../../architecture/geometry";
import { Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "../../architecture/primitives";
import { geo } from "../../architecture/shared";
import { getLibrary } from "../../materials/library";
import { paintMenuBoard, paintScreen } from "../../materials/signage";
import { seeded, toTexture } from "../../materials/textures";
import { CafeSets, LightPools } from "../../environments/Furniture";
import { StoreShell } from "../StoreInterior";

/* Store-local coordinates; obstacles mirror data/storeLayouts.ts (arcade, restaurant). */

function useScreenMaterial(seed: number, w = 512, h = 288, brightness = 1.15) {
  return useDisposable(() => {
    const tex = toTexture(paintScreen(seed, w, h), { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(brightness, brightness, brightness) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  }, [seed, w, h, brightness]);
}

const BOX_TONES = ["#57c7b8", "#ef8a6f", "#9fb4cc", "#e8cf6a", "#c8907a", "#e9ecef", "#7c8467"];

/** PIXEL FORGE — graphite gaming store: demo pods, console island, games wall, LED back wall. */
export function ArcadeInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
  const wall = useScreenMaterial(4, 1024, 256, 1.05);
  const pod = useScreenMaterial(1);
  const island = useDisposable(() => new RoundedBoxGeometry(4.6, 0.9, 3.0, 4, 0.12));
  const { boxes, colors } = useMemo(() => {
    const boxes: InstanceTransform[] = [];
    const colors: string[] = [];
    const rand = seeded(17);
    for (const y of [0.55, 0.95, 1.35, 1.75, 2.15]) {
      for (let z = -12.2; z <= -2.8; z += 0.22) {
        if (y === 1.35 && Math.abs(z + 5.4) < 0.5) continue; // headset display gap
        boxes.push({ position: [half - 0.4, y + 0.12, z], scale: [0.14, 0.2, 0.17] });
        colors.push(BOX_TONES[Math.floor(rand() * BOX_TONES.length)]);
      }
    }
    return { boxes, colors };
  }, [half]);
  const shelves = useMemo(() => [0.55, 0.95, 1.35, 1.75, 2.15].map((y) => boxFromBounds(half - 0.75, half - 0.05, y - 0.03, y, -12.5, -2.5)), [half]);
  const pods = [-4.2, -7.1, -10];
  return (
    <StoreShell store={store} ceilingLights={false}>
      {/* LED wall and service counter */}
      <mesh geometry={geo.plane()} material={wall} position={[0, 3.0, -d + 0.05]} scale={[store.width - 1.2, 3.4, 1]} />
      <mesh geometry={geo.boxBase()} material={m.blackMetal} position={[0, 0, -d + 0.6]} scale={[store.width - 0.6, 1.0, 1.1]} />
      <mesh geometry={geo.box()} material={m.lightCool} position={[0, 0.06, -d + 1.16]} scale={[store.width - 0.8, 0.02, 0.02]} />
      {/* Console island */}
      <mesh geometry={island} material={m.whiteSatin} position={[0, 0.45, -7]} castShadow receiveShadow />
      <mesh geometry={geo.box()} material={m.lightCool} position={[0, 0.05, -7]} scale={[4.4, 0.02, 2.8]} />
      <mesh geometry={geo.box()} material={m.screenDark} position={[0, 1.75, -8.35]} scale={[2.4, 1.35, 0.06]} />
      <mesh geometry={geo.plane()} material={pod} position={[0, 1.75, -8.31]} scale={[2.3, 1.25, 1]} />
      {/* Demo pods along the left wall */}
      {pods.map((z) => (
        <group key={z} position={[-half + 0.95, 0, z]}>
          <mesh geometry={geo.boxBase()} material={m.blackMetal} scale={[1.2, 0.78, 1.8]} castShadow />
          <mesh geometry={geo.box()} material={m.screenDark} position={[-0.45, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1.5, 0.85, 0.05]} />
          <mesh geometry={geo.plane()} material={pod} position={[-0.42, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1.4, 0.78, 1]} />
          <mesh geometry={geo.cyl(20)} material={m.fabricCharcoal} position={[0.95, 0, 0]} scale={[0.3, 0.48, 0.3]} />
        </group>
      ))}
      {/* Games wall */}
      <StaticBoxes boxes={shelves} material={m.whiteSatin} />
      <Instanced geometry={geo.box()} material={m.satinWhiteTint} transforms={boxes} colors={colors} />
      {/* Ceiling light lines */}
      {[-5, 0, 5].map((x) => (
        <mesh key={x} geometry={geo.box()} material={m.lightCool} position={[x, store.height - 0.04, -7]} scale={[0.06, 0.04, d - 2]} />
      ))}
      <LightPools pools={[{ x: 0, z: -7, r: 4.5 }, { x: -half + 1, z: -7, r: 3 }, { x: half - 1, z: -7.5, r: 3 }]} cool />
    </StoreShell>
  );
}

/** Restaurant layout shared by Saffron Table and Umami Street, themed by the store config. */
export function RestaurantInterior({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
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
  const sets = useMemo(
    () => [
      { x: -5.2, z: -4.6, rotY: 0.2, chairs: 4 },
      { x: -5.2, z: -8.2, rotY: 0.9, chairs: 4 },
      { x: 5.2, z: -4.6, rotY: 0.5, chairs: 4 },
      { x: 5.2, z: -8.2, rotY: 1.2, chairs: 4 },
    ],
    [],
  );
  const pendants = useMemo<InstanceTransform[]>(
    () => sets.map((s) => ({ position: [s.x, 2.4, s.z], scale: [0.32, 0.22, 0.32] })),
    [sets],
  );
  const screen = useMemo(() => {
    const boxes: BoxSpec[] = [];
    for (let x = -half + 0.3; x <= half - 0.2; x += 0.35) boxes.push(boxFromBounds(x - 0.05, x + 0.05, 2.6, 4.6, -d + 1.0, -d + 1.1));
    return boxes;
  }, [half, d]);
  const isTerracotta = store.theme.facade === "terracotta-arch";
  return (
    <StoreShell store={store} ceilingLights={false}>
      {/* Open kitchen: back counter, hood, warm lighting */}
      <mesh geometry={geo.boxBase()} material={m.steel} position={[0, 0, -d + 0.65]} scale={[store.width - 0.6, 0.95, 1.2]} />
      <mesh geometry={geo.boxBase()} material={isTerracotta ? m.terracotta : m.oakDark} position={[0, 3.2, -d + 0.5]} scale={[store.width - 0.6, 0.6, 0.9]} />
      <mesh geometry={geo.box()} material={m.lightAmber} position={[0, 3.15, -d + 0.9]} scale={[store.width - 1, 0.03, 0.04]} />
      <StaticBoxes boxes={screen} material={m.oak} />
      <mesh geometry={geo.plane()} material={menu} position={[0, 4.25, -d + 0.06]} scale={[3.6, 1.8, 1]} />
      {/* Chef's pass, where order-ahead dishes are presented */}
      <mesh geometry={geo.boxBase()} material={isTerracotta ? m.terracotta : m.oakDark} position={[0, 0, -11.9]} scale={[14.2, 1.0, 1.5]} castShadow />
      <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[0, 1.0, -11.9]} scale={[14.4, 0.05, 1.6]} receiveShadow />
      <mesh geometry={geo.box()} material={m.lightWarm} position={[0, 2.2, -11.9]} scale={[13, 0.04, 0.06]} />
      {/* Dining room */}
      <CafeSets sets={sets} />
      <Instanced geometry={geo.sphere(18)} material={m.lightWarm} transforms={pendants} />
      <mesh geometry={geo.boxBase()} material={m.fabricTerracotta} position={[-half + 0.5, 0, -6.4]} scale={[0.7, 0.45, 7.2]} />
      <mesh geometry={geo.boxBase()} material={m.fabricTerracotta} position={[half - 0.5, 0, -6.4]} scale={[0.7, 0.45, 7.2]} />
      <LightPools pools={[{ x: 0, z: -11.9, r: 4 }, ...sets.map((s) => ({ x: s.x, z: s.z, r: 1.8 }))]} />
    </StoreShell>
  );
}
