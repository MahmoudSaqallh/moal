/**
 * MallVerse realtime presence server (Socket.IO).
 *
 * Run:  npm run realtime          (Node ≥ 22.18 / 24 — native TypeScript type-stripping)
 * Env:  REALTIME_PORT             default 3001
 *       REALTIME_ALLOWED_ORIGINS  comma-separated origins (default: http://localhost:3000)
 *       REALTIME_MAX_VISITORS     default 100
 *
 * Single-instance, in-memory presence. To scale horizontally, add the Socket.IO Redis
 * adapter and move presence into Redis (see README → Multiplayer).
 */
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  MAX_PEERS_PER_SNAPSHOT,
  PROTOCOL_VERSION,
  SNAPSHOT_HZ,
  cleanAppearance,
  cleanHello,
  cleanName,
  cleanState,
  createBucket,
  inInterest,
  plausibleMove,
  type PeerAppearance,
  type PeerState,
  type SnapshotRow,
} from "../../src/features/multiplayer/protocol.ts";

const PORT = Number(process.env.REALTIME_PORT ?? 3001);
const ORIGINS = (process.env.REALTIME_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const MAX_VISITORS = Number(process.env.REALTIME_MAX_VISITORS ?? 100);

interface Visitor {
  id: string;
  name: string;
  appearance: PeerAppearance;
  state: PeerState;
  at: number;
  lastTeleportAt: number;
  rejects: number;
  bucket: ReturnType<typeof createBucket>;
}

const visitors = new Map<string, Visitor>();

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, visitors: visitors.size }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(http, {
  cors: { origin: ORIGINS, methods: ["GET", "POST"] },
  maxHttpBufferSize: 4 * 1024,
  pingInterval: 10_000,
  pingTimeout: 8_000,
  connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
});

function meta(v: Visitor) {
  return { id: v.id, name: v.name, appearance: v.appearance };
}

io.on("connection", (socket: Socket) => {
  let me: Visitor | null = null;
  const helloBucket = createBucket(1, 3);

  socket.on("hello", (raw: unknown) => {
    if (!helloBucket.take()) return;
    const hello = cleanHello(raw);
    if (!hello) {
      socket.emit("rejected", { reason: "invalid-hello", protocol: PROTOCOL_VERSION });
      return;
    }
    if (!me && visitors.size >= MAX_VISITORS) {
      socket.emit("rejected", { reason: "full" });
      socket.disconnect(true);
      return;
    }
    const fallback = `Visitor ${socket.id.slice(-4).toUpperCase()}`;
    const now = Date.now();
    const joining = !me;
    me = {
      id: socket.id,
      name: cleanName(hello.name, fallback),
      appearance: hello.appearance,
      state: hello.state,
      at: now,
      lastTeleportAt: now,
      rejects: 0,
      bucket: me?.bucket ?? createBucket(15, 20),
    };
    visitors.set(socket.id, me);
    socket.emit("welcome", { id: socket.id, peers: [...visitors.values()].filter((v) => v.id !== socket.id).map(meta) });
    if (joining) socket.broadcast.emit("peer:join", meta(me));
    else socket.broadcast.emit("peer:update", meta(me));
  });

  socket.on("state", (raw: unknown) => {
    if (!me || !me.bucket.take()) return;
    const next = cleanState(raw);
    if (!next) return;
    const now = Date.now();
    const verdict = plausibleMove({ ...me.state, at: me.at, lastTeleportAt: me.lastTeleportAt }, next, now);
    if (verdict === "reject") {
      me.rejects++;
      // Tell the client where the server believes it is; drop chronic offenders.
      socket.emit("correct", { x: me.state.x, z: me.state.z, floor: me.state.floor });
      if (me.rejects > 120) socket.disconnect(true);
      return;
    }
    if (verdict === "teleport") me.lastTeleportAt = now;
    me.rejects = Math.max(0, me.rejects - 1);
    me.state = next;
    me.at = now;
  });

  socket.on("appearance", (raw: unknown) => {
    if (!me || !me.bucket.take()) return;
    const r = (raw && typeof raw === "object" ? raw : {}) as { name?: unknown; appearance?: unknown };
    const appearance = cleanAppearance(r.appearance);
    if (!appearance) return;
    me.appearance = appearance;
    me.name = cleanName(r.name, me.name);
    socket.broadcast.emit("peer:update", meta(me));
  });

  socket.on("disconnect", () => {
    if (!me) return;
    visitors.delete(me.id);
    io.emit("peer:leave", { id: me.id });
  });
});

// Snapshot loop: each visitor receives only nearby peers (area of interest).
setInterval(() => {
  const all = [...visitors.values()];
  const count = all.length;
  for (const viewer of all) {
    const rows: SnapshotRow[] = [];
    const nearby = all
      .filter((o) => o.id !== viewer.id && inInterest(viewer.state, o.state))
      .sort((a, b) => Math.hypot(a.state.x - viewer.state.x, a.state.z - viewer.state.z) - Math.hypot(b.state.x - viewer.state.x, b.state.z - viewer.state.z))
      .slice(0, MAX_PEERS_PER_SNAPSHOT);
    for (const o of nearby) {
      const s = o.state;
      rows.push([o.id, round(s.x), round(s.y), round(s.z), round(s.yaw), round(s.speed), s.mode, s.floor]);
    }
    io.to(viewer.id).emit("snapshot", { t: Date.now(), count, peers: rows });
  }
}, 1000 / SNAPSHOT_HZ);

function round(v: number) {
  return Math.round(v * 100) / 100;
}

http.listen(PORT, () => {
  console.log(`MallVerse realtime server on :${PORT} (origins: ${ORIGINS.join(", ")})`);
});
