import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Architectural geometry helpers.
 *
 * Boxes get UVs in *metres / uvScale* so a marble or oak texture keeps the same physical
 * size on every surface. Many boxes sharing a material are merged into a single geometry
 * so a whole wall system or floor costs one draw call.
 */

export interface BoxSpec {
  /** Centre position. */
  x: number;
  y: number;
  z: number;
  /** Size along X, Y, Z before rotation. */
  w: number;
  h: number;
  d: number;
  rotY?: number;
}

/** Box from min/max corners: handy for authoring from plan dimensions. */
export function boxFromBounds(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): BoxSpec {
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
    w: Math.max(0.001, maxX - minX),
    h: Math.max(0.001, maxY - minY),
    d: Math.max(0.001, maxZ - minZ),
  };
}

export function worldUVBox(w: number, h: number, d: number, uvScale = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    const [du, dv] = dims[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * du) / uvScale, (uv.getY(i) * dv) / uvScale);
    }
  }
  uv.needsUpdate = true;
  return g;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const unit = new THREE.Vector3(1, 1, 1);

export function mergeBoxes(boxes: readonly BoxSpec[], uvScale = 1): THREE.BufferGeometry {
  const parts = boxes.map((b) => {
    const g = worldUVBox(b.w, b.h, b.d, uvScale);
    tmpEuler.set(0, b.rotY ?? 0, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpMatrix.compose(tmpPos.set(b.x, b.y, b.z), tmpQuat, unit);
    g.applyMatrix4(tmpMatrix);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("mergeBoxes: incompatible geometries");
  merged.computeBoundingSphere();
  return merged;
}

/** Horizontal plane (floor/ceiling) with world-scaled UVs, lying on XZ. */
export function floorPlane(minX: number, maxX: number, minZ: number, maxZ: number, uvScale: number) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    // Offset by world position so adjacent floors line up seamlessly.
    uv.setXY(i, (uv.getX(i) * w + minX) / uvScale, (uv.getY(i) * d - maxZ) / uvScale);
  }
  g.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  return g;
}

export function mergeFloors(rects: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[], uvScale: number, y = 0) {
  const parts = rects.map((r) => floorPlane(r.minX, r.maxX, r.minZ, r.maxZ, uvScale).translate(0, y, 0));
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
