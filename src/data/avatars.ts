import type { AvatarAccessory, AvatarAppearance, AvatarBody, AvatarHair, AvatarTop } from "@/types";

/**
 * Avatar options. Avatars are procedural (built from primitives and animated in code)
 * until licensed rigged GLB characters are supplied; see README → Avatars.
 */

export const AVATAR_PRESETS: readonly { id: string; label: string; appearance: AvatarAppearance }[] = [
  {
    id: "ava",
    label: "Ava",
    appearance: {
      body: "slim",
      height: 0.98,
      skin: "#c98f6b",
      hair: "bob",
      hairColor: "#2b1d16",
      top: "jacket",
      topColor: "#b48a5e",
      bottomColor: "#2a2d33",
      shoeColor: "#f2f0ea",
      accessory: "tote",
    },
  },
  {
    id: "leo",
    label: "Leo",
    appearance: {
      body: "regular",
      height: 1.03,
      skin: "#8d5a3c",
      hair: "short",
      hairColor: "#1a1412",
      top: "tee",
      topColor: "#e9e2d4",
      bottomColor: "#4b5563",
      shoeColor: "#1d1d1d",
      accessory: "none",
    },
  },
  {
    id: "noor",
    label: "Noor",
    appearance: {
      body: "slim",
      height: 0.96,
      skin: "#e2b48f",
      hair: "long",
      hairColor: "#4a2f22",
      top: "dress",
      topColor: "#3d4f3e",
      bottomColor: "#3d4f3e",
      shoeColor: "#8a4f2a",
      accessory: "glasses",
    },
  },
  {
    id: "kai",
    label: "Kai",
    appearance: {
      body: "broad",
      height: 1.05,
      skin: "#f0c9a5",
      hair: "buzz",
      hairColor: "#6b5a45",
      top: "hoodie",
      topColor: "#5d6670",
      bottomColor: "#22252b",
      shoeColor: "#b77757",
      accessory: "cap",
    },
  },
];

export const DEFAULT_APPEARANCE = AVATAR_PRESETS[0].appearance;

export const SKIN_TONES = ["#f3d2b5", "#e2b48f", "#c98f6b", "#a8704d", "#8d5a3c", "#5c3a26"];
export const HAIR_COLORS = ["#1a1412", "#2b1d16", "#4a2f22", "#6b5a45", "#b48a5e", "#d9c4a0", "#8c8f86", "#7a2e2e"];
export const CLOTH_COLORS = ["#e9e2d4", "#b48a5e", "#3d4f3e", "#2b3346", "#5d6670", "#a2573a", "#22252b", "#9fb4cc", "#c8907a", "#f2f0ea"];
export const SHOE_COLORS = ["#f2f0ea", "#1d1d1d", "#8a4f2a", "#b77757", "#5d6670"];

export const BODY_OPTIONS: { id: AvatarBody; label: string }[] = [
  { id: "slim", label: "Slim" },
  { id: "regular", label: "Regular" },
  { id: "broad", label: "Broad" },
];
export const HAIR_OPTIONS: { id: AvatarHair; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "buzz", label: "Buzz" },
  { id: "bob", label: "Bob" },
  { id: "bun", label: "Bun" },
  { id: "long", label: "Long" },
  { id: "curly", label: "Curly" },
];
export const TOP_OPTIONS: { id: AvatarTop; label: string }[] = [
  { id: "tee", label: "T-shirt" },
  { id: "jacket", label: "Jacket" },
  { id: "hoodie", label: "Hoodie" },
  { id: "dress", label: "Dress" },
];
export const ACCESSORY_OPTIONS: { id: AvatarAccessory; label: string }[] = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "cap", label: "Cap" },
  { id: "backpack", label: "Backpack" },
  { id: "tote", label: "Tote bag" },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Validate untrusted appearance data (localStorage or the network); falls back per field. */
export function sanitizeAppearance(raw: unknown): AvatarAppearance {
  const d = DEFAULT_APPEARANCE;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly { id: T }[], fallback: T): T =>
    allowed.some((o) => o.id === v) ? (v as T) : fallback;
  const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
  const height = typeof r.height === "number" && Number.isFinite(r.height) ? Math.min(1.08, Math.max(0.92, r.height)) : d.height;
  return {
    body: pick(r.body, BODY_OPTIONS, d.body),
    height,
    skin: color(r.skin, d.skin),
    hair: pick(r.hair, HAIR_OPTIONS, d.hair),
    hairColor: color(r.hairColor, d.hairColor),
    top: pick(r.top, TOP_OPTIONS, d.top),
    topColor: color(r.topColor, d.topColor),
    bottomColor: color(r.bottomColor, d.bottomColor),
    shoeColor: color(r.shoeColor, d.shoeColor),
    accessory: pick(r.accessory, ACCESSORY_OPTIONS, d.accessory),
  };
}

/** Display names are shown to other visitors: printable, trimmed, at most 20 characters. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}
