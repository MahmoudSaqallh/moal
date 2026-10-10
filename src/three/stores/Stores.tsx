"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { StoreConfig } from "@/types";
import { STORES } from "@/data/stores";
import { PRODUCT_PLACEMENTS } from "@/data/navigation";
import { STORE_FOOTPRINTS } from "@/data/layout";
import { floorY } from "@/data/floors";
import { Storefront } from "./Storefront";
import { LumenInterior } from "./interiors/LumenInterior";
import { BoutiqueInterior, CafeInterior, JewelInterior, ShowroomInterior, SneakerInterior } from "./interiors/BoutiqueInteriors";
import { ArcadeInterior, RestaurantInterior } from "./interiors/LeisureInteriors";
import { InteractiveProduct } from "../products/InteractiveProduct";

function Interior({ store }: { store: StoreConfig }) {
  switch (store.interior) {
    case "lumen":
      return <LumenInterior store={store} />;
    case "boutique":
      return <BoutiqueInterior store={store} />;
    case "jewel":
      return <JewelInterior store={store} />;
    case "sneaker":
      return <SneakerInterior store={store} />;
    case "showroom":
      return <ShowroomInterior store={store} />;
    case "cafe":
      return <CafeInterior store={store} />;
    case "arcade":
      return <ArcadeInterior store={store} />;
    case "restaurant":
      return <RestaurantInterior store={store} />;
  }
}

/** Interiors further than this from the camera are hidden (not rendered, not raycast). */
const INTERIOR_RANGE = 34;

export function Stores() {
  const interiors = useRef<(THREE.Group | null)[]>([]);
  const products = useMemo(
    () => STORES.map((s) => PRODUCT_PLACEMENTS.filter((p) => p.storeId === s.id)),
    [],
  );
  const tick = useRef(0);

  useFrame((state, dt) => {
    tick.current += dt;
    if (tick.current < 0.1) return;
    tick.current = 0;
    const cam = state.camera.position;
    STORE_FOOTPRINTS.forEach((f, i) => {
      const g = interiors.current[i];
      if (!g) return;
      const cx = Math.max(f.interior.minX, Math.min(cam.x, f.interior.maxX));
      const cz = Math.max(f.interior.minZ, Math.min(cam.z, f.interior.maxZ));
      const dy = Math.abs(cam.y - (floorY(f.floor) + 2));
      g.visible = dy < 9 && Math.hypot(cam.x - cx, cam.z - cz) < INTERIOR_RANGE;
    });
  });

  return (
    <group>
      {STORES.map((store, i) => (
        <group key={store.id}>
          <Storefront store={store} />
          <group
            ref={(g) => {
              interiors.current[i] = g;
            }}
          >
            <Interior store={store} />
            {products[i].map((p) => (
              <InteractiveProduct key={p.productId} placement={p} />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
