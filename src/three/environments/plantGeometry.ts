import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "../materials/textures";

/** Three crossed quads sharing one leaf texture: reads as a leafy clump from any angle. */
export function leafClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1, 1);
    p.rotateY((i * Math.PI) / 3);
    p.rotateX((i - 1) * 0.35);
    parts.push(p);
  }
  const horizontal = new THREE.PlaneGeometry(1, 1);
  horizontal.rotateX(-Math.PI / 2);
  parts.push(horizontal);
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Lumpy sphere for hedges and inner canopy volume. */
export function lumpGeometry(seed = 1, detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const rand = seeded(seed);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const cache = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      k = 0.85 + rand() * 0.3;
      cache.set(key, k);
    }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  // Weld shared corners so the lump shades smoothly instead of looking faceted.
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const welded = mergeVertices(g, 1e-4);
  g.dispose();
  welded.computeVertexNormals();
  return welded;
}

/** Gently curved palm trunk of unit height with ring texture via vertex bulges. */
export function palmTrunkGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 0.35, 0),
    new THREE.Vector3(0.18, 0.7, 0),
    new THREE.Vector3(0.32, 1, 0),
  ]);
  const g = new THREE.TubeGeometry(curve, 24, 1, 8, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  // Taper towards the crown and add subtle growth rings.
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 9);
    const t = ring / 24;
    const center = curve.getPoint(t);
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center);
    const radius = (0.16 - t * 0.06) * (1 + 0.06 * Math.sin(t * 90));
    tmp.multiplyScalar(radius).add(center);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Radial crown of arching fronds, merged into one geometry (unit scale ≈ 3 m span). */
export function palmCrownGeometry(count = 11): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const frond = new THREE.PlaneGeometry(0.55, 2.2, 1, 10);
    frond.translate(0, 1.1, 0);
    const pos = frond.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      const t = y / 2.2;
      // Lay the frond outward along +Z and arch it down.
      const out = y * 0.95;
      const droop = Math.sin(t * Math.PI * 0.85) * 0.55 - t * t * 1.1;
      pos.setXYZ(v, pos.getX(v), droop, out);
    }
    frond.computeVertexNormals();
    frond.rotateY((i / count) * Math.PI * 2 + (i % 2) * 0.2);
    frond.rotateX(0);
    parts.push(frond);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}
