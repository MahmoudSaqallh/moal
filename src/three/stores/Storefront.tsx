"use client";

import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { StoreConfig } from "@/types";
import { getStoreLayout, FACADE_THICKNESS, WINDOW_SILL_DEPTH, type DisplayWindow } from "@/data/storeLayouts";
import { facingYaw } from "@/lib/space";
import { floorY } from "@/data/floors";
import { G } from "../architecture/constants";
import { boxFromBounds, type BoxSpec } from "../architecture/geometry";
import { StaticBoxes, useDisposable } from "../architecture/primitives";
import { geo } from "../architecture/shared";
import { getLibrary, type MaterialLibrary } from "../materials/library";
import { paintText, storeSignOptions } from "../materials/signage";
import { toTexture } from "../materials/textures";
import { TextSign } from "../environments/Signage";
import { Mannequin } from "./Mannequin";
import { enterStore } from "@/features/exploration/actions";
import { input } from "@/lib/runtime";

/**
 * Config-driven storefront in store-local space (facade on z = 0, corridor on +z).
 * Each facade style is a distinct piece of architecture, but all share the same anatomy:
 * a framed door opening, display windows, a sign band and a projecting blade sign.
 */

const FT = FACADE_THICKNESS;
const DOOR_H = 3.4;
const SIGN_Y = 4.75;
const ARCH_SPRING = 2.4;

interface FacadeParts {
  solid: BoxSpec[];
  trim: BoxSpec[];
  glass: BoxSpec[];
  glow: BoxSpec[];
}

/** Wall pieces around the door and window openings for a given facade. */
function openingWall(store: StoreConfig, windows: DisplayWindow[], windowTop: number): BoxSpec[] {
  const half = store.width / 2;
  const dh = store.doorWidth / 2;
  const boxes: BoxSpec[] = [];
  // Horizontal spans along the facade: solid between openings.
  const openings = [
    { minX: -dh, maxX: dh, top: DOOR_H },
    ...windows.map((w) => ({ minX: w.minX, maxX: w.maxX, top: windowTop })),
  ].sort((a, b) => a.minX - b.minX);
  let cursor = -half;
  for (const o of openings) {
    if (o.minX > cursor) boxes.push(boxFromBounds(cursor, o.minX, 0, G, -FT, 0));
    boxes.push(boxFromBounds(o.minX, o.maxX, o.top, G, -FT, 0)); // header above opening
    if (o.top === windowTop) boxes.push(boxFromBounds(o.minX, o.maxX, 0, 0.35, -FT, 0)); // stall riser
    cursor = o.maxX;
  }
  if (cursor < half) boxes.push(boxFromBounds(cursor, half, 0, G, -FT, 0));
  return boxes;
}

function windowGlass(windows: DisplayWindow[], windowTop: number): BoxSpec[] {
  return windows.map((w) => boxFromBounds(w.minX, w.maxX, 0.35, windowTop, -0.06, -0.03));
}

function frameAround(minX: number, maxX: number, y0: number, y1: number, depth = 0.08, t = 0.08): BoxSpec[] {
  return [
    boxFromBounds(minX - t, minX, y0, y1, -0.02, depth),
    boxFromBounds(maxX, maxX + t, y0, y1, -0.02, depth),
    boxFromBounds(minX - t, maxX + t, y1, y1 + t, -0.02, depth),
  ];
}

function facadeParts(store: StoreConfig, windows: DisplayWindow[]): FacadeParts {
  const half = store.width / 2;
  const dh = store.doorWidth / 2;
  const parts: FacadeParts = { solid: [], trim: [], glass: [], glow: [] };
  switch (store.theme.facade) {
    case "stone-fins": {
      // White stone mass with vertical fins and a deep lit display niche (luxury storefront reference).
      const top = 3.6;
      parts.solid.push(...openingWall(store, windows, top));
      for (let x = -half + 0.5; x <= half - 0.4; x += 1.1) {
        if (Math.abs(x) < dh + 0.6 || windows.some((w) => x > w.minX - 0.3 && x < w.maxX + 0.3)) continue;
        parts.solid.push(boxFromBounds(x - 0.16, x + 0.16, 0, G, 0, 0.32));
      }
      parts.trim.push(...frameAround(-dh, dh, 0, DOOR_H, 0.06, 0.07));
      windows.forEach((w) => parts.trim.push(...frameAround(w.minX, w.maxX, 0.35, top, 0.05, 0.06)));
      parts.trim.push(boxFromBounds(-half, half, 4.05, 4.12, 0, 0.12)); // shadow gap reveal
      parts.glass.push(...windowGlass(windows, top));
      break;
    }
    case "white-halo": {
      // Seamless white portal with a full-height glass front and a halo light ring (electronics reference).
      const top = 4.1;
      parts.solid.push(...openingWall(store, windows, top));
      parts.solid.push(boxFromBounds(-half, half, 4.35, G, 0, 0.25));
      parts.trim.push(boxFromBounds(-half + 0.3, half - 0.3, 4.2, 4.3, 0, 0.3));
      parts.glow.push(boxFromBounds(-half + 0.3, half - 0.3, 4.18, 4.22, 0.02, 0.32));
      parts.glass.push(...windowGlass(windows, top));
      parts.trim.push(...frameAround(-dh, dh, 0, DOOR_H, 0.04, 0.05));
      break;
    }
    case "plaster-curve": {
      // Warm plaster wall; openings are softened with arched heads (sneaker store reference).
      const top = 3.4;
      parts.solid.push(...openingWall(store, windows, top));
      parts.solid.push(boxFromBounds(-half, half, 0, 0.12, 0, 0.18));
      parts.glass.push(...windowGlass(windows, top));
      parts.trim.push(boxFromBounds(-half, half, 4.0, 4.06, 0, 0.1));
      break;
    }
    case "bronze-mirror": {
      // Dark bronze frame and mirror-clad piers.
      const top = 3.8;
      parts.solid.push(...openingWall(store, windows, top));
      parts.trim.push(...frameAround(-dh, dh, 0, DOOR_H, 0.14, 0.14));
      windows.forEach((w) => parts.trim.push(...frameAround(w.minX, w.maxX, 0.35, top, 0.12, 0.12)));
      parts.trim.push(boxFromBounds(-half, half, 4.25, 5.35, 0, 0.14));
      parts.glass.push(...windowGlass(windows, top));
      parts.glow.push(boxFromBounds(-half, half, 4.2, 4.24, 0.02, 0.16));
      break;
    }
    case "oak-frame": {
      const top = 3.8;
      parts.solid.push(...openingWall(store, windows, top));
      for (const x of [-half + 0.2, -dh - 0.2, dh + 0.2, half - 0.2]) parts.trim.push(boxFromBounds(x - 0.2, x + 0.2, 0, 4.4, 0, 0.3));
      parts.trim.push(boxFromBounds(-half, half, 4.0, 4.4, 0, 0.3));
      parts.glass.push(...windowGlass(windows, top));
      break;
    }
    case "graphite-grid": {
      // Dark graphite portal with a lit grid of slim vertical light lines.
      const top = 4.0;
      parts.solid.push(...openingWall(store, windows, top));
      parts.trim.push(boxFromBounds(-half, half, 4.2, G, 0, 0.18));
      for (let x = -half + 0.6; x <= half - 0.5; x += 1.2) parts.glow.push(boxFromBounds(x - 0.02, x + 0.02, 4.3, 6.2, 0.19, 0.21));
      parts.trim.push(...frameAround(-dh, dh, 0, DOOR_H, 0.08, 0.08));
      parts.glass.push(...windowGlass(windows, top));
      break;
    }
    case "terracotta-arch": {
      // Warm terracotta wall with a timber screen canopy.
      const top = 3.6;
      parts.solid.push(...openingWall(store, windows, top));
      for (let x = -half + 0.12; x <= half - 0.1; x += 0.24) parts.trim.push(boxFromBounds(x - 0.05, x + 0.05, 3.75, 4.35, 0, 0.5));
      parts.trim.push(boxFromBounds(-half, half, 3.7, 3.76, 0, 0.9));
      parts.glow.push(boxFromBounds(-half + 0.2, half - 0.2, 3.66, 3.69, 0.05, 0.85));
      parts.glass.push(...windowGlass(windows, top));
      break;
    }
    case "cafe-awning": {
      const top = 3.6;
      parts.solid.push(...openingWall(store, windows, top));
      parts.trim.push(boxFromBounds(-half, half, 3.75, 3.85, 0, 1.4)); // timber canopy
      for (let x = -half + 0.15; x <= half - 0.1; x += 0.3) parts.trim.push(boxFromBounds(x - 0.04, x + 0.04, 3.85, 4.25, 0, 0.12));
      parts.glass.push(...windowGlass(windows, top));
      parts.glow.push(boxFromBounds(-half + 0.2, half - 0.2, 3.72, 3.75, 0.05, 1.3));
      break;
    }
  }
  return parts;
}

function facadeMaterials(store: StoreConfig, m: MaterialLibrary) {
  switch (store.theme.facade) {
    case "stone-fins":
      return { solid: m.wallStone, trim: m.blackMetal };
    case "white-halo":
      return { solid: m.whiteSatin, trim: m.whiteSatin };
    case "plaster-curve":
      return { solid: m.wallPlaster, trim: m.oak };
    case "bronze-mirror":
      return { solid: m.mirror, trim: m.bronze };
    case "oak-frame":
      return { solid: m.wallPlaster, trim: m.oak };
    case "cafe-awning":
      return { solid: m.wallPlaster, trim: m.oakDark };
    case "graphite-grid":
      return { solid: m.blackMetal, trim: m.darkGlass };
    case "terracotta-arch":
      return { solid: m.terracotta, trim: m.oakDark };
  }
}

/** Projecting blade sign under the gallery, visible down the corridor. */
function BladeSign({ store }: { store: StoreConfig }) {
  const m = getLibrary();
  const material = useDisposable(() => {
    const painted = paintText(store.name, { ...storeSignOptions(store), color: "#f3ead9", halo: undefined, height: 256 });
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1c1a17";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = store.theme.accent;
    ctx.fillRect(0, c.height - 14, c.width, 14);
    const scale = Math.min((c.width * 0.86) / painted.canvas.width, (c.height * 0.8) / painted.canvas.height);
    const w = painted.canvas.width * scale;
    const h = painted.canvas.height * scale;
    ctx.drawImage(painted.canvas, (c.width - w) / 2, (c.height - h) / 2 - 8, w, h);
    const tex = toTexture(c, { repeat: false, anisotropy: 8 });
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.1) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  }, [store]);
  const x = store.width / 2 - 0.9;
  return (
    <group position={[x, G - 0.75, 0.9]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geo.plane()} material={material} scale={[1.4, 0.7, 1]} />
      <mesh geometry={geo.rod(6)} material={m.blackMetal} position={[0, 0.55, 0]} scale={[0.012, 0.4, 0.012]} />
    </group>
  );
}

function WindowDisplay({ store, w }: { store: StoreConfig; w: DisplayWindow }) {
  const m = getLibrary();
  const depth = WINDOW_SILL_DEPTH[w.kind];
  const cx = (w.minX + w.maxX) / 2;
  const width = w.maxX - w.minX;
  const isNiche = w.kind === "niche";
  const platformMat = isNiche ? m.whiteSatin : store.theme.facade === "plaster-curve" ? m.wallPlaster : m.whiteSatin;
  return (
    <group>
      {/* Display platform */}
      <mesh geometry={geo.boxBase()} material={platformMat} position={[cx, 0, -depth / 2 - FT / 2]} scale={[width, 0.35, depth - FT]} receiveShadow />
      {isNiche && (
        <>
          {/* Lit backdrop and side returns, like a jewellery box */}
          <mesh geometry={geo.boxBase()} material={m.oak} position={[cx, 0.35, -depth - 0.05]} scale={[width, 3.3, 0.1]} />
          <mesh geometry={geo.plane()} material={m.frostedLight} position={[cx, 2.0, -depth + 0.01]} scale={[width - 0.5, 2.9, 1]} />
          <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[cx, 3.6, -depth / 2]} scale={[width, 0.12, depth]} />
        </>
      )}
      <WindowProps store={store} cx={cx} width={width} depth={depth} />
    </group>
  );
}

/** Category-specific window dressing. */
function WindowProps({ store, cx, width, depth }: { store: StoreConfig; cx: number; width: number; depth: number }) {
  const m = getLibrary();
  const y = 0.35;
  const z = -depth / 2 - 0.1;
  switch (store.category) {
    case "fashion":
      return (
        <group>
          <Mannequin position={[cx - width * 0.18, y, z]} rotY={0.25} outfit="coat" color="#b48a5e" />
          <Mannequin position={[cx + width * 0.18, y, z]} rotY={-0.2} outfit="dress" color="#cdb79a" />
        </group>
      );
    case "accessories":
      return (
        <group>
          {[-0.3, 0, 0.3].map((f, i) => (
            <group key={f} position={[cx + width * f, y, z]}>
              <mesh geometry={geo.cyl(24)} material={m.bronze} scale={[0.32, 0.6 + i * 0.25, 0.32]} />
              <mesh geometry={geo.boxBase()} material={i === 1 ? m.leather : m.velvet} position={[0, 0.6 + i * 0.25, 0]} scale={[0.36, 0.26, 0.14]} />
            </group>
          ))}
        </group>
      );
    case "technology":
      return (
        <group>
          {[-0.25, 0.25].map((f) => (
            <group key={f} position={[cx + width * f, y, z]}>
              <mesh geometry={geo.boxBase()} material={m.whiteSatin} scale={[1.1, 0.75, 0.6]} />
              <mesh geometry={geo.box()} material={m.lightBlue} position={[0, 0.02, 0]} scale={[1.0, 0.03, 0.5]} />
              <mesh geometry={geo.box()} material={m.screenDark} position={[0, 1.2, 0]} rotation={[-0.15, 0, 0]} scale={[0.9, 0.55, 0.03]} />
            </group>
          ))}
        </group>
      );
    case "footwear":
      return (
        <group>
          {[-0.3, -0.1, 0.1, 0.3].map((f, i) => (
            <group key={f} position={[cx + width * f, y, z]}>
              <mesh geometry={geo.cyl(28)} material={m.wallPlaster} scale={[0.35, 0.3 + (i % 2) * 0.35, 0.35]} />
              <mesh geometry={geo.capsule()} material={i % 2 ? m.fabricCream : m.fabricCharcoal} position={[0, 0.42 + (i % 2) * 0.35, 0]} rotation={[0, 0.5, Math.PI / 2]} scale={[0.22, 0.2, 0.22]} />
            </group>
          ))}
        </group>
      );
    case "gaming":
      return (
        <group>
          {[-0.25, 0.25].map((f) => (
            <group key={f} position={[cx + width * f, y, z]}>
              <mesh geometry={geo.boxBase()} material={m.blackMetal} scale={[0.9, 0.5, 0.5]} />
              <mesh geometry={geo.box()} material={m.lightCool} position={[0, 0.02, 0]} scale={[0.85, 0.02, 0.45]} />
              <mesh geometry={geo.boxBase()} material={m.whiteSatin} position={[0, 0.5, 0]} scale={[0.18, 0.38, 0.32]} />
              <mesh geometry={geo.box()} material={m.screenDark} position={[0, 1.4, -0.1]} rotation={[-0.1, 0, 0]} scale={[1.2, 0.7, 0.03]} />
            </group>
          ))}
        </group>
      );
    case "home":
      return (
        <group position={[cx, y, z]}>
          <mesh geometry={geo.boxBase()} material={m.oak} position={[0, 0, 0]} scale={[Math.min(1.6, width * 0.6), 0.45, 0.6]} />
          <mesh geometry={geo.sphere(20)} material={m.whiteSatin} position={[-0.3, 0.68, 0]} scale={[0.18, 0.24, 0.18]} />
          <mesh geometry={geo.sphere(20)} material={m.fabricSage} position={[0.25, 0.62, 0]} scale={[0.14, 0.18, 0.14]} />
        </group>
      );
    case "food":
      if (store.interior === "restaurant")
        return (
          <group position={[cx, y, z]}>
            <mesh geometry={geo.boxBase()} material={m.oak} scale={[Math.min(3, width * 0.8), 0.06, 0.5]} position={[0, 0.7, 0]} />
            {[-0.8, 0, 0.8].map((f) => (
              <group key={f} position={[f, 0.76, 0]}>
                <mesh geometry={geo.cyl(24)} material={m.whiteSatin} scale={[0.17, 0.02, 0.17]} />
                <mesh geometry={geo.sphere(14)} material={m.terracotta} position={[0, 0.05, 0]} scale={[0.11, 0.05, 0.11]} />
              </group>
            ))}
          </group>
        );
      return (
        <group position={[cx, y, z]}>
          <mesh geometry={geo.boxBase()} material={m.oak} scale={[Math.min(3, width * 0.8), 0.06, 0.45]} position={[0, 0.65, 0]} />
          {[-1, -0.5, 0, 0.5, 1].map((f) => (
            <mesh key={f} geometry={geo.boxBase()} material={m.oakDark} position={[f, 0.71, 0]} scale={[0.22, 0.3, 0.12]} />
          ))}
        </group>
      );
  }
}

export function Storefront({ store, children }: { store: StoreConfig; children?: ReactNode }) {
  const m = getLibrary();
  const layout = getStoreLayout(store);
  const parts = useMemo(() => facadeParts(store, layout.windows), [store, layout.windows]);
  const mats = facadeMaterials(store, m);
  const yaw = facingYaw(store.facing);
  const sign = storeSignOptions(store);
  const signHeight = store.theme.facade === "white-halo" ? 0.62 : 0.7;
  const signZ = store.theme.facade === "stone-fins" ? 0.34 : store.theme.facade === "white-halo" ? 0.27 : 0.17;

  return (
    <group position={[store.origin.x, floorY(store.floor), store.origin.z]} rotation={[0, yaw, 0]}>
      <StaticBoxes boxes={parts.solid} material={mats.solid} uvScale={2.4} />
      <StaticBoxes boxes={parts.trim} material={mats.trim} uvScale={1.2} />
      <StaticBoxes boxes={parts.glass} material={m.glass} receiveShadow={false} />
      {parts.glow.length > 0 && (
        <StaticBoxes boxes={parts.glow} material={store.theme.light === "cool" ? m.lightCool : m.lightWarm} receiveShadow={false} />
      )}
      {store.theme.facade === "plaster-curve" && <ArchedPortal width={store.doorWidth} />}
      <TextSign
        text={store.name}
        position={[0, store.theme.facade === "plaster-curve" ? 5.3 : SIGN_Y, signZ]}
        height={signHeight}
        glow={store.theme.facade === "bronze-mirror" ? 1.3 : 1.05}
        {...sign}
      />
      {/* Clickable door: entering is also possible by simply walking in. */}
      <mesh
        position={[0, DOOR_H / 2, 0.05]}
        onClick={(e) => {
          e.stopPropagation();
          if (input.dragDistance < 6) enterStore(store.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
        visible={false}
      >
        <planeGeometry args={[store.doorWidth, DOOR_H]} />
        <meshBasicMaterial />
      </mesh>
      {layout.windows.map((w, i) => (
        <WindowDisplay key={i} store={store} w={w} />
      ))}
      <BladeSign store={store} />
      {/* Warm spill of shop light onto the corridor floor */}
      <mesh geometry={geo.flat()} material={store.theme.light === "cool" ? m.lightPoolCool : m.lightPool} position={[0, 0.012, 1.4]} scale={[store.width * 0.9, 1, 3.2]} renderOrder={2} />
      {children}
    </group>
  );
}

/** Rounded plaster portal framing the sneaker store entrance. */
function ArchedPortal({ width }: { width: number }) {
  const m = getLibrary();
  const geometry = useDisposable(() => {
    const outer = width / 2 + 0.6;
    const inner = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, 0);
    shape.lineTo(-outer, ARCH_SPRING);
    shape.absarc(0, ARCH_SPRING, outer, Math.PI, 0, true);
    shape.lineTo(outer, 0);
    shape.lineTo(inner, 0);
    shape.lineTo(inner, ARCH_SPRING);
    shape.absarc(0, ARCH_SPRING, inner, 0, Math.PI, false);
    shape.lineTo(-inner, 0);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 24 });
  }, [width]);
  return <mesh geometry={geometry} material={m.wallPlaster} position={[0, 0, -0.05]} />;
}
