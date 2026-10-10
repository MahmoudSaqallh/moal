"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeBoxes, mergeFloors, type BoxSpec } from "./geometry";
import type { Rect } from "@/types";

/** A set of boxes merged into one mesh (one draw call). Geometry is disposed on unmount. */
export function StaticBoxes({
  boxes,
  material,
  uvScale = 1,
  castShadow = false,
  receiveShadow = true,
}: {
  boxes: readonly BoxSpec[];
  material: THREE.Material;
  uvScale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const geometry = useMemo(() => (boxes.length ? mergeBoxes(boxes, uvScale) : null), [boxes, uvScale]);
  useLayoutEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} castShadow={castShadow} receiveShadow={receiveShadow} />;
}

/** Merged floor rectangles with world-aligned texture coordinates. */
export function FloorRects({
  rects,
  material,
  uvScale,
  y = 0,
}: {
  rects: readonly Rect[];
  material: THREE.Material;
  uvScale: number;
  y?: number;
}) {
  const geometry = useMemo(() => mergeFloors(rects, uvScale, y), [rects, uvScale, y]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

export interface InstanceTransform {
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number] | number;
}

/**
 * Static instanced mesh. Matrices are written once; bounding sphere is computed so the
 * whole batch is frustum-culled as a unit.
 */
export function Instanced({
  geometry,
  material,
  transforms,
  castShadow = false,
  receiveShadow = false,
  renderOrder,
  colors,
  children,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: readonly InstanceTransform[];
  /** Optional per-instance tint (multiplies the material colour). */
  colors?: readonly string[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  children?: ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    transforms.forEach((t, i) => {
      p.set(t.position[0], t.position[1], t.position[2]);
      e.set(t.rotation?.[0] ?? 0, t.rotation?.[1] ?? 0, t.rotation?.[2] ?? 0);
      q.setFromEuler(e);
      if (typeof t.scale === "number") s.setScalar(t.scale);
      else if (t.scale) s.set(t.scale[0], t.scale[1], t.scale[2]);
      else s.set(1, 1, 1);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    if (colors) {
      const color = new THREE.Color();
      colors.forEach((hex, i) => mesh.setColorAt(i, color.set(hex)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms, colors]);
  if (!transforms.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, transforms.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      renderOrder={renderOrder}
    >
      {children}
    </instancedMesh>
  );
}

/** Geometry created once per component instance and disposed with it. */
export function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[] = []): T {
  // Generic helper: callers pass their own dependency list, which the compiler cannot verify statically.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const value = useMemo(factory, deps);
  useLayoutEffect(() => () => value.dispose(), [value]);
  return value;
}
