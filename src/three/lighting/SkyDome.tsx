"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDisposable } from "../architecture/primitives";

/**
 * Art-directed sky for every lighting mode: gradient zenith → horizon, a sun (or moon)
 * glow, drifting fair-weather clouds and, at night, a field of stars. One draw call, no
 * textures; follows the camera so it is always at infinity. Uniforms are shared so the
 * lighting rig can blend between day, evening and night.
 */
const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // render at the far plane
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uTime;
  uniform float uNight;
  uniform float uClouds;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
    col = mix(col, uZenith, smoothstep(0.12, 0.75, h));
    col = mix(col, uGround, smoothstep(0.0, -0.06, h));

    float sun = max(dot(dir, uSunDir), 0.0);
    col += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 24.0) * 0.35 + pow(sun, 4.0) * 0.12);

    if (h > 0.0 && uNight > 0.01) {
      vec2 g = floor(dir.xz / (h + 0.25) * 220.0);
      float star = step(0.9965, hash(g)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(g + 3.1) * 6.28));
      col += vec3(star) * uNight * smoothstep(0.05, 0.3, h);
    }

    if (h > 0.02) {
      vec2 uv = dir.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.004, 0.0);
      float c = fbm(uv * 1.3);
      float cover = smoothstep(0.58, 0.82, c) * smoothstep(0.02, 0.2, h) * uClouds;
      vec3 day = mix(vec3(1.0, 0.97, 0.93), uSunColor * 0.9 + 0.35, pow(sun, 3.0) * 0.6);
      vec3 cloud = mix(day, uMid * 1.4 + 0.02, uNight);
      cloud *= 0.92 + 0.12 * fbm(uv * 3.1);
      col = mix(col, cloud, cover * 0.85);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Shared, mutable sky uniforms (the lighting rig blends them between modes). */
export const skyUniforms = {
  uZenith: { value: new THREE.Color("#3f78c6") },
  uMid: { value: new THREE.Color("#8fb6e2") },
  uHorizon: { value: new THREE.Color("#efe2cf") },
  uGround: { value: new THREE.Color("#c9c3b6") },
  uSunDir: { value: new THREE.Vector3(-0.42, 0.62, 0.66).normalize() },
  uSunColor: { value: new THREE.Color("#ffd9a6") },
  uTime: { value: 0 },
  uNight: { value: 0 },
  uClouds: { value: 1 },
};

export function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useDisposable(() => new THREE.SphereGeometry(1, 48, 24));
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: skyUniforms,
      }),
    [],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    m.position.copy(state.camera.position);
    skyUniforms.uTime.value = state.clock.elapsedTime;
  });
  return <mesh ref={mesh} geometry={geometry} material={material} scale={1800} renderOrder={-10} frustumCulled={false} />;
}
