import * as THREE from "three";
import type { QualityPreset } from "@/types";
import {
  paintBlobShadow,
  paintConcrete,
  paintFabric,
  paintFrond,
  paintGrass,
  paintHerringbone,
  paintLeaves,
  paintMarble,
  paintOak,
  paintPaving,
  paintPlaster,
  paintRadial,
  paintStonePanels,
  paintTerrazzo,
  paintWallAO,
  paintWaterNormal,
  paintInteriorGlow,
  paintStreaks,
  toTexture,
} from "./textures";
import { loadSignFonts } from "./signage";

/**
 * One shared set of materials for the whole mall (material reuse keeps shader programs
 * and GPU memory low). Built asynchronously with real progress so the loading screen
 * reports actual work rather than a fake timer.
 */

function std(params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial(params);
}

/** Unlit, tone-mapped "light source" material. Values above 1 read as brighter than white. */
function glow(hex: string, intensity: number) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) });
  return m;
}

export function buildMaterials(t: ReturnType<typeof emptyTextures>) {
  return {
    // Floors
    floorMarble: std({ map: t.marble, roughness: 0.16, metalness: 0, envMapIntensity: 0.9 }),
    floorBand: std({ map: t.marbleDark, roughness: 0.22, envMapIntensity: 0.8 }),
    floorTerrazzo: std({ map: t.terrazzo, roughness: 0.28, envMapIntensity: 0.8 }),
    floorConcrete: std({ map: t.concrete, roughness: 0.32, envMapIntensity: 0.8 }),
    floorConcreteDark: std({ map: t.concrete, color: "#7d838a", roughness: 0.3, envMapIntensity: 0.8 }),
    floorHerringbone: std({ map: t.herringbone, roughness: 0.5 }),
    floorOak: std({ map: t.oak, color: "#e8d6bd", roughness: 0.5 }),
    floorDarkStone: std({ map: t.marbleDark, color: "#6d625a", roughness: 0.14, envMapIntensity: 1 }),
    paving: std({ map: t.paving, roughness: 0.85 }),
    pavingDark: std({ map: t.paving, color: "#5e636b", roughness: 0.8 }),
    grass: std({ map: t.grass, roughness: 0.95 }),

    // Walls & architecture
    wallStone: std({ map: t.stone, roughness: 0.75 }),
    wallPlaster: std({ map: t.plaster, roughness: 0.9 }),
    terracotta: std({ map: t.plaster, color: "#b9714f", roughness: 0.92 }),
    whiteMatte: std({ color: "#f2efe9", roughness: 0.78 }),
    whiteSatin: std({ color: "#f6f5f2", roughness: 0.35, envMapIntensity: 0.7 }),
    // Ceilings face away from the sun; a faint self-illumination stands in for bounce light.
    ceiling: std({ color: "#f4f1eb", roughness: 0.9, emissive: "#f1e9dc", emissiveIntensity: 0.32 }),
    oak: std({ map: t.oak, roughness: 0.55 }),
    oakDark: std({ map: t.oak, color: "#8a6a4c", roughness: 0.6 }),

    // Metals
    brass: std({ color: "#c09a5e", metalness: 1, roughness: 0.32 }),
    bronze: std({ color: "#5a4433", metalness: 0.9, roughness: 0.42 }),
    steel: std({ color: "#c8ccd0", metalness: 1, roughness: 0.28 }),
    chrome: std({ color: "#e4e6e8", metalness: 1, roughness: 0.06 }),
    blackMetal: std({ color: "#1f1e1c", metalness: 0.6, roughness: 0.45 }),
    mirror: std({ color: "#dfe3e4", metalness: 1, roughness: 0.03 }),

    // Glass â€” plain transparent standard material: convincing reflections from the
    // environment map without the extra render pass that transmission would cost.
    glass: std({
      color: "#dce8ea",
      metalness: 0.2,
      roughness: 0.04,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      envMapIntensity: 1.2,
    }),
    glassRail: std({
      color: "#cfe3df",
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frostedLight: glow("#fff6e8", 1.35),
    /** Outer face of the atrium vault: reads as tinted glass from the plaza. */
    vaultOuter: std({
      color: "#b9cfd8",
      metalness: 0.6,
      roughness: 0.08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.FrontSide,
      envMapIntensity: 1.6,
    }),
    /** The entrance canopy glazing: fritted glass so the roof reads from below and above. */
    canopyGlass: std({
      color: "#dfe9ee",
      metalness: 0.35,
      roughness: 0.12,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),

    // Soft goods
    fabricCream: std({ map: t.fabric, color: "#e7dfd1", roughness: 0.95 }),
    /** White base for instanced, per-instance tinted goods. */
    fabricWhite: std({ map: t.fabric, color: "#ffffff", roughness: 0.92 }),
    satinWhiteTint: std({ color: "#ffffff", roughness: 0.55 }),
    fabricSage: std({ map: t.fabric, color: "#9aa58a", roughness: 0.95 }),
    fabricCharcoal: std({ map: t.fabric, color: "#55524d", roughness: 0.95 }),
    fabricTerracotta: std({ map: t.fabric, color: "#b77a5a", roughness: 0.95 }),
    leather: std({ color: "#7a4a2c", roughness: 0.55 }),
    velvet: std({ map: t.fabric, color: "#5b3a2e", roughness: 1 }),

    // Plants
    foliage: std({ map: t.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }),
    frond: std({ map: t.frond, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }),
    trunk: std({ color: "#6e5a45", roughness: 0.95 }),
    palmTrunk: std({ color: "#9a8a72", roughness: 0.95 }),
    soil: std({ color: "#3b3026", roughness: 1 }),
    hedge: std({ color: "#4a6a35", roughness: 0.95 }),

    // Light sources (unlit)
    lightWarm: glow("#ffe0b5", 2.2),
    lightNeutral: glow("#fff7ec", 2.0),
    lightCool: glow("#e6f0ff", 2.0),
    lightBlue: glow("#4f8cff", 2.4),
    lightAmber: glow("#ffb867", 2.4),
    /** Lit upper-level shop glazing seen from the ground floor. */
    shopGlow: new THREE.MeshBasicMaterial({ map: t.interior, color: new THREE.Color(1.05, 1.0, 0.95) }),
    shopGlowCool: glow("#e4ecf3", 0.9),
    darkGlass: std({ color: "#20242a", metalness: 0.4, roughness: 0.08, envMapIntensity: 1.4 }),
    screenDark: std({ color: "#0e1014", roughness: 0.15, metalness: 0.3 }),

    // Water
    water: std({
      color: "#2f5b62",
      roughness: 0.04,
      metalness: 0.15,
      normalMap: t.waterNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.9,
    }),
    waterStream: new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e8f4f6").multiplyScalar(0.9),
      alphaMap: t.streaks,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),

    // Decals
    lightPool: new THREE.MeshBasicMaterial({
      map: t.radial,
      color: new THREE.Color("#ffd9a8").multiplyScalar(0.2),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    lightPoolCool: new THREE.MeshBasicMaterial({
      map: t.radial,
      color: new THREE.Color("#cfe2ff").multiplyScalar(0.22),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    blobShadow: new THREE.MeshBasicMaterial({
      map: t.blob,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      color: "#000000",
    }),
    wallAO: new THREE.MeshBasicMaterial({
      map: t.wallAO,
      transparent: true,
      depthWrite: false,
      color: "#000000",
    }),
  };
}

function emptyTextures() {
  return {} as {
    marble: THREE.Texture;
    marbleDark: THREE.Texture;
    terrazzo: THREE.Texture;
    concrete: THREE.Texture;
    herringbone: THREE.Texture;
    oak: THREE.Texture;
    paving: THREE.Texture;
    grass: THREE.Texture;
    stone: THREE.Texture;
    plaster: THREE.Texture;
    fabric: THREE.Texture;
    leaves: THREE.Texture;
    frond: THREE.Texture;
    radial: THREE.Texture;
    blob: THREE.Texture;
    wallAO: THREE.Texture;
    waterNormal: THREE.Texture;
    interior: THREE.Texture;
    streaks: THREE.Texture;
  };
}

export type MaterialLibrary = ReturnType<typeof buildMaterials> & {
  textures: ReturnType<typeof emptyTextures>;
  quality: QualityPreset;
};

let library: MaterialLibrary | null = null;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function prepareLibrary(
  quality: QualityPreset,
  onProgress: (fraction: number, label: string) => void,
): Promise<MaterialLibrary> {
  // Texture resolution is decided once per session; later preset changes only affect
  // DPR, shadows, post-processing and scene density (see MallCanvas).
  if (library) return library;
  const size = quality === "low" ? 512 : 1024;
  const half = size / 2;
  const t = emptyTextures();
  const jobs: [string, () => void][] = [
    ["Loading typefaces", () => undefined],
    ["Polishing marble", () => (t.marble = toTexture(paintMarble(size)))],
    ["Cutting granite bands", () => (t.marbleDark = toTexture(paintMarble(half, 9, "#77706a", "#8e867b", false)))],
    ["Casting terrazzo", () => (t.terrazzo = toTexture(paintTerrazzo(size)))],
    ["Troweling concrete", () => (t.concrete = toTexture(paintConcrete(half)))],
    ["Laying herringbone oak", () => (t.herringbone = toTexture(paintHerringbone(size)))],
    ["Milling oak", () => (t.oak = toTexture(paintOak(half)))],
    ["Setting plaza paving", () => (t.paving = toTexture(paintPaving(size)))],
    ["Planting lawns", () => (t.grass = toTexture(paintGrass(half)))],
    ["Dressing limestone", () => (t.stone = toTexture(paintStonePanels(half)))],
    ["Plastering walls", () => (t.plaster = toTexture(paintPlaster(half)))],
    ["Weaving upholstery", () => (t.fabric = toTexture(paintFabric(half)))],
    ["Growing foliage", () => (t.leaves = toTexture(paintLeaves(size), { repeat: false }))],
    ["Growing palms", () => (t.frond = toTexture(paintFrond(size), { repeat: false }))],
    [
      "Baking light and shadow",
      () => {
        t.radial = toTexture(paintRadial(128), { repeat: false });
        t.blob = toTexture(paintBlobShadow(128), { repeat: false, color: false });
        t.wallAO = toTexture(paintWallAO(128), { repeat: false, color: false });
      },
    ],
    [
      "Filling the fountains",
      () => {
        t.waterNormal = toTexture(paintWaterNormal(256), { color: false });
        t.streaks = toTexture(paintStreaks(256), { color: false });
        t.interior = toTexture(paintInteriorGlow(size));
      },
    ],
  ];
  for (let i = 0; i < jobs.length; i++) {
    const [label, run] = jobs[i];
    onProgress(i / (jobs.length + 1), label);
    await nextFrame();
    if (i === 0) await loadSignFonts();
    else run();
  }
  onProgress(jobs.length / (jobs.length + 1), "Assembling materials");
  await nextFrame();
  library = { ...buildMaterials(t), textures: t, quality };
  return library;
}

export function getLibrary(): MaterialLibrary {
  if (!library) throw new Error("Material library used before prepareLibrary() resolved");
  return library;
}

/**
 * Free GPU memory held by the library. The JS objects stay valid (three re-uploads a
 * disposed texture/material if it is used again), which keeps React StrictMode's
 * mount → unmount → mount cycle in development safe.
 */
export function disposeLibrary() {
  if (!library) return;
  for (const value of Object.values(library)) {
    if (value instanceof THREE.Material) value.dispose();
  }
  for (const tex of Object.values(library.textures)) tex?.dispose();
}
