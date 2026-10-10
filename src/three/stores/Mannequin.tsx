"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { geo } from "../architecture/shared";
import { getLibrary } from "../materials/library";
import { useDisposable } from "../architecture/primitives";

export type Outfit = "coat" | "dress" | "knit";

/** Garment material keyed by colour; owned by the mannequin that created it. */
export function useGarmentMaterial(color: string, roughness = 0.92) {
  const m = getLibrary();
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: m.textures.fabric, color, roughness }),
    // Colour changes are applied in place below to avoid recompiling shaders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m],
  );
  useLayoutEffect(() => {
    material.color.set(color);
  }, [material, color]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * Abstract display mannequin (matte black, after the storefront reference) wearing a
 * simplified garment. ~1.78 m tall, feet at the origin.
 */
export function Mannequin({
  position,
  rotY = 0,
  outfit,
  color,
}: {
  position: [number, number, number];
  rotY?: number;
  outfit: Outfit;
  color: string;
}) {
  const m = getLibrary();
  const garment = useGarmentMaterial(color);
  const coatBody = useDisposable(() => new THREE.CylinderGeometry(0.2, 0.3, 1, 20, 1).translate(0, 0.5, 0));
  const skirt = useDisposable(() => new THREE.CylinderGeometry(0.15, 0.36, 1, 24, 1, true).translate(0, 0.5, 0));
  const skin = m.blackMetal;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Stand */}
      <mesh geometry={geo.cyl(24)} material={m.brass} scale={[0.22, 0.02, 0.22]} />
      <mesh geometry={geo.cyl(8)} material={m.brass} scale={[0.015, 0.85, 0.015]} />
      {/* Figure */}
      <mesh geometry={geo.sphere(16)} material={skin} position={[0, 1.66, 0]} scale={[0.09, 0.115, 0.1]} castShadow />
      <mesh geometry={geo.cyl(10)} material={skin} position={[0, 1.48, 0]} scale={[0.04, 0.1, 0.04]} />
      <mesh geometry={geo.capsule()} material={skin} position={[-0.09, 0.62, 0]} scale={[0.1, 0.6, 0.1]} />
      <mesh geometry={geo.capsule()} material={skin} position={[0.09, 0.62, 0]} scale={[0.1, 0.6, 0.1]} />
      {outfit === "coat" && (
        <group>
          <mesh geometry={coatBody} material={garment} position={[0, 0.62, 0]} scale={[1, 0.88, 0.62]} castShadow />
          <mesh geometry={geo.sphere(16)} material={garment} position={[0, 1.4, 0]} scale={[0.24, 0.08, 0.14]} />
          <mesh geometry={geo.capsule()} material={garment} position={[-0.25, 1.02, 0]} rotation={[0, 0, 0.1]} scale={[0.1, 0.34, 0.1]} castShadow />
          <mesh geometry={geo.capsule()} material={garment} position={[0.25, 1.02, 0]} rotation={[0, 0, -0.1]} scale={[0.1, 0.34, 0.1]} castShadow />
          <mesh geometry={geo.box()} material={m.blackMetal} position={[0, 1.0, 0.19]} scale={[0.012, 0.75, 0.01]} />
        </group>
      )}
      {outfit === "dress" && (
        <group>
          <mesh geometry={geo.capsule()} material={garment} position={[0, 1.18, 0]} scale={[0.32, 0.38, 0.2]} castShadow />
          <mesh geometry={skirt} material={garment} position={[0, 0.25, 0]} scale={[1, 0.82, 0.7]} castShadow />
          <mesh geometry={geo.capsule()} material={skin} position={[-0.22, 1.06, 0]} rotation={[0, 0, 0.1]} scale={[0.07, 0.34, 0.07]} />
          <mesh geometry={geo.capsule()} material={skin} position={[0.22, 1.06, 0]} rotation={[0, 0, -0.1]} scale={[0.07, 0.34, 0.07]} />
        </group>
      )}
      {outfit === "knit" && (
        <group>
          <mesh geometry={geo.capsule()} material={garment} position={[0, 1.15, 0]} scale={[0.36, 0.42, 0.22]} castShadow />
          <mesh geometry={geo.capsule()} material={m.fabricCharcoal} position={[0, 0.65, 0]} scale={[0.3, 0.3, 0.2]} />
        </group>
      )}
      <mesh geometry={geo.flat()} material={m.blobShadow} position={[0, 0.005, 0]} scale={[0.9, 1, 0.9]} renderOrder={1} />
    </group>
  );
}
