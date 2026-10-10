"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FOUNTAIN } from "@/data/layout";
import { Instanced, useDisposable, type InstanceTransform } from "./primitives";
import { geo } from "./shared";
import { getLibrary } from "../materials/library";
import { Shrubs } from "../environments/Plants";

/**
 * The atrium centrepiece, after the reference's stacked-disc spiral fountain:
 * polished steel lenses rising on a helix above a stone basin, with water spilling
 * from a crown bowl into tiered pools, ringed by planting.
 */

const DISCS = 44;
const HELIX_R = 0.42;
const BASE_Y = 1.6;
const TOP_Y = 17.5; // rises through all three levels of the atrium void

export function Fountain() {
  const m = getLibrary();
  const lens = useDisposable(() => {
    const g = new THREE.SphereGeometry(1, 40, 12);
    g.scale(1, 0.11, 1);
    return g;
  });
  const bowl = useDisposable(() => {
    // Shallow dish profile (lathe).
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.9, 0.04),
      new THREE.Vector2(1.6, 0.16),
      new THREE.Vector2(1.95, 0.32),
      new THREE.Vector2(2, 0.36),
      new THREE.Vector2(1.9, 0.38),
      new THREE.Vector2(1.5, 0.24),
      new THREE.Vector2(0.8, 0.14),
      new THREE.Vector2(0, 0.12),
    ];
    return new THREE.LatheGeometry(pts, 48);
  });
  const coping = useDisposable(() => {
    const g = new THREE.RingGeometry(FOUNTAIN.basinRadius - 0.35, FOUNTAIN.basinRadius + 0.05, 96, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const basinWall = useDisposable(
    () => new THREE.CylinderGeometry(FOUNTAIN.basinRadius + 0.05, FOUNTAIN.basinRadius + 0.05, 0.5, 96, 1, true).translate(0, 0.25, 0),
  );
  const planterWall = useDisposable(
    () => new THREE.CylinderGeometry(FOUNTAIN.planterRadius, FOUNTAIN.planterRadius, 0.55, 96, 1, true).translate(0, 0.275, 0),
  );
  const planterTop = useDisposable(() =>
    new THREE.RingGeometry(FOUNTAIN.basinRadius + 0.05, FOUNTAIN.planterRadius, 96).rotateX(-Math.PI / 2),
  );

  const discs = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (let i = 0; i < DISCS; i++) {
      const t = i / (DISCS - 1);
      const a = i * 0.46;
      const r = 1.35 - t * 0.55 + Math.sin(i * 0.9) * 0.08;
      out.push({
        position: [FOUNTAIN.x + Math.cos(a) * HELIX_R * (1 - t * 0.3), BASE_Y + t * (TOP_Y - BASE_Y), FOUNTAIN.z + Math.sin(a) * HELIX_R],
        rotation: [Math.sin(a) * 0.12, a, Math.cos(a) * 0.12],
        scale: [r, 1, r],
      });
    }
    return out;
  }, []);

  const streams = useMemo<InstanceTransform[]>(() => {
    const out: InstanceTransform[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      out.push({
        position: [FOUNTAIN.x + Math.cos(a) * 1.97, 0.8, FOUNTAIN.z + Math.sin(a) * 1.97],
        // Face outward (tangent to the bowl rim).
        rotation: [0, Math.PI / 2 - a, 0],
        scale: [0.55, 0.85, 1],
      });
    }
    return out;
  }, []);

  const shrubs = useMemo(() => {
    const out = [];
    const ringR = (FOUNTAIN.basinRadius + FOUNTAIN.planterRadius) / 2 + 0.05;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      out.push({ x: FOUNTAIN.x + Math.cos(a) * ringR, y: 0.6, z: FOUNTAIN.z + Math.sin(a) * ringR, r: 0.42 + (i % 3) * 0.06, h: 0.7 });
    }
    return out;
  }, []);

  // Water surfaces drift slowly; streams scroll downwards.
  useFrame((_, dt) => {
    const t = m.textures;
    t.waterNormal.offset.x += dt * 0.012;
    t.waterNormal.offset.y += dt * 0.008;
    t.streaks.offset.y += dt * 0.9;
  });

  return (
    <group>
      {/* Basin */}
      <mesh geometry={basinWall} material={m.wallStone} receiveShadow />
      <mesh geometry={coping} material={m.whiteSatin} position={[FOUNTAIN.x, 0.5, FOUNTAIN.z]} receiveShadow />
      <mesh geometry={geo.disk(64)} material={m.floorDarkStone} position={[FOUNTAIN.x, 0.05, FOUNTAIN.z]} scale={FOUNTAIN.basinRadius} />
      <mesh geometry={geo.disk(64)} material={m.water} position={[FOUNTAIN.x, 0.38, FOUNTAIN.z]} scale={FOUNTAIN.basinRadius - 0.1} />
      {/* Planting ring */}
      <mesh geometry={planterWall} material={m.whiteSatin} position={[FOUNTAIN.x, 0, FOUNTAIN.z]} receiveShadow />
      <mesh geometry={planterTop} material={m.soil} position={[FOUNTAIN.x, 0.5, FOUNTAIN.z]} />
      <Shrubs shrubs={shrubs} />

      {/* Tiered bowls catching the cascade */}
      <mesh geometry={bowl} material={m.chrome} position={[FOUNTAIN.x, 0.9, FOUNTAIN.z]} castShadow />
      <mesh geometry={geo.disk(48)} material={m.water} position={[FOUNTAIN.x, 1.17, FOUNTAIN.z]} scale={1.75} />
      <mesh geometry={geo.cyl(16)} material={m.chrome} position={[FOUNTAIN.x, 0.3, FOUNTAIN.z]} scale={[0.22, 0.62, 0.22]} />
      <Instanced geometry={geo.plane()} material={m.waterStream} transforms={streams} />

      {/* Spiral sculpture */}
      <mesh geometry={geo.cyl(12)} material={m.steel} position={[FOUNTAIN.x, BASE_Y - 0.4, FOUNTAIN.z]} scale={[0.09, TOP_Y - BASE_Y + 0.4, 0.09]} />
      <Instanced geometry={lens} material={m.chrome} transforms={discs} castShadow />
    </group>
  );
}
