"use client";

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ProductKind } from "@/types";
import { geo } from "../architecture/shared";
import { useDisposable } from "../architecture/primitives";
import { getLibrary } from "../materials/library";
import { paintScreen } from "../materials/signage";
import { toTexture } from "../materials/textures";
import { Mannequin } from "../stores/Mannequin";

/**
 * Procedural product models at real-world scale (metres). Origin sits at the base of the
 * product, front faces +Z. `primary` is the variant-coloured material owned by the caller.
 */

export { PRODUCT_META } from "@/data/productMeta";

function useRounded(w: number, h: number, d: number, r: number) {
  return useDisposable(() => new RoundedBoxGeometry(w, h, d, 3, r), [w, h, d, r]);
}

function useScreenMaterial(seed: number) {
  return useDisposable(() => {
    const tex = toTexture(paintScreen(seed), { repeat: false });
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) });
    const dispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      tex.dispose();
      dispose();
    };
    return mat;
  }, [seed]);
}

function Phone({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.075, 0.155, 0.008, 0.008);
  const screen = useScreenMaterial(1);
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.glassRail} scale={[0.06, 0.012, 0.07]} />
      <group position={[0, 0.088, 0]} rotation={[-0.25, 0, 0]}>
        <mesh geometry={body} material={primary} castShadow />
        <mesh geometry={geo.plane()} material={screen} position={[0, 0, 0.0042]} scale={[0.069, 0.149, 1]} />
        <mesh geometry={geo.box()} material={m.screenDark} position={[-0.018, 0.055, -0.0048]} scale={[0.032, 0.034, 0.002]} />
      </group>
    </group>
  );
}

function Laptop({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const base = useRounded(0.32, 0.012, 0.22, 0.005);
  const lid = useRounded(0.32, 0.21, 0.007, 0.004);
  const screen = useScreenMaterial(2);
  return (
    <group>
      <mesh geometry={base} material={primary} position={[0, 0.006, 0]} castShadow />
      <mesh geometry={geo.box()} material={m.screenDark} position={[0, 0.0122, 0.015]} scale={[0.27, 0.001, 0.1]} />
      <group position={[0, 0.012, -0.108]} rotation={[-0.32, 0, 0]}>
        <mesh geometry={lid} material={primary} position={[0, 0.105, 0]} castShadow />
        <mesh geometry={geo.plane()} material={screen} position={[0, 0.107, 0.0038]} scale={[0.3, 0.19, 1]} />
      </group>
    </group>
  );
}

function Headphones({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const band = useDisposable(() => new THREE.TorusGeometry(0.085, 0.012, 10, 32, Math.PI));
  return (
    <group>
      <mesh geometry={geo.cyl(24)} material={m.whiteSatin} scale={[0.06, 0.012, 0.06]} />
      <mesh geometry={geo.cyl(10)} material={m.whiteSatin} scale={[0.008, 0.2, 0.008]} />
      <group position={[0, 0.255, 0]}>
        <mesh geometry={band} material={primary} castShadow />
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.088, -0.025, 0]}>
            <mesh geometry={geo.rod(28)} material={primary} rotation={[0, 0, Math.PI / 2]} scale={[0.042, 0.03, 0.05]} castShadow />
            <mesh geometry={geo.rod(28)} material={m.fabricCharcoal} position={[-s * 0.019, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.036, 0.012, 0.044]} />
          </group>
        ))}
      </group>
    </group>
  );
}

function Watch({ primary, luxury }: { primary: THREE.Material; luxury?: boolean }) {
  const m = getLibrary();
  const screen = useScreenMaterial(luxury ? 4 : 3);
  const strap = useDisposable(() => new THREE.TorusGeometry(0.032, 0.006, 6, 40));
  return (
    <group>
      <mesh geometry={geo.cyl(32)} material={m.velvet} scale={[0.05, 0.02, 0.05]} />
      <group position={[0, 0.05, 0]} rotation={[-0.5, 0, 0]}>
        <mesh geometry={strap} material={luxury ? m.leather : m.fabricCharcoal} scale={[1, 1.25, 1.6]} />
        <group position={[0, 0.034, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={geo.rod(40)} material={primary} scale={[0.021, 0.011, 0.021]} castShadow />
          <mesh geometry={geo.disk(40)} material={luxury ? m.whiteSatin : screen} position={[0, 0.0056, 0]} scale={0.018} />
          {luxury && (
            <>
              <mesh geometry={geo.box()} material={m.blackMetal} position={[0.004, 0.0062, 0]} rotation={[0, 0.6, 0]} scale={[0.012, 0.0006, 0.0012]} />
              <mesh geometry={geo.box()} material={m.blackMetal} position={[0, 0.0062, -0.006]} rotation={[0, -0.2, 0]} scale={[0.0012, 0.0006, 0.014]} />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

function Speaker({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  return (
    <group>
      <mesh geometry={geo.cyl(40)} material={primary} scale={[0.07, 0.2, 0.07]} castShadow />
      <mesh geometry={geo.cyl(40)} material={m.screenDark} position={[0, 0.2, 0]} scale={[0.066, 0.008, 0.066]} />
      <mesh geometry={geo.torus(0.04, 48)} material={m.lightCool} position={[0, 0.209, 0]} scale={0.045} />
    </group>
  );
}

function Tablet({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.28, 0.2, 0.006, 0.01);
  const screen = useScreenMaterial(0);
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.glassRail} scale={[0.12, 0.012, 0.08]} />
      <group position={[0, 0.11, 0]} rotation={[-0.28, 0, 0]}>
        <mesh geometry={body} material={primary} castShadow />
        <mesh geometry={geo.plane()} material={screen} position={[0, 0, 0.0032]} scale={[0.265, 0.185, 1]} />
      </group>
      <mesh geometry={geo.rod(10)} material={m.whiteSatin} position={[0.16, 0.012, 0.04]} rotation={[Math.PI / 2, 0, 0.2]} scale={[0.0045, 0.16, 0.0045]} />
    </group>
  );
}

export interface SneakerParts {
  sole?: THREE.Material;
  laces?: THREE.Material;
}

function Sneaker({ primary, parts }: { primary: THREE.Material; parts?: SneakerParts }) {
  const m = getLibrary();
  const sole = useRounded(0.29, 0.032, 0.105, 0.014);
  const laceMat = parts?.laces ?? m.whiteSatin;
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={sole} material={parts?.sole ?? m.whiteSatin} position={[0, 0.016, 0]} castShadow />
      {/* Upper: heel counter, vamp and toe box */}
      <mesh geometry={geo.sphere(24)} material={primary} position={[-0.06, 0.06, 0]} scale={[0.09, 0.055, 0.048]} castShadow />
      <mesh geometry={geo.sphere(24)} material={primary} position={[0.06, 0.045, 0]} scale={[0.09, 0.035, 0.048]} castShadow />
      <mesh geometry={geo.sphere(16)} material={m.fabricCharcoal} position={[-0.075, 0.103, 0]} scale={[0.045, 0.012, 0.032]} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.box()} material={laceMat} position={[0.0 + i * 0.022, 0.079 - i * 0.006, 0]} rotation={[0, 0, -0.25]} scale={[0.005, 0.004, 0.052]} />
      ))}
    </group>
  );
}

function Handbag({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.3, 0.22, 0.12, 0.03);
  const handle = useDisposable(() => new THREE.TorusGeometry(0.075, 0.008, 10, 32, Math.PI));
  return (
    <group>
      <mesh geometry={body} material={primary} position={[0, 0.11, 0]} castShadow />
      <mesh geometry={handle} material={primary} position={[0, 0.22, 0]} castShadow />
      <mesh geometry={geo.torus(0.12, 40)} material={m.brass} position={[0, 0.17, 0.062]} rotation={[Math.PI / 2, 0, 0]} scale={0.03} />
      <mesh geometry={geo.box()} material={m.brass} position={[0, 0.2, 0.061]} scale={[0.05, 0.012, 0.004]} />
    </group>
  );
}

function Sunglasses({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.bronze} scale={[0.16, 0.03, 0.08]} />
      <group position={[0, 0.07, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.034, 0, 0]}>
            <mesh geometry={geo.torus(0.12, 40)} material={primary} rotation={[Math.PI / 2, 0, 0]} scale={[0.028, 0.028, 0.026]} />
            <mesh geometry={geo.sphere(20)} material={m.darkGlass} scale={[0.027, 0.024, 0.004]} />
            <mesh geometry={geo.box()} material={primary} position={[s * 0.031, 0.006, -0.06]} scale={[0.003, 0.005, 0.12]} />
          </group>
        ))}
        <mesh geometry={geo.box()} material={primary} position={[0, 0.008, 0]} scale={[0.014, 0.004, 0.004]} />
      </group>
    </group>
  );
}

function Necklace({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const bust = useDisposable(() => new THREE.CylinderGeometry(0.06, 0.13, 0.3, 32, 1).translate(0, 0.15, 0));
  return (
    <group>
      <mesh geometry={bust} material={m.velvet} scale={[1, 1, 0.6]} castShadow />
      <mesh geometry={geo.sphere(20)} material={m.velvet} position={[0, 0.3, 0]} scale={[0.065, 0.03, 0.045]} />
      <mesh geometry={geo.torus(0.02, 64)} material={primary} position={[0, 0.25, 0.012]} rotation={[0.5, 0, 0]} scale={[0.075, 0.075, 0.06]} />
      <mesh geometry={geo.rod(24)} material={primary} position={[0, 0.19, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.018, 0.004, 0.018]} />
    </group>
  );
}

function Perfume({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const flacon = useRounded(0.075, 0.1, 0.045, 0.01);
  return (
    <group>
      <mesh geometry={flacon} material={primary} position={[0, 0.05, 0]} castShadow />
      <mesh geometry={geo.boxBase()} material={m.glassRail} position={[0, 0, 0]} scale={[0.082, 0.104, 0.052]} />
      <mesh geometry={geo.cyl(6)} material={m.brass} position={[0, 0.1, 0]} scale={[0.008, 0.012, 0.008]} />
      <mesh geometry={geo.boxBase()} material={m.blackMetal} position={[0, 0.112, 0]} scale={[0.034, 0.042, 0.034]} />
    </group>
  );
}

function FoldedKnit({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const fold = useRounded(0.36, 0.05, 0.28, 0.02);
  return (
    <group>
      <mesh geometry={fold} material={m.fabricCream} position={[0.02, 0.025, 0]} rotation={[0, 0.06, 0]} />
      <mesh geometry={fold} material={m.fabricCharcoal} position={[-0.01, 0.075, 0]} rotation={[0, -0.04, 0]} />
      <mesh geometry={fold} material={primary} position={[0, 0.125, 0]} castShadow />
    </group>
  );
}

function LoungeChair({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const legs: [number, number][] = [
    [-0.32, -0.3],
    [0.32, -0.3],
    [-0.32, 0.3],
    [0.32, 0.3],
  ];
  return (
    <group>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.boxBase()} material={primary} position={[x, 0, z]} scale={[0.05, 0.62, 0.05]} castShadow />
      ))}
      <mesh geometry={geo.boxBase()} material={primary} position={[0, 0.3, 0]} scale={[0.7, 0.04, 0.66]} />
      <mesh geometry={geo.boxBase()} material={m.fabricCream} position={[0, 0.34, 0.03]} scale={[0.62, 0.1, 0.58]} castShadow />
      <group position={[0, 0.36, -0.3]} rotation={[-0.32, 0, 0]}>
        <mesh geometry={geo.boxBase()} material={primary} position={[0, 0, 0]} scale={[0.7, 0.5, 0.04]} />
        <mesh geometry={geo.boxBase()} material={m.fabricCream} position={[0, 0.04, 0.05]} scale={[0.6, 0.42, 0.09]} castShadow />
      </group>
      <mesh geometry={geo.boxBase()} material={primary} position={[-0.36, 0.55, 0]} scale={[0.05, 0.04, 0.66]} />
      <mesh geometry={geo.boxBase()} material={primary} position={[0.36, 0.55, 0]} scale={[0.05, 0.04, 0.66]} />
    </group>
  );
}

function FloorLamp({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const arc = useDisposable(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 2.2, 0), new THREE.Vector3(0, 1.85, 1.05));
    return new THREE.TubeGeometry(curve, 40, 0.014, 8, false);
  });
  const shade = useDisposable(() => new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
  return (
    <group>
      <mesh geometry={geo.cyl(32)} material={m.whiteSatin} scale={[0.17, 0.06, 0.17]} castShadow />
      <mesh geometry={arc} material={primary} castShadow />
      <mesh geometry={shade} material={primary} position={[0, 1.83, 1.05]} castShadow />
      <mesh geometry={geo.sphere(16)} material={m.lightWarm} position={[0, 1.8, 1.05]} scale={0.1} />
    </group>
  );
}

function Vase({ primary }: { primary: THREE.Material }) {
  const lathe = useDisposable(() => {
    const pts = [
      [0, 0],
      [0.07, 0],
      [0.11, 0.06],
      [0.125, 0.15],
      [0.1, 0.27],
      [0.055, 0.33],
      [0.05, 0.37],
      [0.062, 0.38],
      [0.045, 0.38],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40);
  });
  return <mesh geometry={lathe} material={primary} castShadow />;
}

function Sofa({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const back = useDisposable(() => {
    const shape = new THREE.Shape();
    // Concave back: arc behind the seat, centre of curvature in front of the sofa.
    shape.absarc(0, 0, 1.25, Math.PI * 0.1, Math.PI * 0.9, false);
    shape.absarc(0, 0, 1.0, Math.PI * 0.9, Math.PI * 0.1, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.32, 0.9);
    return g;
  });
  const seat = useDisposable(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.12, Math.PI * 0.08, Math.PI * 0.92, false);
    shape.absarc(0, 0, 0.3, Math.PI * 0.92, Math.PI * 0.08, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.14, 0.82);
    return g;
  });
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.oakDark} position={[0, 0, 0.2]} scale={[1.9, 0.14, 0.6]} />
      <mesh geometry={seat} material={primary} castShadow receiveShadow />
      <mesh geometry={back} material={primary} castShadow />
    </group>
  );
}

function CoffeeBag({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const bag = useRounded(0.12, 0.2, 0.07, 0.012);
  return (
    <group>
      <mesh geometry={bag} material={primary} position={[0, 0.1, 0]} castShadow />
      <mesh geometry={geo.box()} material={primary} position={[0, 0.215, 0]} scale={[0.11, 0.03, 0.02]} />
      <mesh geometry={geo.plane()} material={m.fabricCream} position={[0, 0.1, 0.0352]} scale={[0.08, 0.09, 1]} />
      <mesh geometry={geo.plane()} material={m.fabricCharcoal} position={[0, 0.12, 0.0354]} scale={[0.06, 0.012, 1]} />
    </group>
  );
}

function Mug({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const cup = useDisposable(() => {
    const pts = [
      [0, 0],
      [0.035, 0],
      [0.042, 0.01],
      [0.045, 0.085],
      [0.041, 0.085],
      [0.038, 0.012],
      [0, 0.012],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 32);
  });
  return (
    <group>
      <mesh geometry={geo.cyl(32)} material={m.whiteSatin} scale={[0.07, 0.006, 0.07]} />
      <mesh geometry={cup} material={primary} position={[0, 0.006, 0]} castShadow />
      <mesh geometry={geo.torus(0.18, 24)} material={primary} position={[0.05, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} scale={0.024} />
      <mesh geometry={geo.disk(24)} material={m.oakDark} position={[0, 0.075, 0]} scale={0.039} />
    </group>
  );
}

function EspressoMachine({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.34, 0.34, 0.4, 0.02);
  return (
    <group>
      <mesh geometry={body} material={primary} position={[0, 0.2, 0]} castShadow />
      <mesh geometry={geo.boxBase()} material={m.steel} position={[0, 0.03, 0.17]} scale={[0.3, 0.02, 0.16]} />
      <mesh geometry={geo.cyl(24)} material={m.steel} position={[0, 0.2, 0.22]} scale={[0.04, 0.05, 0.04]} />
      <mesh geometry={geo.box()} material={m.blackMetal} position={[0, 0.19, 0.31]} scale={[0.025, 0.02, 0.16]} />
      <mesh geometry={geo.rod(24)} material={m.whiteSatin} position={[0.09, 0.3, 0.202]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 0.008, 0.035]} />
      <mesh geometry={geo.rod(8)} material={m.steel} position={[-0.15, 0.2, 0.22]} rotation={[0.3, 0, 0]} scale={[0.006, 0.18, 0.006]} />
      <mesh geometry={geo.boxBase()} material={m.steel} position={[0, 0.4, -0.02]} scale={[0.3, 0.012, 0.3]} />
    </group>
  );
}

function Console({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.1, 0.34, 0.27, 0.012);
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.blackMetal} scale={[0.16, 0.012, 0.12]} />
      <mesh geometry={body} material={primary} position={[0, 0.18, 0]} castShadow />
      <mesh geometry={geo.box()} material={m.blackMetal} position={[0, 0.18, 0]} scale={[0.104, 0.3, 0.02]} />
      <mesh geometry={geo.box()} material={m.lightCool} position={[0.051, 0.3, 0.1]} scale={[0.002, 0.08, 0.004]} />
    </group>
  );
}

function Controller({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.11, 0.035, 0.06, 0.015);
  return (
    <group position={[0, 0.03, 0]}>
      <mesh geometry={body} material={primary} castShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo.sphere(20)} material={primary} position={[s * 0.055, -0.006, 0.02]} scale={[0.03, 0.026, 0.045]} castShadow />
          <mesh geometry={geo.cyl(16)} material={m.blackMetal} position={[s * 0.03, 0.016, s < 0 ? -0.008 : 0.012]} scale={[0.009, 0.012, 0.009]} />
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.sphere(10)} material={m.whiteSatin} position={[0.045 + (i % 2 ? 0.008 : -0.008) * (i < 2 ? 1 : 0), 0.019, -0.012 + (i - 1.5) * 0.007]} scale={0.0045} />
      ))}
    </group>
  );
}

function Handheld({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const body = useRounded(0.29, 0.12, 0.02, 0.03);
  const screen = useScreenMaterial(3);
  return (
    <group>
      <mesh geometry={geo.boxBase()} material={m.glassRail} scale={[0.14, 0.012, 0.07]} />
      <group position={[0, 0.072, 0]} rotation={[-0.3, 0, 0]}>
        <mesh geometry={body} material={primary} castShadow />
        <mesh geometry={geo.plane()} material={screen} position={[0, 0, 0.0105]} scale={[0.16, 0.09, 1]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.cyl(14)} material={m.blackMetal} position={[s * 0.115, 0.02, 0.012]} rotation={[Math.PI / 2, 0, 0]} scale={[0.011, 0.006, 0.011]} />
        ))}
      </group>
    </group>
  );
}

function Bowl({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  const bowl = useDisposable(() => {
    const pts = [[0, 0], [0.05, 0], [0.09, 0.03], [0.11, 0.08], [0.112, 0.09], [0.105, 0.088], [0.085, 0.032], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40);
  });
  return (
    <group>
      <mesh geometry={bowl} material={m.whiteSatin} castShadow />
      <mesh geometry={geo.disk(32)} material={primary} position={[0, 0.07, 0]} scale={0.098} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <mesh key={i} geometry={geo.sphere(12)} material={i % 2 ? m.oak : m.hedge} position={[Math.cos(a) * 0.045, 0.078, Math.sin(a) * 0.045]} scale={[0.022, 0.012, 0.022]} />;
      })}
    </group>
  );
}

function Plate({ primary }: { primary: THREE.Material }) {
  const m = getLibrary();
  return (
    <group>
      <mesh geometry={geo.cyl(40)} material={m.whiteSatin} scale={[0.15, 0.012, 0.15]} castShadow />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return <mesh key={i} geometry={geo.sphere(14)} material={i % 3 === 2 ? m.hedge : primary} position={[Math.cos(a) * 0.07, 0.024, Math.sin(a) * 0.07]} scale={[0.03, 0.016, 0.022]} />;
      })}
      <mesh geometry={geo.sphere(14)} material={primary} position={[0, 0.022, 0]} scale={[0.04, 0.015, 0.04]} />
    </group>
  );
}

function Dessert({ primary, cone }: { primary: THREE.Material; cone: boolean }) {
  const m = getLibrary();
  const slice = useDisposable(() => new THREE.CylinderGeometry(0.075, 0.075, 0.05, 24, 1, false, 0, Math.PI / 3).translate(0, 0.037, 0));
  const swirl = useDisposable(() => new THREE.ConeGeometry(0.035, 0.07, 24).translate(0, 0.035, 0));
  if (cone)
    return (
      <group>
        <mesh geometry={geo.cyl(24)} material={m.whiteSatin} scale={[0.05, 0.01, 0.05]} />
        <mesh geometry={swirl} material={m.oak} position={[0, 0.08, 0]} rotation={[Math.PI, 0, 0]} />
        <mesh geometry={geo.sphere(18)} material={primary} position={[0, 0.095, 0]} scale={[0.036, 0.03, 0.036]} castShadow />
        <mesh geometry={swirl} material={primary} position={[0, 0.11, 0]} scale={[0.75, 0.7, 0.75]} />
      </group>
    );
  return (
    <group>
      <mesh geometry={geo.cyl(32)} material={m.whiteSatin} scale={[0.1, 0.01, 0.1]} />
      <mesh geometry={slice} material={m.oak} position={[-0.02, 0, -0.02]} castShadow />
      <mesh geometry={slice} material={primary} position={[-0.02, 0.028, -0.02]} scale={[1, 0.08, 1]} />
    </group>
  );
}

export function ProductModel({
  kind,
  primary,
  color,
  luxury = false,
  sneakerParts,
  variant,
}: {
  kind: ProductKind;
  primary: THREE.Material;
  color: string;
  /** Selects the jewellery-house rendition where a kind exists in two stores (watches). */
  luxury?: boolean;
  /** Per-part materials for the configurable sneaker. */
  sneakerParts?: SneakerParts;
  /** Model variant for kinds with more than one shape (e.g. dessert: "cone"). */
  variant?: string;
}) {
  switch (kind) {
    case "phone":
      return <Phone primary={primary} />;
    case "laptop":
      return <Laptop primary={primary} />;
    case "headphones":
      return <Headphones primary={primary} />;
    case "watch":
      return <Watch primary={primary} luxury={luxury} />;
    case "speaker":
      return <Speaker primary={primary} />;
    case "tablet":
      return <Tablet primary={primary} />;
    case "sneaker":
      return <Sneaker primary={primary} parts={sneakerParts} />;
    case "handbag":
      return <Handbag primary={primary} />;
    case "sunglasses":
      return <Sunglasses primary={primary} />;
    case "necklace":
      return <Necklace primary={primary} />;
    case "perfume":
      return <Perfume primary={primary} />;
    case "coat":
      return <Mannequin position={[0, 0, 0]} outfit="coat" color={color} />;
    case "dress":
      return <Mannequin position={[0, 0, 0]} outfit="dress" color={color} />;
    case "knit":
      return <FoldedKnit primary={primary} />;
    case "lounge-chair":
      return <LoungeChair primary={primary} />;
    case "floor-lamp":
      return <FloorLamp primary={primary} />;
    case "vase":
      return <Vase primary={primary} />;
    case "sofa":
      return <Sofa primary={primary} />;
    case "coffee-bag":
      return <CoffeeBag primary={primary} />;
    case "mug":
      return <Mug primary={primary} />;
    case "espresso-machine":
      return <EspressoMachine primary={primary} />;
    case "console":
      return <Console primary={primary} />;
    case "controller":
      return <Controller primary={primary} />;
    case "handheld":
      return <Handheld primary={primary} />;
    case "bowl":
      return <Bowl primary={primary} />;
    case "plate":
      return <Plate primary={primary} />;
    case "dessert":
      return <Dessert primary={primary} cone={variant === "cone"} />;
  }
}
