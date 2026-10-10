"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { QualityPreset } from "@/types";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { MallShell } from "../architecture/MallShell";
import { Fountain } from "../architecture/Fountain";
import { AtriumFeatures } from "../architecture/AtriumFeatures";
import { PublicSpaces } from "../architecture/PublicSpaces";
import { Exterior } from "../architecture/Exterior";
import { Stores } from "../stores/Stores";
import { Lighting } from "../lighting/Lighting";
import { CameraDirector } from "../camera/CameraDirector";
import { PlayerController } from "../controls/PlayerController";
import { InputBindings } from "../controls/InputBindings";
import { FocusSystem } from "../interactions/FocusSystem";
import { RouteLine } from "../interactions/RouteLine";
import { Escalators, GlassLift } from "../architecture/Transport";
import { PlayerAvatar } from "../characters/PlayerAvatar";
import { RemoteAvatars } from "../characters/RemoteAvatars";

/** The exterior only matters during the intro or when looking out through the entrance. */
function ExteriorZone({ detail }: { detail: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const phase = useExperienceStore.getState().phase;
    group.current.visible = phase === "intro" || phase === "entering" || phase === "loading" || state.camera.position.z > 9;
  });
  return (
    <group ref={group}>
      <Exterior detail={detail} />
    </group>
  );
}

export function MallWorld({ quality }: { quality: QualityPreset }) {
  const detail = quality === "low" ? 0.55 : quality === "medium" ? 0.8 : 1;
  return (
    <>
      <Lighting quality={quality} />
      <MallShell />
      <Fountain />
      <AtriumFeatures />
      <PublicSpaces />
      <Escalators />
      <GlassLift />
      <Stores />
      <PlayerAvatar />
      <RemoteAvatars />
      <ExteriorZone detail={detail} />
      <RouteLine />

      <InputBindings />
      <PlayerController />
      <CameraDirector />
      <FocusSystem />
    </>
  );
}
