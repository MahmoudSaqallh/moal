/**
 * Shared domain types for MallVerse.
 *
 * World coordinates are metres. The mall sits on the XZ plane with +Y up and three
 * stacked levels (floor index 0..2, one `FLOOR_HEIGHT` apart).
 * "North" is -Z (towards the courts), "South" is +Z (towards the entrance plaza),
 * "East" is +X, "West" is -X.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/** A position on a specific level. */
export interface FloorPoint extends Vec2 {
  floor: number;
}

/** A route vertex in 3D (y follows the floor, or the incline while riding). */
export interface RoutePoint extends FloorPoint {
  y: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Outward normal of a storefront, i.e. the direction a visitor in the corridor looks *from*. */
export type Facing = "north" | "south" | "east" | "west";

export type StoreCategory = "fashion" | "technology" | "gaming" | "footwear" | "accessories" | "home" | "food";

export interface Zone {
  id: string;
  name: string;
  /** Short subtitle for the HUD location chip. */
  subtitle: string;
  rect: Rect;
  floor: number;
  kind: "public" | "store";
  storeId?: string;
}

export type FacadeStyle =
  | "stone-fins" // white stone with vertical fins + display niche (luxury fashion)
  | "white-halo" // seamless white with halo lighting (electronics)
  | "plaster-curve" // warm plaster with an arched portal (sneakers)
  | "bronze-mirror" // dark bronze + mirror cladding (accessories)
  | "oak-frame" // light oak frame with deep window boxes (home)
  | "cafe-awning" // terrazzo + timber slats (coffee)
  | "graphite-grid" // dark graphite with a lit grid (gaming)
  | "terracotta-arch"; // warm terracotta with timber screens (restaurants)

export type InteriorKind = "lumen" | "boutique" | "jewel" | "sneaker" | "showroom" | "cafe" | "arcade" | "restaurant";

export type FloorFinish = "marble" | "oak" | "herringbone" | "concrete" | "terrazzo" | "dark-stone";

export interface StoreTheme {
  facade: FacadeStyle;
  /** Main facade surface colour. */
  primary: string;
  /** Secondary trim colour (frames, mullions). */
  secondary: string;
  /** Accent used in signage glow, map and UI chips. */
  accent: string;
  /** Sign letter colour. */
  sign: string;
  signFont: "serif" | "sans" | "display";
  floor: FloorFinish;
  /** Interior wall tint. */
  wall: string;
  /** Interior light colour temperature. */
  light: "warm" | "neutral" | "cool";
}

export interface StoreConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: StoreCategory;
  categoryLabel: string;
  /** Level index (0 = ground). */
  floor: number;
  /** Public zone the shopfront opens onto (floor-local id). */
  zone: string;
  /** Centre of the facade line on the floor, world space. */
  origin: Vec2;
  facing: Facing;
  /** Facade width (local X). */
  width: number;
  /** Interior depth behind the facade (local -Z). */
  depth: number;
  /** Interior ceiling height above its floor. */
  height: number;
  doorWidth: number;
  theme: StoreTheme;
  interior: InteriorKind;
  hours: string;
}

export type ProductKind =
  | "phone"
  | "laptop"
  | "headphones"
  | "watch"
  | "speaker"
  | "tablet"
  | "sneaker"
  | "handbag"
  | "sunglasses"
  | "necklace"
  | "perfume"
  | "coat"
  | "dress"
  | "knit"
  | "lounge-chair"
  | "floor-lamp"
  | "vase"
  | "sofa"
  | "coffee-bag"
  | "mug"
  | "espresso-machine"
  | "console"
  | "controller"
  | "handheld"
  | "bowl"
  | "plate"
  | "dessert";

export interface ColorVariant {
  id: string;
  label: string;
  /** Hex colour applied live to the 3D model's primary material. */
  hex: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  /** Price in minor units (cents) to avoid floating point currency maths. */
  priceCents: number;
  description: string;
  details: string[];
  kind: ProductKind;
  colors: ColorVariant[];
  sizes?: string[];
  /** Label for the size option group (defaults to "Size"). */
  sizeLabel?: string;
}

/** A place where a product sits inside a store, in store-local coordinates. */
export interface ProductSlot {
  productId: string;
  x: number;
  y: number;
  z: number;
  /** Local yaw of the product model. */
  rotY: number;
  /** Local yaw of the direction a shopper views the product from (camera side). */
  viewYaw: number;
  /** Camera distance for focus view. */
  viewDistance: number;
  scale?: number;
}

/** A blocking fixture inside a store, in store-local coordinates. */
export type LocalObstacle =
  | { type: "circle"; x: number; z: number; r: number }
  | { type: "rect"; minX: number; maxX: number; minZ: number; maxZ: number };

export type InteractableKind = "enter-store" | "exit-store" | "directory" | "product" | "call-elevator";

export interface Interactable {
  id: string;
  kind: InteractableKind;
  label: string;
  /** Verb shown in the prompt, e.g. "Enter", "Inspect". */
  verb: string;
  position: Vec2;
  floor: number;
  /** Height above the floor of the interaction point, used for view-direction scoring. */
  y: number;
  range: number;
  storeId?: string;
  productId?: string;
}

/** How a nav edge is travelled: on foot, by escalator lane, or by lift. */
export type Transit =
  | { type: "walk" }
  | { type: "escalator"; escalatorId: string; direction: "up" | "down" }
  | { type: "elevator"; toFloor: number };

export interface NavNode {
  id: string;
  position: Vec2;
  floor: number;
  /** Optional human label when the node is a destination. */
  label?: string;
}

export interface NavEdge {
  from: string;
  to: string;
  transit: Transit;
  /** Walk edges are bidirectional; transit edges are directed. */
  bidirectional: boolean;
}

export type QualityPreset = "low" | "medium" | "high";

export type LightingMode = "day" | "evening" | "night";

export type ExperiencePhase =
  | "loading" // assets/shaders being prepared
  | "intro" // cinematic exterior, waiting for "Enter the mall"
  | "avatar" // choosing / customising the avatar before entering
  | "entering" // camera flying through the entrance
  | "explore" // free third-person navigation
  | "inspect"; // camera focused on a product

export interface Destination {
  id: string;
  label: string;
  /** Nav node that represents arrival. */
  nodeId: string;
  floor: number;
  /** Where the visitor should face when they arrive. */
  lookAt: Vec2;
  storeId?: string;
  kind: "store" | "landmark" | "transport";
}

/** One leg of a planned route. */
export interface RouteLeg {
  transit: Transit;
  /** Points to traverse (world, with heights). */
  points: RoutePoint[];
  /** Instruction shown while this leg is active. */
  instruction: string;
}

export interface Route {
  destinationId: string;
  label: string;
  legs: RouteLeg[];
  /** Total walking-equivalent length in metres. */
  length: number;
}

// ─── Avatars ────────────────────────────────────────────────────────────

export type AvatarBody = "slim" | "regular" | "broad";
export type AvatarHair = "short" | "bob" | "bun" | "curly" | "long" | "buzz";
export type AvatarTop = "tee" | "jacket" | "hoodie" | "dress";
export type AvatarAccessory = "none" | "glasses" | "cap" | "backpack" | "tote";

export interface AvatarAppearance {
  body: AvatarBody;
  /** Overall height multiplier (0.92 – 1.08). */
  height: number;
  skin: string;
  hair: AvatarHair;
  hairColor: string;
  top: AvatarTop;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  accessory: AvatarAccessory;
}
