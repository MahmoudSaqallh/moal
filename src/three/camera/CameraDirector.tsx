"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { ATRIUM_VOID, CAMERA_SPACE, DIMENSIONS, WING_VOIDS } from "@/data/layout";
import { CEILING_HEIGHT, FLOOR_HEIGHT, ROOF_HEIGHT, floorY } from "@/data/floors";
import type { Rect } from "@/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { getPlacement } from "@/data/navigation";
import { getProduct } from "@/data/products";
import { player, inspectView, resetInspectView } from "@/lib/runtime";
import { prefersReducedMotion } from "@/lib/motion";
import { ATRIUM_START, teleport } from "@/features/exploration/actions";
import { PRODUCT_META } from "@/data/productMeta";
import { AVATAR_STAGE } from "../characters/PlayerAvatar";

/**
 * Camera choreography, separated from character movement:
 *  - intro:    a slow establishing dolly towards the exterior (GSAP).
 *  - entering: a single eased spline through the entrance into the atrium (GSAP).
 *  - explore:  a spring-arm third-person rig that avoids walls and ceilings (or a first-person eye).
 *  - inspect:  an eased hand-off to a product close-up, with orbit for floor pieces.
 * Timelines are created once per phase change and killed on exit.
 */

// GSAP's default lag smoothing advances only 33 ms after a >500 ms frame, so on slow GPUs the
// 9 s establishing shot could take minutes. Allow larger catch-up steps; long tab pauses
// (>1 s) still advance just 250 ms so the camera never teleports.
gsap.ticker.lagSmoothing(1000, 250);

const EYE = DIMENSIONS.eyeHeight;
const FOV_EXPLORE = 60;
const FOV_INTRO = 44;
const FOV_INSPECT = 42;
/** Height of the third-person look target above the avatar's feet. */
const TARGET_H = 1.5;
/** Aim above the head so the avatar sits in the lower third and the mall fills the frame. */
const LOOK_LIFT = 0.55;

// Establishing shot: from high over the plaza down to a three-quarter view of the
// entrance canopy, pool on the left and planter on the right (exterior reference framing).
const INTRO_FROM = { pos: new THREE.Vector3(-62, 48, 178), look: new THREE.Vector3(-4, 6, 34) };
const INTRO_TO = { pos: new THREE.Vector3(31, 4.6, 86), look: new THREE.Vector3(-7, 8.6, 33) };

// The flight ends exactly where the third-person rig starts, behind the avatar.
const START_PITCH = 0.24;
const START_DIST = 5.4;
const END_POS = new THREE.Vector3(
  ATRIUM_START.x,
  TARGET_H + Math.sin(START_PITCH) * START_DIST,
  ATRIUM_START.z + Math.cos(START_PITCH) * START_DIST,
);
const END_LOOK = new THREE.Vector3(ATRIUM_START.x, TARGET_H + LOOK_LIFT, ATRIUM_START.z);

const ENTRY_POS = new THREE.CatmullRomCurve3(
  [INTRO_TO.pos.clone(), new THREE.Vector3(10, 3.8, 63), new THREE.Vector3(2, 2.6, 47), new THREE.Vector3(0, 2.2, 36.5), new THREE.Vector3(0, 2.3, 26), END_POS],
  false,
  "centripetal",
);
const ENTRY_LOOK = new THREE.CatmullRomCurve3(
  [INTRO_TO.look.clone(), new THREE.Vector3(0, 6, 34), new THREE.Vector3(0, 2.6, 30), new THREE.Vector3(0, 2.0, 18), END_LOOK],
  false,
  "centripetal",
);

/** Mutable camera rig that tweens write into. */
const rig = {
  pos: new THREE.Vector3().copy(INTRO_FROM.pos),
  look: new THREE.Vector3().copy(INTRO_FROM.look),
  fov: FOV_INTRO,
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

const OPEN_ABOVE: Rect[] = [ATRIUM_VOID, ...WING_VOIDS];
function inRects(rects: readonly Rect[], x: number, z: number, margin: number) {
  for (const r of rects) if (x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin) return true;
  return false;
}

/**
 * Point keeps `margin` clearance inside the union of rects. Shrinking each rect separately
 * would reject the seams between adjacent rects and collapse the boom for no reason.
 */
function inSpace(rects: readonly Rect[], x: number, z: number, margin: number) {
  return (
    inRects(rects, x, z, 0) &&
    inRects(rects, x + margin, z, 0) &&
    inRects(rects, x - margin, z, 0) &&
    inRects(rects, x, z + margin, 0) &&
    inRects(rects, x, z - margin, 0)
  );
}

/** Longest clear boom from the target along `dir` (stays in open space, under ceilings). */
function clearBoom(target: THREE.Vector3, dir: THREE.Vector3, desired: number): number {
  const floor = player.floor;
  const base = floorY(floor);
  const space = CAMERA_SPACE[floor] ?? CAMERA_SPACE[0];
  let clear = 0.4;
  for (let t = 0.4; t <= desired + 1e-3; t += 0.2) {
    const x = target.x + dir.x * t;
    const y = target.y + dir.y * t;
    const z = target.z + dir.z * t;
    const open = inRects(OPEN_ABOVE, x, z, 0);
    const ceiling = open ? ROOF_HEIGHT - 0.5 : base + CEILING_HEIGHT - 0.3;
    const floorLimit = open && floor > 0 ? base - FLOOR_HEIGHT + 0.5 : base + 0.25;
    if (y > ceiling || y < floorLimit) break;
    if (!open && !inSpace(space, x, z, 0.18)) break;
    clear = t;
  }
  return clear;
}

/** Explore-mode camera pose: spring-arm third person, or first-person eye. */
function explorePose(outPos: THREE.Vector3, outLook: THREE.Vector3, boom: { d: number }, dt: number) {
  const first = useSettingsStore.getState().cameraMode === "first";
  if (first) {
    outPos.set(player.x, player.y + EYE, player.z);
    const cp = Math.cos(player.camPitch);
    outLook.set(player.x - Math.sin(player.camYaw) * cp * 3, player.y + EYE + Math.sin(player.camPitch) * 3, player.z - Math.cos(player.camYaw) * cp * 3);
    return;
  }
  const target = outLook.set(player.x, player.y + TARGET_H, player.z);
  const cp = Math.cos(player.camPitch);
  tmpDir.set(Math.sin(player.camYaw) * cp, Math.sin(player.camPitch), Math.cos(player.camYaw) * cp);
  const allowed = clearBoom(target, tmpDir, player.camDistance);
  // Retract quickly when something gets in the way, extend gently afterwards.
  boom.d = THREE.MathUtils.damp(boom.d, allowed, allowed < boom.d ? 18 : 3, dt);
  boom.d = Math.min(boom.d, allowed + 0.05);
  outPos.copy(target).addScaledVector(tmpDir, boom.d);
  // Scale the lift with the boom: a retracted camera must not end up staring at the ceiling.
  target.y += LOOK_LIFT * Math.min(1, boom.d / START_DIST);
}
/** Close-up pose for the selected product (with the visitor's orbit applied). */
function inspectPose(productId: string, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const placement = getPlacement(productId);
  const product = getProduct(productId);
  if (!placement || !product) return false;
  const meta = PRODUCT_META[product.kind];
  const center = outLook.set(placement.position.x, floorY(placement.floor) + placement.y + meta.height * 0.5 + (meta.turntable ? 0.04 : 0), placement.position.z);
  // Floor pieces are orbited (limited so the camera never swings into walls); small goods turn instead.
  const orbit = meta.turntable ? 0 : THREE.MathUtils.clamp(inspectView.yaw * 0.6, -0.8, 0.8);
  const yaw = placement.viewYaw + orbit;
  const dist = placement.viewDistance * inspectView.zoom;
  const elev = 0.22 + inspectView.pitch * 0.6;
  outPos.set(
    center.x + Math.sin(yaw) * dist * Math.cos(elev),
    center.y + Math.sin(elev) * dist + (meta.turntable ? 0 : 0.15),
    center.z + Math.cos(yaw) * dist * Math.cos(elev),
  );
  return true;
}

export function CameraDirector() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const phase = useExperienceStore((s) => s.phase);
  const introRun = useExperienceStore((s) => s.introRun);
  const selectedProductId = useExperienceStore((s) => s.selectedProductId);
  const tween = useRef<gsap.core.Animation | null>(null);
  /** 0 = follow player, 1 = full inspect pose. */
  const inspectBlend = useRef({ t: 0 });
  const lastInspected = useRef<string | null>(null);
  const boom = useRef({ d: START_DIST });

  // â”€â”€ Intro establishing shot â”€â”€
  useEffect(() => {
    if (phase !== "intro") return;
    tween.current?.kill();
    const { setIntroSettled } = useExperienceStore.getState();
    rig.fov = FOV_INTRO;
    if (prefersReducedMotion()) {
      rig.pos.copy(INTRO_TO.pos);
      rig.look.copy(INTRO_TO.look);
      setIntroSettled(true);
      return;
    }
    rig.pos.copy(INTRO_FROM.pos);
    rig.look.copy(INTRO_FROM.look);
    const tl = gsap.timeline({ onComplete: () => setIntroSettled(true) });
    tl.to(rig.pos, { x: INTRO_TO.pos.x, y: INTRO_TO.pos.y, z: INTRO_TO.pos.z, duration: 9, ease: "sine.inOut" }, 0);
    tl.to(rig.look, { x: INTRO_TO.look.x, y: INTRO_TO.look.y, z: INTRO_TO.look.z, duration: 9, ease: "sine.inOut" }, 0);
    // Reveal the UI a little before the camera fully lands.
    tl.call(() => setIntroSettled(true), [], 6.5);
    tween.current = tl;
    return () => {
      tl.kill();
    };
  }, [phase, introRun]);

  // â”€â”€ Avatar picker: frame the avatar on the plaza, offset left of the side panel â”€â”€
  useEffect(() => {
    if (phase !== "avatar") return;
    tween.current?.kill();
    // Desktop: avatar left of the side panel. Phones: the picker is a bottom sheet over ~60% of
    // the screen, so pull back and aim low to stand the avatar in the visible top band.
    const narrow = window.innerWidth < 768;
    const to = narrow ? { x: AVATAR_STAGE.x, y: 1.4, z: AVATAR_STAGE.z + 8 } : { x: AVATAR_STAGE.x - 0.9, y: 1.55, z: AVATAR_STAGE.z + 3.6 };
    const look = narrow ? { x: AVATAR_STAGE.x, y: -1.0, z: AVATAR_STAGE.z } : { x: AVATAR_STAGE.x + 0.75, y: 1.0, z: AVATAR_STAGE.z };
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline();
    tl.to(rig.pos, { ...to, duration: reduced ? 0 : 1.6, ease: "power3.inOut" }, 0);
    tl.to(rig.look, { ...look, duration: reduced ? 0 : 1.6, ease: "power3.inOut" }, 0);
    tl.to(rig, { fov: narrow ? 50 : 40, duration: reduced ? 0 : 1.6, ease: "sine.inOut" }, 0);
    tween.current = tl;
    return () => {
      tl.kill();
    };
  }, [phase]);

  // â”€â”€ Fly through the entrance â”€â”€
  useEffect(() => {
    if (phase !== "entering") return;
    tween.current?.kill();
    // The avatar is already waiting in the atrium as the camera arrives behind it.
    teleport(ATRIUM_START, 0, ATRIUM_START.yaw);
    const finish = () => {
      teleport(ATRIUM_START, 0, ATRIUM_START.yaw);
      player.camPitch = START_PITCH;
      player.camDistance = START_DIST;
      boom.current.d = START_DIST;
      useExperienceStore.getState().setPhase("explore");
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    // Start the spline from wherever the intro camera currently is (including idle sway).
    ENTRY_POS.points[0].copy(camera.position);
    ENTRY_LOOK.points[0].copy(rig.look);
    ENTRY_POS.updateArcLengths();
    ENTRY_LOOK.updateArcLengths();
    const progress = { t: 0 };
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(progress, {
      t: 1,
      duration: 7,
      ease: "power2.inOut",
      onUpdate: () => {
        ENTRY_POS.getPointAt(progress.t, rig.pos);
        ENTRY_LOOK.getPointAt(progress.t, rig.look);
      },
    });
    tl.to(rig, { fov: FOV_EXPLORE, duration: 4.5, ease: "sine.inOut" }, 2.2);
    tween.current = tl;
    return () => {
      tl.kill();
    };
  }, [phase, camera]);

  // â”€â”€ Product focus in / out â”€â”€
  useEffect(() => {
    if (phase !== "inspect") return;
    const reduced = prefersReducedMotion();
    if (selectedProductId) {
      lastInspected.current = selectedProductId;
      resetInspectView();
      tween.current?.kill();
      tween.current = gsap.to(inspectBlend.current, { t: 1, duration: reduced ? 0 : 1.1, ease: "power3.inOut" });
    } else {
      tween.current?.kill();
      tween.current = gsap.to(inspectBlend.current, {
        t: 0,
        duration: reduced ? 0 : 0.85,
        ease: "power2.inOut",
        onComplete: () => {
          lastInspected.current = null;
          useExperienceStore.getState().setPhase("explore");
        },
      });
    }
  }, [phase, selectedProductId]);

  useEffect(() => () => void tween.current?.kill(), []);

  useFrame((state, dt) => {
    if (phase === "intro" || phase === "entering" || phase === "loading" || phase === "avatar") {
      camera.position.copy(rig.pos);
      // A breath of movement once the establishing shot has landed keeps the frame alive.
      if (phase === "intro" && useExperienceStore.getState().introSettled && !prefersReducedMotion()) {
        const t = state.clock.elapsedTime;
        camera.position.x += Math.sin(t * 0.15) * 0.8;
        camera.position.y += Math.sin(t * 0.11) * 0.25;
      }
      camera.lookAt(rig.look);
    } else if (phase === "inspect" || inspectBlend.current.t > 0) {
      const id = lastInspected.current;
      // Idle turntable for small goods until the visitor takes over.
      if (!inspectView.dragging && performance.now() - inspectView.lastInteraction > 2500 && !prefersReducedMotion()) {
        const product = id ? getProduct(id) : undefined;
        if (product && PRODUCT_META[product.kind].turntable && useExperienceStore.getState().selectedProductId) {
          inspectView.yaw += dt * 0.35;
        }
      }
      explorePose(tmpA, tmpB, boom.current, dt);
      if (id && inspectPose(id, rig.pos, tmpC)) {
        const k = inspectBlend.current.t;
        camera.position.lerpVectors(tmpA, rig.pos, k);
        rig.look.lerpVectors(tmpB, tmpC, k);
        camera.lookAt(rig.look);
        rig.fov = THREE.MathUtils.lerp(FOV_EXPLORE, FOV_INSPECT, k);
      }
    } else {
      // Explore: spring-arm third person (or first-person eye).
      explorePose(tmpA, tmpB, boom.current, Math.min(dt, 0.1));
      camera.position.copy(tmpA);
      camera.lookAt(tmpB);
      rig.fov = FOV_EXPLORE;
    }
    if (Math.abs(camera.fov - rig.fov) > 0.01) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
