"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Product, ProductKind } from "@/types";
import type { ProductPlacement } from "@/data/navigation";
import { getProduct } from "@/data/products";
import { defaultConfiguration, getConfigurator } from "@/data/configurators";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { inspectProduct } from "@/features/exploration/actions";
import { input, inspectView, player } from "@/lib/runtime";
import { geo } from "../architecture/shared";
import { floorY } from "@/data/floors";
import { getLibrary } from "../materials/library";
import { ProductModel } from "./ProductModel";
import { PRODUCT_META } from "@/data/productMeta";

/** Base surface finish per product kind; the variant colour is applied on top. */
function finishFor(kind: ProductKind, map: THREE.Texture): THREE.MeshStandardMaterialParameters {
  switch (kind) {
    case "phone":
    case "laptop":
    case "tablet":
    case "watch":
      return { metalness: 0.75, roughness: 0.28 };
    case "headphones":
    case "sunglasses":
      return { metalness: 0.1, roughness: 0.35 };
    case "necklace":
      return { metalness: 1, roughness: 0.18 };
    case "perfume":
      return { metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.82 };
    case "handbag":
      return { roughness: 0.5 };
    case "vase":
    case "mug":
      return { roughness: 0.72 };
    case "espresso-machine":
      return { metalness: 0.6, roughness: 0.3 };
    case "lounge-chair":
      return { roughness: 0.6 };
    case "floor-lamp":
      return { metalness: 0.85, roughness: 0.35 };
    default:
      return { map, roughness: 0.95 };
  }
}

/** Clicks only count within a believable reach, so nothing behind a wall can be "bought". */
const CLICK_RANGE = 6;

export function InteractiveProduct({ placement }: { placement: ProductPlacement }) {
  const product = getProduct(placement.productId) as Product;
  const m = getLibrary();
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const hovered = useRef(false);

  const selected = useExperienceStore((s) => s.selectedProductId === product.id);
  const focused = useExperienceStore((s) => s.focused?.productId === product.id);
  const colorId = useExperienceStore((s) => (s.selectedProductId === product.id ? s.selectedColorId : null));
  const configuration = useExperienceStore((s) => (s.selectedProductId === product.id ? s.configuration : null));
  const configurator = getConfigurator(product.id);
  const config = configuration ?? (configurator ? defaultConfiguration(configurator) : null);
  const optionHex = (part: string) => configurator?.parts.find((p) => p.id === part)?.options.find((o) => o.id === config?.[part])?.hex;
  const color = (config && optionHex("upper")) ?? product.colors.find((c) => c.id === colorId)?.hex ?? product.colors[0].hex;

  const primary = useMemo(
    () => new THREE.MeshStandardMaterial({ color, ...finishFor(product.kind, m.textures.fabric) }),
    // Colour is updated in place to avoid shader recompiles on every swatch change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.kind, m],
  );
  useLayoutEffect(() => {
    primary.color.set(color);
  }, [primary, color]);
  useLayoutEffect(() => () => primary.dispose(), [primary]);

  // Configurable products: separate sole/lace materials and a live upper finish.
  const sneakerParts = useMemo(
    () =>
      configurator
        ? { sole: new THREE.MeshStandardMaterial({ roughness: 0.6 }), laces: new THREE.MeshStandardMaterial({ roughness: 0.8 }) }
        : undefined,
    [configurator],
  );
  const finish = config?.material;
  useLayoutEffect(() => {
    if (!sneakerParts) return;
    sneakerParts.sole.color.set(optionHex("sole") ?? "#f2f0ea");
    sneakerParts.laces.color.set(optionHex("laces") ?? "#f4f1ea");
    // Material choice changes the upper surface, not just its colour.
    primary.map = finish === "leather" ? null : m.textures.fabric;
    primary.roughness = finish === "leather" ? 0.42 : finish === "suede" ? 1 : 0.92;
    primary.metalness = finish === "leather" ? 0.05 : 0;
    primary.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sneakerParts, primary, finish, config?.sole, config?.laces, m]);
  useLayoutEffect(
    () => () => {
      sneakerParts?.sole.dispose();
      sneakerParts?.laces.dispose();
    },
    [sneakerParts],
  );

  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: m.textures.radial,
        color: new THREE.Color("#ffe2b0"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [m],
  );
  useLayoutEffect(() => () => haloMat.dispose(), [haloMat]);

  const meta = PRODUCT_META[product.kind];
  const baseY = floorY(placement.floor);
  const footprint = Math.max(0.35, Math.min(2.6, meta.height * (meta.turntable ? 2.4 : 1.4)));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const lift = selected && meta.turntable ? Math.min(0.06, meta.height * 0.35) : 0;
    g.position.y = THREE.MathUtils.damp(g.position.y, baseY + placement.y + lift, 6, dt);
    const targetYaw = placement.rotY + (selected && meta.turntable ? inspectView.yaw : 0);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetYaw, 8, dt);
    const glow = selected ? 0.5 : focused || hovered.current ? 0.85 : 0;
    haloMat.opacity = THREE.MathUtils.damp(haloMat.opacity, glow, 8, dt);
    if (halo.current) halo.current.visible = haloMat.opacity > 0.01;
  });

  const reachable = () =>
    !input.pointerLocked &&
    player.floor === placement.floor &&
    Math.hypot(player.x - placement.position.x, player.z - placement.position.z) < CLICK_RANGE;

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!reachable()) return;
    hovered.current = true;
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    hovered.current = false;
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!reachable() || input.dragDistance > 6) return;
    if (useExperienceStore.getState().phase !== "explore") return;
    inspectProduct(product.id);
  };

  return (
    <group>
      <mesh
        ref={halo}
        geometry={geo.flat()}
        material={haloMat}
        position={[placement.position.x, baseY + placement.y + 0.004, placement.position.z]}
        scale={[footprint, 1, footprint]}
        renderOrder={4}
        visible={false}
      />
      <group
        ref={group}
        position={[placement.position.x, baseY + placement.y, placement.position.z]}
        rotation={[0, placement.rotY, 0]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <ProductModel
          kind={product.kind}
          primary={primary}
          color={color}
          luxury={product.storeId === "aurelia"}
          sneakerParts={sneakerParts}
          variant={product.id === "umami-matcha-softserve" ? "cone" : undefined}
        />
      </group>
    </group>
  );
}
