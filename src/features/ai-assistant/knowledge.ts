import type { FloorPoint, StoreCategory } from "@/types";
import { STORES, getStore } from "@/data/stores";
import { PRODUCTS, getProduct } from "@/data/products";
import { DESTINATIONS, getDestination } from "@/data/navigation";
import { FLOORS } from "@/data/floors";
import { planRoute } from "@/lib/pathfinding";

/**
 * The assistant's only source of truth: read-only queries over the mall's real data.
 * Used by the server-side Claude tools and by the offline fallback, so neither can
 * invent stores, locations, prices or availability.
 */

export const CATEGORIES: StoreCategory[] = ["fashion", "technology", "gaming", "footwear", "accessories", "home", "food"];

export interface StoreResult {
  id: string;
  name: string;
  category: StoreCategory;
  categoryLabel: string;
  floor: number;
  floorLabel: string;
  tagline: string;
  hours: string;
}

export interface ProductResult {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  floor: number;
  priceUsd: number;
  colors: string[];
  sizes: string[];
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function floorLabel(floor: number) {
  const f = FLOORS[floor];
  return `${f.name} (${f.theme})`;
}

export function storeResult(id: string): StoreResult | null {
  const s = getStore(id);
  if (!s) return null;
  return { id: s.id, name: s.name, category: s.category, categoryLabel: s.categoryLabel, floor: s.floor, floorLabel: floorLabel(s.floor), tagline: s.tagline, hours: s.hours };
}

export function searchStores(q: { query?: string | null; category?: StoreCategory | null; floor?: number | null }): StoreResult[] {
  const query = q.query ? norm(q.query) : "";
  return STORES.filter((s) => {
    if (q.category && s.category !== q.category) return false;
    if (q.floor !== null && q.floor !== undefined && s.floor !== q.floor) return false;
    if (!query) return true;
    const hay = norm(`${s.name} ${s.categoryLabel} ${s.category} ${s.tagline} ${s.description}`);
    return query.split(/\s+/).every((w) => hay.includes(w));
  }).map((s) => storeResult(s.id)!);
}

export function searchProducts(q: {
  query?: string | null;
  storeId?: string | null;
  category?: StoreCategory | null;
  minPriceUsd?: number | null;
  maxPriceUsd?: number | null;
  limit?: number;
}): ProductResult[] {
  const query = q.query ? norm(q.query) : "";
  const out: ProductResult[] = [];
  for (const p of PRODUCTS) {
    const store = getStore(p.storeId)!;
    if (q.storeId && p.storeId !== q.storeId) continue;
    if (q.category && store.category !== q.category) continue;
    const price = p.priceCents / 100;
    if (q.minPriceUsd !== null && q.minPriceUsd !== undefined && price < q.minPriceUsd) continue;
    if (q.maxPriceUsd !== null && q.maxPriceUsd !== undefined && price > q.maxPriceUsd) continue;
    if (query) {
      const hay = norm(`${p.name} ${p.kind} ${p.description} ${p.details.join(" ")} ${store.name} ${store.categoryLabel}`);
      if (!query.split(/\s+/).some((w) => w.length > 2 && hay.includes(w))) continue;
    }
    out.push({
      id: p.id,
      name: p.name,
      storeId: p.storeId,
      storeName: store.name,
      floor: store.floor,
      priceUsd: price,
      colors: p.colors.map((c) => c.label),
      sizes: p.sizes ?? [],
    });
  }
  return out.sort((a, b) => a.priceUsd - b.priceUsd).slice(0, q.limit ?? 8);
}

export interface DirectionsResult {
  destinationId: string;
  label: string;
  floor: number;
  distanceMeters: number;
  steps: string[];
}

export function directions(from: FloorPoint, destinationId: string): DirectionsResult | null {
  const dest = getDestination(destinationId);
  if (!dest) return null;
  const route = planRoute(from, dest.nodeId, dest.label);
  if (!route) return null;
  return {
    destinationId,
    label: dest.label,
    floor: dest.floor,
    distanceMeters: Math.round(route.length),
    steps: route.legs.map((l) => l.instruction),
  };
}

export type Facility = "lift" | "escalator" | "information_desk" | "directory" | "restaurant" | "cafe" | "food_court";

const FACILITY_DESTINATIONS: Record<Facility, string[]> = {
  lift: DESTINATIONS.filter((d) => d.id.startsWith("lift-")).map((d) => d.id),
  escalator: DESTINATIONS.filter((d) => d.id.startsWith("escalator-")).map((d) => d.id),
  information_desk: ["landmark-info"],
  directory: ["landmark-info"],
  restaurant: STORES.filter((s) => s.interior === "restaurant").map((s) => s.id),
  cafe: STORES.filter((s) => s.interior === "cafe").map((s) => s.id),
  food_court: ["landmark-food-court"],
};

/** Nearest facility of a kind by actual walking route, not straight-line distance. */
export function nearestFacility(from: FloorPoint, facility: Facility): DirectionsResult | null {
  let best: DirectionsResult | null = null;
  for (const id of FACILITY_DESTINATIONS[facility] ?? []) {
    const d = directions(from, id);
    if (d && (!best || d.distanceMeters < best.distanceMeters)) best = d;
  }
  return best;
}

export function floorsOverview() {
  return FLOORS.map((f) => ({
    floor: f.index,
    name: f.name,
    theme: f.theme,
    stores: STORES.filter((s) => s.floor === f.index).map((s) => ({ id: s.id, name: s.name, category: s.categoryLabel })),
  }));
}

export function isDestination(id: string) {
  return !!getDestination(id);
}

export function productStore(productId: string) {
  const p = getProduct(productId);
  return p ? getStore(p.storeId) : undefined;
}
