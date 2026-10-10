import type { ProductKind } from "@/types";

export interface ProductMeta {
  /** Approximate height in metres, used to aim the focus camera at the product's centre. */
  height: number;
  /** Small goods can be turned on a virtual turntable; floor pieces are orbited instead. */
  turntable: boolean;
}

export const PRODUCT_META: Record<ProductKind, ProductMeta> = {
  phone: { height: 0.17, turntable: true },
  laptop: { height: 0.22, turntable: true },
  headphones: { height: 0.36, turntable: true },
  watch: { height: 0.08, turntable: true },
  speaker: { height: 0.22, turntable: true },
  tablet: { height: 0.22, turntable: true },
  sneaker: { height: 0.12, turntable: true },
  handbag: { height: 0.36, turntable: true },
  sunglasses: { height: 0.1, turntable: true },
  necklace: { height: 0.3, turntable: true },
  perfume: { height: 0.16, turntable: true },
  coat: { height: 1.75, turntable: false },
  dress: { height: 1.75, turntable: false },
  knit: { height: 0.2, turntable: true },
  "lounge-chair": { height: 0.8, turntable: false },
  "floor-lamp": { height: 1.9, turntable: false },
  vase: { height: 0.38, turntable: true },
  sofa: { height: 0.75, turntable: false },
  "coffee-bag": { height: 0.24, turntable: true },
  mug: { height: 0.1, turntable: true },
  "espresso-machine": { height: 0.42, turntable: true },
  console: { height: 0.36, turntable: true },
  controller: { height: 0.08, turntable: true },
  handheld: { height: 0.14, turntable: true },
  bowl: { height: 0.12, turntable: true },
  plate: { height: 0.08, turntable: true },
  dessert: { height: 0.16, turntable: true },
};
