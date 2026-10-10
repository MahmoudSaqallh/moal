import * as THREE from "three";

/**
 * Unit primitives shared by every small prop in the mall. Props scale these instead of
 * allocating their own geometry, so hundreds of benches, frames and fixtures reuse a
 * handful of GPU buffers. Disposed once when the world unmounts.
 */
const cache = new Map<string, THREE.BufferGeometry>();

function get(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export const geo = {
  /** 1×1×1 box centred on the origin. */
  box: () => get("box", () => new THREE.BoxGeometry(1, 1, 1)),
  /** 1×1×1 box with its base on y=0. */
  boxBase: () => get("boxBase", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  /** Radius 1, height 1 cylinder with its base on y=0. */
  cyl: (segments = 24) => get(`cyl${segments}`, () => new THREE.CylinderGeometry(1, 1, 1, segments).translate(0, 0.5, 0)),
  /** Centred cylinder (for rods along an axis after rotation). */
  rod: (segments = 10) => get(`rod${segments}`, () => new THREE.CylinderGeometry(1, 1, 1, segments)),
  sphere: (segments = 20) => get(`sph${segments}`, () => new THREE.SphereGeometry(1, segments, Math.round(segments * 0.66))),
  /** Unit plane facing +Z. */
  plane: () => get("plane", () => new THREE.PlaneGeometry(1, 1)),
  /** Unit plane lying flat facing +Y (decals, light pools). */
  flat: () => get("flat", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  disk: (segments = 32) => get(`disk${segments}`, () => new THREE.CircleGeometry(1, segments).rotateX(-Math.PI / 2)),
  torus: (tube = 0.02, segments = 64) =>
    get(`torus${tube}-${segments}`, () => new THREE.TorusGeometry(1, tube, 8, segments).rotateX(Math.PI / 2)),
  capsule: () => get("capsule", () => new THREE.CapsuleGeometry(0.5, 1, 6, 16)),
};

export function disposeSharedGeometry() {
  cache.forEach((g) => g.dispose());
  cache.clear();
}
