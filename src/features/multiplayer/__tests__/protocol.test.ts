import { describe, expect, it } from "vitest";
import { cleanAppearance, cleanHello, cleanName, cleanState, inInterest, plausibleMove, createBucket, PROTOCOL_VERSION } from "../protocol";
import { AVATAR_PRESETS } from "@/data/avatars";

const appearance = AVATAR_PRESETS[0].appearance;
const state = { x: 0, y: 0, z: 13.5, floor: 0, yaw: 0, speed: 1, mode: "walk" };

describe("realtime protocol validation", () => {
  it("accepts a well-formed hello", () => {
    expect(cleanHello({ v: PROTOCOL_VERSION, name: "Ava", appearance, state })).not.toBeNull();
  });

  it("rejects malformed or out-of-world states", () => {
    expect(cleanState({ ...state, x: Number.NaN })).toBeNull();
    expect(cleanState({ ...state, x: 999 })).toBeNull();
    expect(cleanState({ ...state, floor: 7 })).toBeNull();
    expect(cleanState({ ...state, floor: 1.5 })).toBeNull();
    expect(cleanState({ ...state, mode: "fly" })).toBeNull();
    // Walking feet must be on the claimed level.
    expect(cleanState({ ...state, floor: 2, y: 0 })).toBeNull();
  });

  it("clamps speed and normalises yaw", () => {
    const s = cleanState({ ...state, speed: 99, yaw: 7 })!;
    expect(s.speed).toBeLessThanOrEqual(7.5);
    expect(Math.abs(s.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it("sanitises names and appearance from untrusted clients", () => {
    expect(cleanName("  <b>Ava</b>‮  ", "x")).toBe("bAva/b");
    expect(cleanName("", "Visitor 1")).toBe("Visitor 1");
    expect(cleanName("a".repeat(50), "x")).toHaveLength(20);
    expect(cleanAppearance({ ...appearance, skin: "red" })).toBeNull();
    expect(cleanAppearance({ ...appearance, hair: "mohawk" })).toBeNull();
  });

  it("rejects implausible movement but allows a rate-limited teleport", () => {
    const prev = { x: 0, y: 0, z: 0, at: 0, lastTeleportAt: 0 };
    expect(plausibleMove(prev, { ...cleanState({ ...state, x: 0.5, z: 0 })! }, 100)).toBe("ok");
    expect(plausibleMove(prev, { ...cleanState({ ...state, x: 40, z: 0 })! }, 100)).toBe("reject");
    expect(plausibleMove(prev, { ...cleanState({ ...state, x: 40, z: 0, teleport: true })! }, 5000)).toBe("teleport");
    expect(plausibleMove({ ...prev, lastTeleportAt: 4000 }, { ...cleanState({ ...state, x: 40, z: 0, teleport: true })! }, 5000)).toBe("reject");
  });

  it("filters peers by area of interest", () => {
    const a = cleanState(state)!;
    expect(inInterest(a, cleanState({ ...state, x: 30 })!)).toBe(true);
    expect(inInterest(a, cleanState({ ...state, x: 60, z: 0 })!)).toBe(false);
  });

  it("rate-limits with a token bucket", () => {
    const b = createBucket(1, 2);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(false);
    expect(b.take(1500)).toBe(true);
  });
});
