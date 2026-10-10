"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { QualityPreset } from "@/types";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { prepareLibrary, disposeLibrary } from "../materials/library";
import { disposeSharedGeometry } from "../architecture/shared";
import { MallWorld } from "./MallWorld";
import { perfStats } from "./perfStats";

const DPR: Record<QualityPreset, [number, number]> = {
  low: [0.7, 1],
  medium: [1, 1.5],
  high: [1, 2],
};

/** Prepares textures/materials with real progress, then mounts the world. */
function WorldLoader({ quality }: { quality: QualityPreset }) {
  const [ready, setReady] = useState(false);
  const initialQuality = useRef(quality);
  useEffect(() => {
    let cancelled = false;
    const { setLoading, setLoadingError } = useExperienceStore.getState();
    prepareLibrary(initialQuality.current, (f, label) => {
      if (!cancelled) setLoading(0.15 + f * 0.65, label);
    })
      .then(() => {
        if (cancelled) return;
        setLoading(0.82, "Building the mall");
        setReady(true);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) setLoadingError("The mall's materials could not be prepared on this device.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!ready) return null;
  return (
    <>
      <MallWorld quality={quality} />
      <ShaderWarmup />
    </>
  );
}

/** Compiles every shader before the reveal so the intro never stutters, then starts it. */
function ShaderWarmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    const { setLoading, setPhase } = useExperienceStore.getState();
    setLoading(0.88, "Compiling shaders");
    const start = async () => {
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // compileAsync is an optimisation; rendering still works without it.
      }
      if (cancelled) return;
      setLoading(1, "Welcome");
      // Two frames so the first visible frame is fully lit (environment + baked shadows).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled && useExperienceStore.getState().phase === "loading") setPhase("intro");
        }),
      );
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera]);
  return null;
}

/** Development/perf overlay feed: renderer statistics sampled twice a second. */
function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, frames: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.frames++;
    if (acc.current.t < 0.5) return;
    perfStats.fps = Math.round(acc.current.frames / acc.current.t);
    perfStats.calls = gl.info.render.calls;
    perfStats.triangles = gl.info.render.triangles;
    perfStats.geometries = gl.info.memory.geometries;
    perfStats.textures = gl.info.memory.textures;
    acc.current.t = 0;
    acc.current.frames = 0;
  });
  return null;
}

function PostEffects() {
  const gl = useThree((s) => s.gl);
  // The composer applies tone mapping itself; avoid doing it twice.
  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = prev;
    };
  }, [gl]);
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO halfRes aoRadius={1.6} distanceFalloff={0.8} intensity={1.6} quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.32} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default function MallCanvas() {
  const quality = useSettingsStore((s) => s.quality);
  const setQuality = useSettingsStore((s) => s.setQuality);
  const [factor, setFactor] = useState(1);
  const [min, max] = DPR[quality];
  const dpr = Math.round((min + (max - min) * factor) * 100) / 100;

  useEffect(
    () => () => {
      disposeLibrary();
      disposeSharedGeometry();
    },
    [],
  );

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={dpr}
      shadows={quality !== "low" ? "percentage" : false}
      gl={{ antialias: quality !== "high", powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 38, near: 0.1, far: 2000, position: [-58, 34, 150] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          useExperienceStore.getState().setWebglLost(true);
        });
        canvas.addEventListener("webglcontextrestored", () => useExperienceStore.getState().setWebglLost(false));
      }}
      aria-label="Explorable 3D model of the MallVerse shopping mall"
      role="img"
    >
      <PerformanceMonitor
        onChange={({ factor }) => setFactor(factor)}
        onFallback={() => {
          // Sustained low frame rate: step the preset down once and tell the visitor.
          // Loading stalls (texture painting, shader compiles) are not representative.
          if (useExperienceStore.getState().phase === "loading") return;
          if (quality !== "low") {
            setQuality(quality === "high" ? "medium" : "low", false);
            useExperienceStore.getState().showToast("Graphics lowered automatically to keep movement smooth.");
          }
        }}
        flipflops={3}
      >
        <Suspense fallback={null}>
          <WorldLoader quality={quality} />
        </Suspense>
        {quality === "high" && <PostEffects />}
        <PerfProbe />
      </PerformanceMonitor>
    </Canvas>
  );
}
