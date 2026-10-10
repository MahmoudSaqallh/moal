"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import type { AvatarAppearance } from "@/types";
import { sanitizeAppearance } from "@/data/avatars";
import { samplePeer, usePresenceStore } from "@/features/multiplayer/client";
import type { PeerMeta } from "@/features/multiplayer/protocol";
import { Avatar, type AvatarMotion } from "./Avatar";

/** One remote visitor: interpolated pose from the network buffer, real appearance and name. */
function RemoteAvatar({ peer }: { peer: PeerMeta }) {
  const [motion] = useState<AvatarMotion>(() => ({ x: 0, y: -100, z: 0, yaw: 0, speed: 0, mode: "walk", gestureAt: -10 }));
  const tag = useRef<THREE.Group>(null);
  const visible = useRef(false);
  const appearance: AvatarAppearance = sanitizeAppearance(peer.appearance);

  useFrame(() => {
    const m = motion;
    visible.current = samplePeer(peer.id, m);
    if (!visible.current) m.y = -100; // out of interest: park below the world
    if (tag.current) {
      tag.current.position.set(m.x, m.y + 2.15 * appearance.height, m.z);
      tag.current.visible = visible.current;
    }
  });

  return (
    <group>
      <Avatar appearance={appearance} motion={motion} />
      <group ref={tag}>
        <Html center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap rounded-full bg-ink/85 px-2 py-0.5 text-[11px] font-medium text-ivory" dir="auto">
            {peer.name}
          </span>
        </Html>
      </group>
    </group>
  );
}

/** Real visitors connected through the realtime server (nothing renders offline). */
export function RemoteAvatars() {
  const peers = usePresenceStore((s) => s.peers);
  return (
    <group>
      {Object.values(peers).map((p) => (
        <RemoteAvatar key={p.id} peer={p} />
      ))}
    </group>
  );
}
