"use client";

import { useLayoutEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StoreConfig } from "@/types";
import { facingYaw } from "@/lib/space";
import { floorY } from "@/data/floors";
import { G } from "../architecture/constants";
import { boxFromBounds } from "../architecture/geometry";
import { FloorRects, Instanced, StaticBoxes, useDisposable, type InstanceTransform } from "../architecture/primitives";
import { geo } from "../architecture/shared";
import { getLibrary, type MaterialLibrary } from "../materials/library";
import { LightPools } from "../environments/Furniture";

const WALL = 0.3;

export function floorMaterial(store: StoreConfig, m: MaterialLibrary) {
  switch (store.theme.floor) {
    case "marble":
      return { material: m.floorMarble, uv: 2.4 };
    case "oak":
      return { material: m.floorOak, uv: 1.8 };
    case "herringbone":
      return { material: m.floorHerringbone, uv: 1.6 };
    case "concrete":
      return { material: m.floorConcrete, uv: 4 };
    case "terrazzo":
      return { material: m.floorTerrazzo, uv: 3 };
    case "dark-stone":
      return { material: m.floorDarkStone, uv: 2.4 };
  }
}

/** Per-store wall finish: the shared plaster texture tinted to the brand palette. */
export function useWallMaterial(store: StoreConfig) {
  const m = getLibrary();
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: m.textures.plaster,
        color: store.theme.wall,
        roughness: store.theme.facade === "bronze-mirror" ? 0.55 : 0.88,
        metalness: store.theme.facade === "bronze-mirror" ? 0.2 : 0,
      }),
    [m, store.theme.wall, store.theme.facade],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * Interior shell in store-local space: floor, three walls, ceiling with a downlight grid
 * and baked light pools. Children add the store-specific fixtures.
 */
export function StoreShell({ store, children, ceilingLights = true }: { store: StoreConfig; children?: ReactNode; ceilingLights?: boolean }) {
  const m = getLibrary();
  const half = store.width / 2;
  const d = store.depth;
  const H = store.height;
  const wallMat = useWallMaterial(store);
  const floor = floorMaterial(store, m);
  const floorRect = useMemo(() => [{ minX: -half, maxX: half, minZ: -d, maxZ: 0 }], [half, d]);

  const walls = useMemo(
    () => [
      boxFromBounds(-half - WALL, -half, 0, G, -d - WALL, 0),
      boxFromBounds(half, half + WALL, 0, G, -d - WALL, 0),
      boxFromBounds(-half, half, 0, G, -d - WALL, -d),
    ],
    [half, d],
  );
  const ceiling = useMemo(() => [boxFromBounds(-half - WALL, half + WALL, H, H + 0.2, -d - WALL, 0)], [half, d, H]);

  const lights = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    if (!ceilingLights) return out;
    for (let x = -half + 2; x <= half - 1.9; x += 2.6) for (let z = -2.4; z >= -d + 1.9; z -= 2.8) out.push({ x, z });
    return out;
  }, [half, d, ceilingLights]);
  const downlights = useMemo<InstanceTransform[]>(
    () => lights.map((l) => ({ position: [l.x, H - 0.01, l.z], rotation: [Math.PI, 0, 0], scale: 0.09 })),
    [lights, H],
  );
  const pools = useMemo(() => lights.map((l) => ({ x: l.x, z: l.z, r: 1.15 })), [lights]);

  const ao = useDisposable(() => {
    const parts = [
      new THREE.PlaneGeometry(d, 1).rotateY(Math.PI / 2).translate(-half + 0.01, 0.5, -d / 2),
      new THREE.PlaneGeometry(d, 1).rotateY(-Math.PI / 2).translate(half - 0.01, 0.5, -d / 2),
      new THREE.PlaneGeometry(store.width, 1).translate(0, 0.5, -d + 0.01),
    ];
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
  }, [half, d, store.width]);

  return (
    <group position={[store.origin.x, floorY(store.floor), store.origin.z]} rotation={[0, facingYaw(store.facing), 0]}>
      <FloorRects rects={floorRect} material={floor.material} uvScale={floor.uv} />
      <StaticBoxes boxes={walls} material={wallMat} uvScale={2.4} />
      <StaticBoxes boxes={ceiling} material={m.ceiling} />
      <mesh geometry={ao} material={m.wallAO} renderOrder={1} />
      <Instanced geometry={geo.disk(16)} material={store.theme.light === "cool" ? m.lightCool : m.lightWarm} transforms={downlights} />
      <LightPools pools={pools} cool={store.theme.light === "cool"} />
      {children}
    </group>
  );
}
