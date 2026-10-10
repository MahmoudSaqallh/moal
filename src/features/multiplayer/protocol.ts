/**
 * MallVerse realtime protocol — shared by the browser client and the standalone Socket.IO
 * server (`server/realtime/server.ts`). Kept dependency-free (no path aliases, no enums)
 * so Node can run it directly with native TypeScript type-stripping.
 *
 * Every message from a client is untrusted: validate it here, server-side, before use.
 */

export const PROTOCOL_VERSION = 1;
export const FLOOR_HEIGHT_M = 7.05;
export const FLOOR_COUNT_M = 3;
/** World bounds of the walkable mall (metres), with a small margin. */
export const WORLD = { minX: -80, maxX: 64, minZ: -56, maxZ: 38 };
/** Fastest legitimate movement: running plus a generous network-jitter allowance. */
export const MAX_SPEED = 7.5;
export const SEND_HZ = 10;
export const SNAPSHOT_HZ = 10;
/** Area of interest: peers further than this (same level) are not streamed. */
export const AOI_RADIUS = 45;
export const AOI_RADIUS_OTHER_FLOOR = 24;
export const MAX_PEERS_PER_SNAPSHOT = 40;

export type PeerMode = "walk" | "escalator" | "elevator";

export interface PeerState {
  x: number;
  y: number;
  z: number;
  floor: number;
  yaw: number;
  speed: number;
  mode: PeerMode;
  /** Set when the client fast-travelled; allows one large jump. */
  teleport?: boolean;
}

export interface PeerAppearance {
  body: string;
  height: number;
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  accessory: string;
}

export interface HelloMessage {
  v: number;
  name: string;
  appearance: PeerAppearance;
  state: PeerState;
}

/** Compact snapshot row: [id, x, y, z, yaw, speed, mode, floor]. */
export type SnapshotRow = [string, number, number, number, number, number, PeerMode, number];

export interface PeerMeta {
  id: string;
  name: string;
  appearance: PeerAppearance;
}

const BODY = ["slim", "regular", "broad"];
const HAIR = ["short", "bob", "bun", "curly", "long", "buzz"];
const TOP = ["tee", "jacket", "hoodie", "dress"];
const ACCESSORY = ["none", "glasses", "cap", "backpack", "tote"];
const MODES: PeerMode[] = ["walk", "escalator", "elevator"];
const HEX = /^#[0-9a-f]{6}$/i;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Printable, trimmed display name (max 20 chars); falls back to a generated one. */
export function cleanName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const name = raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return name || fallback;
}

export function cleanAppearance(raw: unknown): PeerAppearance | null {
  if (!isObj(raw)) return null;
  const pick = (v: unknown, allowed: string[]) => (typeof v === "string" && allowed.includes(v) ? v : null);
  const color = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);
  const out = {
    body: pick(raw.body, BODY),
    height: finite(raw.height) ? Math.min(1.08, Math.max(0.92, raw.height)) : null,
    skin: color(raw.skin),
    hair: pick(raw.hair, HAIR),
    hairColor: color(raw.hairColor),
    top: pick(raw.top, TOP),
    topColor: color(raw.topColor),
    bottomColor: color(raw.bottomColor),
    shoeColor: color(raw.shoeColor),
    accessory: pick(raw.accessory, ACCESSORY),
  };
  for (const v of Object.values(out)) if (v === null) return null;
  return out as PeerAppearance;
}

/** Structural and physical validation of a state update (no history). */
export function cleanState(raw: unknown): PeerState | null {
  if (!isObj(raw)) return null;
  const { x, y, z, floor, yaw, speed, mode } = raw;
  if (!finite(x) || !finite(y) || !finite(z) || !finite(yaw) || !finite(speed)) return null;
  if (!Number.isInteger(floor) || (floor as number) < 0 || (floor as number) >= FLOOR_COUNT_M) return null;
  if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) return null;
  if (y < -0.5 || y > FLOOR_HEIGHT_M * FLOOR_COUNT_M) return null;
  if (typeof mode !== "string" || !MODES.includes(mode as PeerMode)) return null;
  const f = floor as number;
  // Feet must be near the claimed level unless riding between levels.
  if (mode === "walk" && Math.abs(y - f * FLOOR_HEIGHT_M) > 0.6) return null;
  return {
    x,
    y,
    z,
    floor: f,
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    speed: Math.max(0, Math.min(MAX_SPEED, speed)),
    mode: mode as PeerMode,
    teleport: raw.teleport === true,
  };
}

export function cleanHello(raw: unknown): HelloMessage | null {
  if (!isObj(raw) || raw.v !== PROTOCOL_VERSION) return null;
  const appearance = cleanAppearance(raw.appearance);
  const state = cleanState(raw.state);
  if (!appearance || !state) return null;
  return { v: PROTOCOL_VERSION, name: typeof raw.name === "string" ? raw.name : "", appearance, state };
}

/**
 * Anti-abuse: reject moves faster than physically possible since the last accepted state.
 * Teleports (fast travel) are allowed at most once per `teleportCooldownMs`.
 */
export function plausibleMove(
  prev: { x: number; y: number; z: number; at: number; lastTeleportAt: number },
  next: PeerState,
  now: number,
  teleportCooldownMs = 3000,
): "ok" | "teleport" | "reject" {
  const dt = Math.max(0.05, (now - prev.at) / 1000);
  const dist = Math.hypot(next.x - prev.x, next.z - prev.z);
  const climb = Math.abs(next.y - prev.y);
  const allowed = MAX_SPEED * dt + 1.5;
  if (dist <= allowed && climb <= 3 * dt + 1) return "ok";
  if (next.teleport && now - prev.lastTeleportAt >= teleportCooldownMs) return "teleport";
  return "reject";
}

/** Peers worth streaming to a viewer: same level within range, or nearby across a void. */
export function inInterest(viewer: PeerState, other: PeerState): boolean {
  const d = Math.hypot(viewer.x - other.x, viewer.z - other.z);
  return viewer.floor === other.floor ? d <= AOI_RADIUS : d <= AOI_RADIUS_OTHER_FLOOR;
}

/** Simple token bucket for per-connection rate limiting. */
export function createBucket(ratePerSec: number, burst: number) {
  let tokens = burst;
  let last: number | null = null;
  return {
    take(now = Date.now()): boolean {
      last ??= now;
      tokens = Math.min(burst, tokens + ((now - last) / 1000) * ratePerSec);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}
