"use client";

import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { player } from "@/lib/runtime";
import { floorY } from "@/data/floors";
import { useAvatarStore } from "@/stores/useAvatarStore";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { PROTOCOL_VERSION, SEND_HZ, type PeerMeta, type PeerMode, type SnapshotRow } from "./protocol";

/**
 * Browser side of realtime presence. Connects only when NEXT_PUBLIC_REALTIME_URL is set;
 * otherwise the HUD shows an explicit "Offline preview" state — no simulated visitors.
 */

export type PresenceStatus = "disabled" | "connecting" | "live" | "offline";

interface PresenceState {
  status: PresenceStatus;
  /** Visitors connected to the server, including you. */
  visitors: number;
  peers: Record<string, PeerMeta>;
  setStatus: (s: PresenceStatus) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  status: "disabled",
  visitors: 0,
  peers: {},
  setStatus: (status) => set({ status }),
}));

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  mode: PeerMode;
}

/** Recent samples per peer, consumed by the renderer with a small delay for smoothness. */
export const peerBuffers = new Map<string, Sample[]>();
export const INTERP_DELAY_MS = 120;

let socket: Socket | null = null;
let sendTimer: ReturnType<typeof setInterval> | null = null;
let lastFloorSent = -1;
let lastSentX = 0;
let lastSentZ = 0;

let unsubscribeAvatar: (() => void) | null = null;

export const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "";

function helloPayload() {
  const avatar = useAvatarStore.getState();
  return {
    v: PROTOCOL_VERSION,
    name: avatar.displayName,
    appearance: avatar.appearance,
    state: currentState(false),
  };
}

function currentState(teleport: boolean) {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    floor: player.floor,
    yaw: player.yaw,
    speed: player.speed,
    mode: player.mode,
    teleport,
  };
}

export function connectPresence() {
  if (!REALTIME_URL || socket) return;
  const presence = usePresenceStore.getState();
  presence.setStatus("connecting");
  socket = io(REALTIME_URL, { transports: ["websocket"], reconnection: true, reconnectionDelayMax: 8000 });

  socket.on("connect", () => {
    socket?.emit("hello", helloPayload());
  });
  socket.on("welcome", (msg: { id: string; peers: PeerMeta[] }) => {
    const peers: Record<string, PeerMeta> = {};
    for (const p of msg.peers) peers[p.id] = p;
    usePresenceStore.setState({ status: "live", peers, visitors: msg.peers.length + 1 });
  });
  socket.on("peer:join", (p: PeerMeta) => usePresenceStore.setState((s) => ({ peers: { ...s.peers, [p.id]: p } })));
  socket.on("peer:update", (p: PeerMeta) => usePresenceStore.setState((s) => ({ peers: { ...s.peers, [p.id]: p } })));
  socket.on("peer:leave", ({ id }: { id: string }) => {
    peerBuffers.delete(id);
    usePresenceStore.setState((s) => {
      const peers = { ...s.peers };
      delete peers[id];
      return { peers };
    });
  });
  socket.on("snapshot", (msg: { t: number; count: number; peers: SnapshotRow[] }) => {
    const now = performance.now();
    const seen = new Set<string>();
    for (const [id, x, y, z, yaw, speed, mode] of msg.peers) {
      seen.add(id);
      const buf = peerBuffers.get(id) ?? [];
      buf.push({ t: now, x, y, z, yaw, speed, mode });
      while (buf.length > 12) buf.shift();
      peerBuffers.set(id, buf);
    }
    // Peers that left our area of interest stop rendering.
    for (const id of peerBuffers.keys()) if (!seen.has(id)) peerBuffers.delete(id);
    if (usePresenceStore.getState().visitors !== msg.count) usePresenceStore.setState({ visitors: msg.count });
  });
  socket.on("correct", (c: { x: number; z: number; floor: number }) => {
    // The server rejected an implausible move; snap back to its last accepted position.
    player.x = c.x;
    player.z = c.z;
    player.floor = c.floor;
    player.y = floorY(c.floor);
  });
  socket.on("rejected", (r: { reason: string }) => {
    if (r.reason === "full") useExperienceStore.getState().showToast("The live mall is full right now. You're in an offline preview.");
  });
  socket.on("disconnect", () => usePresenceStore.setState({ status: "offline" }));
  socket.io.on("reconnect_attempt", () => usePresenceStore.setState({ status: "connecting" }));
  socket.on("connect_error", () => usePresenceStore.setState({ status: "offline" }));

  sendTimer = setInterval(() => {
    if (!socket?.connected) return;
    const phase = useExperienceStore.getState().phase;
    if (phase !== "explore" && phase !== "inspect") return;
    // Large jumps (fast travel, lift arrival) are flagged so the server's plausibility check allows them once.
    const jumped = Math.hypot(player.x - lastSentX, player.z - lastSentZ) > 6 || player.floor !== lastFloorSent;
    socket.emit("state", currentState(jumped && player.mode === "walk"));
    lastSentX = player.x;
    lastSentZ = player.z;
    lastFloorSent = player.floor;
  }, 1000 / SEND_HZ);

  // Keep the server's copy of the avatar in sync with the picker.
  unsubscribeAvatar = useAvatarStore.subscribe((s, prev) => {
    if (s.appearance !== prev.appearance || s.displayName !== prev.displayName) {
      socket?.emit("appearance", { name: s.displayName, appearance: s.appearance });
    }
  });
}

export function disconnectPresence() {
  if (sendTimer) clearInterval(sendTimer);
  sendTimer = null;
  unsubscribeAvatar?.();
  unsubscribeAvatar = null;
  socket?.disconnect();
  socket = null;
  peerBuffers.clear();
  usePresenceStore.setState({ status: REALTIME_URL ? "offline" : "disabled", peers: {}, visitors: 0 });
}

/** Interpolated pose of a peer at render time (null when no data). */
export function samplePeer(id: string, out: { x: number; y: number; z: number; yaw: number; speed: number; mode: PeerMode }) {
  const buf = peerBuffers.get(id);
  if (!buf || !buf.length) return false;
  const t = performance.now() - INTERP_DELAY_MS;
  let a = buf[0];
  let b = buf[buf.length - 1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].t <= t && buf[i + 1].t >= t) {
      a = buf[i];
      b = buf[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const k = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 1;
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  const dy = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  out.yaw = a.yaw + dy * k;
  out.speed = a.speed + (b.speed - a.speed) * k;
  out.mode = k < 0.5 ? a.mode : b.mode;
  return true;
}
