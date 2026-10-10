"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { LightingMode, QualityPreset } from "@/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { prefersReducedMotion } from "@/lib/motion";
import { getLibrary } from "../materials/library";
import { SkyDome, skyUniforms } from "./SkyDome";

/** Late-afternoon sun from the south-west, matching the exterior reference's warm light. */
export const SUN_DIRECTION = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();

interface Preset {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sun: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemi: number;
  env: number;
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  skySun: THREE.Color;
  fog: THREE.Color;
  night: number;
  clouds: number;
  /** Multiplier on every lamp, cove, screen and shop window. */
  glow: number;
  /** Multiplier on the baked light pools. */
  pools: number;
}

const c = (hex: string) => new THREE.Color(hex);
const PRESETS: Record<LightingMode, Preset> = {
  day: {
    sunDir: SUN_DIRECTION.clone(),
    sunColor: c("#ffe8c8"),
    sun: 2.6,
    hemiSky: c("#fff4e4"),
    hemiGround: c("#cbbca5"),
    hemi: 0.55,
    env: 0.85,
    zenith: c("#3f78c6"),
    mid: c("#8fb6e2"),
    horizon: c("#efe2cf"),
    skySun: c("#ffd9a6"),
    fog: c("#ece2d2"),
    night: 0,
    clouds: 1,
    glow: 1,
    pools: 1,
  },
  evening: {
    sunDir: new THREE.Vector3(-0.78, 0.16, 0.6).normalize(),
    sunColor: c("#ffad6b"),
    sun: 1.7,
    hemiSky: c("#ffd2a8"),
    hemiGround: c("#9e8873"),
    hemi: 0.42,
    env: 0.62,
    zenith: c("#2b3a70"),
    mid: c("#9b7fa6"),
    horizon: c("#f4a266"),
    skySun: c("#ff9448"),
    fog: c("#d9a283"),
    night: 0.15,
    clouds: 0.8,
    glow: 1.35,
    pools: 1.35,
  },
  night: {
    sunDir: new THREE.Vector3(0.35, 0.55, -0.55).normalize(),
    sunColor: c("#a9bde8"),
    sun: 0.32,
    hemiSky: c("#8a9fd0"),
    hemiGround: c("#2c2722"),
    hemi: 0.2,
    env: 0.38,
    zenith: c("#060a1a"),
    mid: c("#0f1834"),
    horizon: c("#28304b"),
    skySun: c("#c6d4ff"),
    fog: c("#141a28"),
    night: 1,
    clouds: 0.45,
    glow: 1.8,
    pools: 1.9,
  },
};

/** Current blended values (mutated each frame while a transition runs). */
function clonePreset(p: Preset): Preset {
  return {
    ...p,
    sunDir: p.sunDir.clone(),
    sunColor: p.sunColor.clone(),
    hemiSky: p.hemiSky.clone(),
    hemiGround: p.hemiGround.clone(),
    zenith: p.zenith.clone(),
    mid: p.mid.clone(),
    horizon: p.horizon.clone(),
    skySun: p.skySun.clone(),
    fog: p.fog.clone(),
  };
}

/** Light-emitting library materials and their base colours, so modes can scale them. */
function glowTargets() {
  const m = getLibrary();
  const fixtures = [m.lightWarm, m.lightNeutral, m.lightCool, m.lightBlue, m.lightAmber, m.frostedLight, m.shopGlow];
  const pools = [m.lightPool, m.lightPoolCool];
  const base = new Map<THREE.MeshBasicMaterial, THREE.Color>();
  for (const mat of [...fixtures, ...pools]) {
    const b = mat.userData.baseColor as THREE.Color | undefined;
    base.set(mat, b ?? mat.color.clone());
    mat.userData.baseColor = base.get(mat);
  }
  return { fixtures, pools, base };
}

/**
 * Lighting strategy (performance-first):
 *  - A procedural environment map (Lightformers rendered once) supplies soft ambient light
 *    and every reflection on marble, glass and metal. No HDR file is downloaded.
 *  - One directional sun/moon. The mall is static, so its shadow map is re-rendered only
 *    while the light moves (mode transitions) and frozen otherwise.
 *  - Lamps, coves, screens and shop windows are emissive geometry plus baked light pools;
 *    lighting modes scale them instead of adding real-time lights.
 */
export function Lighting({ quality }: { quality: QualityPreset }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const shadows = quality !== "low";
  const mapSize = quality === "high" ? 4096 : 2048;
  const mode = useSettingsStore((s) => s.lighting);
  const current = useRef<Preset>(clonePreset(PRESETS[useSettingsStore.getState().lighting]));
  const transition = useRef(0);
  const glows = useMemo(() => glowTargets(), []);

  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(-8, 0, 0);
    return o;
  }, []);

  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.target = target;
    const cam = light.shadow.camera;
    cam.left = -95;
    cam.right = 95;
    cam.top = 75;
    cam.bottom = -75;
    cam.near = 10;
    cam.far = 340;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.04;
  }, [target]);

  // Render the shadow map live for the first frames (so it always exists when sampled),
  // then freeze it: the architecture never moves, so re-rendering it every frame is waste.
  useEffect(() => {
    gl.shadowMap.enabled = shadows;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.autoUpdate = true;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      invalidate();
      if (++frames < 8) raf = requestAnimationFrame(tick);
      else gl.shadowMap.autoUpdate = false;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, invalidate, shadows, mapSize]);

  // A new mode starts a ~1.6 s blend (instant under reduced motion).
  useEffect(() => {
    transition.current = prefersReducedMotion() ? 0.0001 : 1;
  }, [mode]);

  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const goal = PRESETS[mode];
    const cur = current.current;
    const blending = transition.current > 0;
    if (blending) {
      const k = transition.current < 0.001 ? 1 : 1 - Math.exp(-3 * dt);
      cur.sunDir.lerp(goal.sunDir, k).normalize();
      for (const key of ["sunColor", "hemiSky", "hemiGround", "zenith", "mid", "horizon", "skySun", "fog"] as const) cur[key].lerp(goal[key], k);
      for (const key of ["sun", "hemi", "env", "night", "clouds", "glow", "pools"] as const) cur[key] += (goal[key] - cur[key]) * k;
      transition.current = Math.abs(cur.glow - goal.glow) < 0.002 && cur.sunDir.distanceTo(goal.sunDir) < 0.002 ? 0 : transition.current;
      // Re-render shadows while the light moves; freeze again once settled.
      if (shadows) gl.shadowMap.needsUpdate = true;
    }

    const light = sun.current;
    if (light) {
      light.position.copy(tmpPos.copy(cur.sunDir).multiplyScalar(170)).add(target.position);
      light.color.copy(cur.sunColor);
      light.intensity = cur.sun;
    }
    if (hemi.current) {
      hemi.current.color.copy(cur.hemiSky);
      hemi.current.groundColor.copy(cur.hemiGround);
      hemi.current.intensity = cur.hemi;
    }
    scene.environmentIntensity = cur.env;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(cur.fog);
    skyUniforms.uZenith.value.copy(cur.zenith);
    skyUniforms.uMid.value.copy(cur.mid);
    skyUniforms.uHorizon.value.copy(cur.horizon);
    skyUniforms.uSunColor.value.copy(cur.skySun);
    skyUniforms.uSunDir.value.copy(cur.sunDir);
    skyUniforms.uNight.value = cur.night;
    skyUniforms.uClouds.value = cur.clouds;
    if (blending || glows.fixtures[0].userData.appliedGlow !== cur.glow) {
      for (const mat of glows.fixtures) mat.color.copy(glows.base.get(mat)!).multiplyScalar(cur.glow);
      for (const mat of glows.pools) mat.color.copy(glows.base.get(mat)!).multiplyScalar(cur.pools);
      glows.fixtures[0].userData.appliedGlow = cur.glow;
    }
  });

  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#ece2d2", 300, 1600]} />
      <hemisphereLight ref={hemi} args={["#fff4e4", "#cbbca5", 0.55]} />
      <directionalLight
        ref={sun}
        intensity={2.6}
        color="#ffe8c8"
        castShadow={shadows}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
      />
      <primitive object={target} />
      {/* Rendered once, so the resolution costs nothing per frame; 128 px produced a mis-filtered
          PMREM on some software renderers that tinted glossy floors. */}
      <Environment resolution={256} frames={1} environmentIntensity={0.85}>
        <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={3.2} color="#eef4ff" position={[0, 10, -6]} rotation={[Math.PI / 2, 0, 0]} scale={[40, 2.5, 1]} />
        <Lightformer form="rect" intensity={3.2} color="#eef4ff" position={[0, 10, 6]} rotation={[Math.PI / 2, 0, 0]} scale={[40, 2.5, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffdcb0" position={[0, 2, -12]} scale={[40, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffdcb0" position={[0, 2, 12]} rotation={[0, Math.PI, 0]} scale={[40, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#f2f5fa" position={[-14, 3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[30, 5, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#f2f5fa" position={[14, 3, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[30, 5, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#d9c9b0" position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
      </Environment>
    </>
  );
}
