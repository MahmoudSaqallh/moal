"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { geo } from "../architecture/shared";
import { getLibrary } from "../materials/library";
import { paintText, paintWayfinding, type SignFont } from "../materials/signage";
import { toTexture } from "../materials/textures";

type Arrow = "left" | "right" | "up" | "down" | "none";

function useCanvasMaterial(make: () => HTMLCanvasElement, opts: { emissive?: number; transparent?: boolean }, deps: unknown[]) {
  const material = useMemo(() => {
    const tex = toTexture(make(), { repeat: false, anisotropy: 8 });
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: opts.transparent ?? false,
      color: new THREE.Color(1, 1, 1).multiplyScalar(opts.emissive ?? 1),
      depthWrite: !(opts.transparent ?? false),
    });
    // Generic helper: the caller supplies the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);
  useLayoutEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
  return material;
}

/** Double-sided hanging blade sign; each face has its own directions. */
export function WayfindingSign({
  position,
  rotY,
  front,
  back,
  width = 3.4,
  dropTo,
}: {
  position: [number, number, number];
  rotY: number;
  front: { text: string; arrow: Arrow }[];
  back: { text: string; arrow: Arrow }[];
  width?: number;
  /** Ceiling height the suspension rods reach up to. */
  dropTo: number;
}) {
  const m = getLibrary();
  const h = width / 4;
  const frontMat = useCanvasMaterial(() => paintWayfinding(front), { emissive: 1.1 }, [JSON.stringify(front)]);
  const backMat = useCanvasMaterial(() => paintWayfinding(back), { emissive: 1.1 }, [JSON.stringify(back)]);
  const rod = dropTo - position[1] - h / 2;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={geo.box()} material={m.blackMetal} scale={[width + 0.06, h + 0.06, 0.06]} />
      <mesh geometry={geo.plane()} material={frontMat} position={[0, 0, 0.032]} scale={[width, h, 1]} />
      <mesh geometry={geo.plane()} material={backMat} position={[0, 0, -0.032]} rotation={[0, Math.PI, 0]} scale={[width, h, 1]} />
      {rod > 0 &&
        [-width * 0.4, width * 0.4].map((x) => (
          <mesh key={x} geometry={geo.rod(6)} material={m.blackMetal} position={[x, h / 2 + rod / 2, 0]} scale={[0.012, rod, 0.012]} />
        ))}
    </group>
  );
}

/**
 * Dimensional lettering: the letters are a transparent texture on a plane; an optional
 * offset copy reads as the halo of backlit letters on the wall behind.
 */
export function TextSign({
  text,
  font,
  color,
  height,
  position,
  rotY = 0,
  weight,
  italic,
  uppercase,
  tracking,
  glow = 1,
  halo,
}: {
  text: string;
  font: SignFont;
  color: string;
  height: number;
  position: [number, number, number];
  rotY?: number;
  weight?: number;
  italic?: boolean;
  uppercase?: boolean;
  tracking?: number;
  glow?: number;
  halo?: string;
}) {
  const painted = useMemo(
    () => paintText(text, { font, color, weight, italic, uppercase, tracking, halo }),
    [text, font, color, weight, italic, uppercase, tracking, halo],
  );
  const material = useCanvasMaterial(() => painted.canvas, { emissive: glow, transparent: true }, [painted, glow]);
  return (
    <mesh
      geometry={geo.plane()}
      material={material}
      position={position}
      rotation={[0, rotY, 0]}
      scale={[height * painted.aspect, height, 1]}
      renderOrder={3}
    />
  );
}
