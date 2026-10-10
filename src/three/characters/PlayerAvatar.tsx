"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { player } from "@/lib/runtime";
import { useAvatarStore } from "@/stores/useAvatarStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { Avatar, type AvatarMotion } from "./Avatar";

/** Where the avatar stands on the plaza while it is being customised (in front of the entrance). */
export const AVATAR_STAGE = { x: 9, z: 64 };

/** Preview turntable state, driven by the avatar picker (drag to rotate). */
export const avatarPreview = { yaw: 0.5, dragging: false };

/**
 * The visitor's own avatar. In the picker it stands on the plaza on a turntable; in the
 * mall it is driven directly by the `player` runtime (same fields as AvatarMotion).
 */
export function PlayerAvatar() {
  const appearance = useAvatarStore((s) => s.appearance);
  const phase = useExperienceStore((s) => s.phase);
  const firstPerson = useSettingsStore((s) => s.cameraMode === "first");
  // Stable mutable object: the avatar reads it every frame, React never re-renders for it.
  const [preview] = useState<AvatarMotion>(() => ({ x: AVATAR_STAGE.x, y: 0, z: AVATAR_STAGE.z, yaw: 0, speed: 0, mode: "walk", gestureAt: -10 }));
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (phase === "avatar" && !avatarPreview.dragging) avatarPreview.yaw += Math.min(dt, 0.1) * 0.35;
    // +π so the picker still opens with the avatar facing the camera.
    preview.yaw = avatarPreview.yaw + Math.PI;
  });

  if (phase === "loading" || phase === "intro") return null;
  if (phase === "avatar") return <Avatar appearance={appearance} motion={preview} />;
  return (
    <group ref={group}>
      <Avatar appearance={appearance} motion={player} hidden={firstPerson && phase === "explore"} />
    </group>
  );
}
