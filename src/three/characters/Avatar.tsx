"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarAppearance } from "@/types";
import { useDisposable } from "../architecture/primitives";
import { geo } from "../architecture/shared";
import { getLibrary } from "../materials/library";

/**
 * Procedural articulated avatar (placeholder until licensed rigged GLB characters are
 * supplied). A joint hierarchy (hips â†’ torso â†’ shoulders/elbows, hips â†’ knees) is posed
 * every frame from a blended gait: idle breathing/weight shift â†” walk â†” run, turn lean,
 * an interaction reach and a riding stance. Targets are damped so nothing ever snaps.
 */

export interface AvatarMotion {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Planar speed in m/s. */
  speed: number;
  mode: "walk" | "escalator" | "elevator";
  /** Seconds timestamp of the last interaction gesture. */
  gestureAt: number;
}

const BODY = {
  slim: { shoulder: 0.36, hip: 0.29, chest: 0.17, limb: 0.92 },
  regular: { shoulder: 0.41, hip: 0.32, chest: 0.2, limb: 1 },
  broad: { shoulder: 0.47, hip: 0.35, chest: 0.23, limb: 1.1 },
} as const;

function useAvatarMaterials(a: AvatarAppearance) {
  const m = getLibrary();
  const mats = useDisposable(() => {
    const make = (roughness: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ roughness, map: map ?? null });
    const set = {
      skin: make(0.65),
      hair: make(0.85),
      top: make(0.9, m.textures.fabric),
      bottom: make(0.9, m.textures.fabric),
      shoes: make(0.55),
      accent: make(0.4),
      dispose() {
        [set.skin, set.hair, set.top, set.bottom, set.shoes, set.accent].forEach((x) => x.dispose());
      },
    };
    return set;
  });
  useLayoutEffect(() => {
    mats.skin.color.set(a.skin);
    mats.hair.color.set(a.hairColor);
    mats.top.color.set(a.topColor);
    mats.bottom.color.set(a.bottomColor);
    mats.shoes.color.set(a.shoeColor);
    mats.accent.color.set("#1d1c1a");
  }, [mats, a.skin, a.hairColor, a.topColor, a.bottomColor, a.shoeColor]);
  return mats;
}

function Hair({ style, material, r }: { style: AvatarAppearance["hair"]; material: THREE.Material; r: number }) {
  const cap = useDisposable(() => new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const back = useDisposable(() => new THREE.CylinderGeometry(1, 0.9, 1, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76));
  const capTilt: [number, number, number] = [-0.32, 0, 0];
  switch (style) {
    case "buzz":
      return <mesh geometry={cap} material={material} scale={r * 1.02} rotation={capTilt} />;
    case "short":
      return <mesh geometry={cap} material={material} scale={[r * 1.08, r * 1.12, r * 1.1]} position={[0, r * 0.04, -r * 0.02]} rotation={capTilt} castShadow />;
    case "bun":
      return (
        <group>
          <mesh geometry={cap} material={material} scale={r * 1.06} rotation={capTilt} />
          <mesh geometry={geo.sphere(14)} material={material} position={[0, r * 0.85, -r * 0.75]} scale={r * 0.42} castShadow />
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh geometry={cap} material={material} scale={[r * 1.12, r * 1.12, r * 1.14]} rotation={capTilt} castShadow />
          <mesh geometry={back} material={material} position={[0, -r * 0.25, 0]} scale={[r * 1.12, r * 0.9, r * 1.12]} />
        </group>
      );
    case "long":
      return (
        <group>
          <mesh geometry={cap} material={material} scale={[r * 1.1, r * 1.1, r * 1.12]} rotation={capTilt} castShadow />
          <mesh geometry={back} material={material} position={[0, -r * 0.9, 0]} scale={[r * 1.08, r * 2.4, r * 1.08]} />
        </group>
      );
    case "curly":
      return (
        <group>
          {Array.from({ length: 11 }, (_, i) => {
            const a = (i / 11) * Math.PI * 2;
            const ring = i % 2 ? 0.55 : 0.8;
            return (
              <mesh
                key={i}
                geometry={geo.sphere(10)}
                material={material}
                position={[Math.cos(a) * r * ring, r * (0.55 + (i % 3) * 0.12), Math.sin(a) * r * ring - r * 0.15]}
                scale={r * 0.42}
                castShadow
              />
            );
          })}
        </group>
      );
  }
}

export function Avatar({
  appearance,
  motion,
  hidden = false,
}: {
  appearance: AvatarAppearance;
  /** Read every frame; mutate the object rather than re-rendering. */
  motion: AvatarMotion;
  /** Hide the body (first-person view) while keeping animation state. */
  hidden?: boolean;
}) {
  const mats = useAvatarMaterials(appearance);
  const body = BODY[appearance.body];
  const h = appearance.height;
  const legLen = 0.86 * h;
  const thighLen = legLen * 0.5;
  const shinLen = legLen * 0.48;
  const torsoLen = 0.52 * h;
  const armUpper = 0.29 * h;
  const armLower = 0.26 * h;
  const headR = 0.105 * h;
  const limbR = 0.052 * body.limb;

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const elbows = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const anim = useRef({ phase: 0, walk: 0, run: 0, lean: 0, roll: 0, lastYaw: motion.yaw, ride: 0, reach: 0 });

  const sleeves = appearance.top === "jacket" || appearance.top === "hoodie";
  const dress = appearance.top === "dress";

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const a = anim.current;
    const g = root.current;
    if (!g) return;
    g.position.set(motion.x, motion.y, motion.z);
    // The body is modelled facing +Z, while yaw 0 means travelling toward -Z (camera/movement
    // convention), so turn it half a revolution to face where it walks.
    g.rotation.y = motion.yaw + Math.PI;
    g.visible = !hidden;

    const riding = motion.mode !== "walk";
    const speed = riding ? 0 : motion.speed;
    a.walk = THREE.MathUtils.damp(a.walk, Math.min(1, speed / 1.4), 8, dt);
    a.run = THREE.MathUtils.damp(a.run, THREE.MathUtils.clamp((speed - 3) / 1.8, 0, 1), 6, dt);
    a.ride = THREE.MathUtils.damp(a.ride, riding ? 1 : 0, 5, dt);
    // Stride cycle advances with distance travelled (no foot sliding at any speed).
    const stride = THREE.MathUtils.lerp(1.3, 2.3, a.run);
    a.phase += (speed / stride) * Math.PI * 2 * dt;
    // Lean into turns, proportional to angular velocity and speed.
    let dYaw = motion.yaw - a.lastYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    a.lastYaw = motion.yaw;
    a.roll = THREE.MathUtils.damp(a.roll, THREE.MathUtils.clamp((-dYaw / Math.max(dt, 1e-3)) * speed * 0.03, -0.18, 0.18), 6, dt);
    a.lean = THREE.MathUtils.damp(a.lean, 0.05 * a.walk + 0.16 * a.run, 6, dt);
    const sinceGesture = performance.now() / 1000 - motion.gestureAt;
    a.reach = THREE.MathUtils.damp(a.reach, sinceGesture >= 0 && sinceGesture < 0.9 ? 1 : 0, 9, dt);

    const t = state.clock.elapsedTime;
    const p = a.phase;
    const idle = 1 - a.walk;
    const swing = 0.5 * a.walk + 0.32 * a.run;
    const armSwing = 0.42 * a.walk + 0.55 * a.run;

    if (hips.current) {
      const bob = Math.abs(Math.sin(p)) * (0.03 * a.walk + 0.05 * a.run);
      hips.current.position.y = legLen - 0.02 * a.run + bob - 0.012 * idle * (0.5 + 0.5 * Math.sin(t * 0.7));
      hips.current.position.x = Math.sin(t * 0.7) * 0.012 * idle;
      hips.current.rotation.y = Math.sin(p) * 0.12 * a.walk;
      hips.current.rotation.z = a.roll;
    }
    if (torso.current) {
      torso.current.rotation.x = a.lean;
      torso.current.rotation.y = -Math.sin(p) * 0.18 * a.walk;
      torso.current.scale.y = 1 + Math.sin(t * 1.7) * 0.008 * idle;
    }
    if (head.current) head.current.rotation.x = -a.lean * 0.6;

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const s = Math.sin(p + (i ? Math.PI : 0));
      const leg = legs.current[i];
      const knee = knees.current[i];
      if (leg) leg.rotation.x = s * swing;
      if (knee) knee.rotation.x = Math.max(0, -Math.sin(p + (i ? Math.PI : 0) + 0.9)) * (0.75 * a.walk + 0.7 * a.run) + 0.04;
      const arm = arms.current[i];
      const elbow = elbows.current[i];
      if (arm) {
        // Right arm (i === 1) performs the interaction reach.
        const reach = i === 1 ? a.reach : 0;
        arm.rotation.x = -s * armSwing * (1 - reach) - reach * 1.25 + a.ride * (i === 1 ? -0.25 : 0);
        arm.rotation.z = side * (0.08 + 0.05 * idle + a.ride * 0.12) - reach * 0.15 * side;
      }
      if (elbow) elbow.rotation.x = -(0.15 + 0.35 * a.walk + 0.85 * a.run) * (1 - (i === 1 ? a.reach : 0)) - (i === 1 ? a.reach * 0.2 : 0);
    }
  });

  const shoulderY = torsoLen * 0.92;
  return (
    <group ref={root}>
      {/* Contact shadow */}
      <mesh geometry={geo.flat()} material={getLibrary().blobShadow} position={[0, 0.01, 0]} scale={[0.9, 1, 0.9]} renderOrder={1} />
      <group ref={hips} position={[0, legLen, 0]}>
        {/* Pelvis */}
        <mesh geometry={geo.sphere(16)} material={mats.bottom} scale={[body.hip * 0.6, 0.11, body.chest * 0.78]} castShadow />
        {dress && (
          <mesh geometry={geo.cyl(24)} material={mats.top} position={[0, -legLen * 0.62, 0]} scale={[body.hip * 0.62, legLen * 0.66, body.chest * 0.95]} castShadow />
        )}
        {/* Legs */}
        {[0, 1].map((i) => (
          <group
            key={i}
            ref={(el) => {
              legs.current[i] = el;
            }}
            position={[(i === 0 ? 1 : -1) * body.hip * 0.33, -0.04, 0]}
          >
            <mesh geometry={geo.capsule()} material={mats.bottom} position={[0, -thighLen / 2, 0]} scale={[limbR * 2.3, thighLen / 2, limbR * 2.3]} castShadow />
            <group
              ref={(el) => {
                knees.current[i] = el;
              }}
              position={[0, -thighLen, 0]}
            >
              <mesh geometry={geo.capsule()} material={dress ? mats.skin : mats.bottom} position={[0, -shinLen / 2, 0]} scale={[limbR * 1.9, shinLen / 2, limbR * 1.9]} castShadow />
              <mesh geometry={geo.boxBase()} material={mats.shoes} position={[0, -shinLen - 0.045, 0.045]} scale={[0.1, 0.075, 0.26]} castShadow />
            </group>
          </group>
        ))}
        {/* Torso */}
        <group ref={torso} position={[0, 0.06, 0]}>
          <mesh geometry={geo.capsule()} material={mats.top} position={[0, torsoLen * 0.5, 0]} scale={[body.shoulder * 1.05, torsoLen * 0.42, body.chest * 1.4]} castShadow />
          {appearance.top === "hoodie" && (
            <mesh geometry={geo.torus(0.25, 32)} material={mats.top} position={[0, torsoLen * 0.92, -0.04]} rotation={[0.3, 0, 0]} scale={[0.13, 0.13, 0.1]} />
          )}
          {appearance.top === "jacket" && (
            <mesh geometry={geo.box()} material={mats.accent} position={[0, torsoLen * 0.55, body.chest * 0.7 + 0.003]} scale={[0.012, torsoLen * 0.7, 0.01]} />
          )}
          {appearance.accessory === "backpack" && (
            <mesh geometry={geo.boxBase()} material={mats.accent} position={[0, torsoLen * 0.25, -body.chest * 0.7 - 0.08]} scale={[body.shoulder * 0.9, torsoLen * 0.6, 0.16]} castShadow />
          )}
          {/* Neck + head */}
          <mesh geometry={geo.cyl(12)} material={mats.skin} position={[0, torsoLen * 0.92, 0]} scale={[0.045, 0.09, 0.045]} />
          <group ref={head} position={[0, torsoLen + headR * 0.95, 0]}>
            <mesh geometry={geo.sphere(20)} material={mats.skin} scale={[headR * 0.92, headR * 1.08, headR]} castShadow />
            <Hair style={appearance.hair} material={mats.hair} r={headR} />
            {appearance.accessory === "glasses" && (
              <group position={[0, headR * 0.1, headR * 0.92]}>
                {[-1, 1].map((s) => (
                  <mesh key={s} geometry={geo.torus(0.12, 24)} material={mats.accent} position={[s * headR * 0.38, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={headR * 0.3} />
                ))}
              </group>
            )}
            {appearance.accessory === "cap" && (
              <group position={[0, headR * 0.35, 0]} rotation={[-0.25, 0, 0]}>
                <mesh geometry={geo.sphere(16)} material={mats.top} scale={[headR * 1.1, headR * 0.65, headR * 1.12]} />
                <mesh geometry={geo.box()} material={mats.top} position={[0, -headR * 0.05, headR * 1.05]} scale={[headR * 1.5, 0.012, headR * 0.9]} />
              </group>
            )}
          </group>
          {/* Arms */}
          {[0, 1].map((i) => {
            const side = i === 0 ? 1 : -1;
            const upperMat = sleeves || appearance.top === "tee" ? mats.top : mats.skin;
            return (
              <group
                key={i}
                ref={(el) => {
                  arms.current[i] = el;
                }}
                position={[side * (body.shoulder * 0.53 + 0.035), shoulderY, 0]}
              >
                <mesh geometry={geo.capsule()} material={upperMat} position={[0, -armUpper / 2, 0]} scale={[limbR * 1.9, armUpper / 2, limbR * 1.9]} castShadow />
                <group
                  ref={(el) => {
                    elbows.current[i] = el;
                  }}
                  position={[0, -armUpper, 0]}
                >
                  <mesh geometry={geo.capsule()} material={sleeves ? mats.top : mats.skin} position={[0, -armLower / 2, 0]} scale={[limbR * 1.6, armLower / 2, limbR * 1.6]} castShadow />
                  <mesh geometry={geo.sphere(12)} material={mats.skin} position={[0, -armLower - 0.03, 0]} scale={[0.04, 0.055, 0.03]} />
                  {appearance.accessory === "tote" && i === 0 && (
                    <group position={[0, -armLower - 0.12, 0]}>
                      <mesh geometry={geo.boxBase()} material={mats.bottom} position={[0, -0.22, 0]} scale={[0.07, 0.3, 0.32]} castShadow />
                      <mesh geometry={geo.torus(0.06, 24)} material={mats.accent} position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.1} />
                    </group>
                  )}
                </group>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** Stand-alone preview motion: slow idle turn used by the avatar picker. */
export function useTurntableMotion(): AvatarMotion {
  return useMemo(() => ({ x: 0, y: 0, z: 0, yaw: 0, speed: 0, mode: "walk", gestureAt: -10 }), []);
}
