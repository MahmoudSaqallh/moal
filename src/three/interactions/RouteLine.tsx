"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { geo } from "../architecture/shared";
import { prefersReducedMotion } from "@/lib/motion";
import { routePoints } from "@/lib/pathfinding";

/**
 * Wayfinding route drawn on the floor: a dashed line that flows towards the destination
 * plus a softly pulsing marker. Uses exactly the same points as the minimap route.
 */
export function RouteLine() {
  const route = useExperienceStore((s) => s.route);
  const lineRef = useRef<{ material: { dashOffset: number } } | null>(null);
  const marker = useRef<THREE.Mesh>(null);
  const points = useMemo(() => (route ? routePoints(route).map((p) => new THREE.Vector3(p.x, p.y + 0.05, p.z)) : []), [route]);
  const end = points[points.length - 1];
  const markerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#d8b47a").multiplyScalar(1.6), transparent: true, depthWrite: false }),
    [],
  );
  useLayoutEffect(() => () => markerMat.dispose(), [markerMat]);

  useFrame((state, dt) => {
    if (lineRef.current && !prefersReducedMotion()) lineRef.current.material.dashOffset -= dt * 1.2;
    if (marker.current) {
      const t = (state.clock.elapsedTime * 0.8) % 1;
      const s = prefersReducedMotion() ? 0.8 : 0.4 + t * 0.9;
      marker.current.scale.setScalar(s);
      markerMat.opacity = prefersReducedMotion() ? 0.8 : 1 - t;
    }
  });

  if (points.length < 2) return null;
  return (
    <group>
      <Line
        ref={lineRef as never}
        points={points}
        color="#d8b47a"
        lineWidth={5}
        dashed
        dashSize={0.6}
        gapSize={0.35}
        transparent
        opacity={0.95}
        depthWrite={false}
        renderOrder={5}
      />
      <mesh ref={marker} geometry={geo.torus(0.05, 48)} material={markerMat} position={[end.x, end.y, end.z]} renderOrder={5} />
    </group>
  );
}
