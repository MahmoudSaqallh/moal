/** Vertical structure of the mall: three stacked levels in one coordinate system. */

export const FLOOR_HEIGHT = 7.05;
/** Underside of each level's ceiling slab, above that level's floor. */
export const CEILING_HEIGHT = 6.5;
export const SLAB_THICKNESS = FLOOR_HEIGHT - CEILING_HEIGHT;

export interface FloorInfo {
  index: number;
  /** Short label used on buttons and the floor indicator. */
  label: string;
  name: string;
  theme: string;
}

export const FLOORS: readonly FloorInfo[] = [
  { index: 0, label: "L1", name: "Level 1", theme: "Fashion & Lifestyle" },
  { index: 1, label: "L2", name: "Level 2", theme: "Technology & Entertainment" },
  { index: 2, label: "L3", name: "Level 3", theme: "Food & Leisure" },
];

export const FLOOR_COUNT = FLOORS.length;
/** Roof underside over the triple-height atrium and wing voids. */
export const ROOF_HEIGHT = FLOOR_HEIGHT * FLOOR_COUNT;

export function floorY(floor: number): number {
  return floor * FLOOR_HEIGHT;
}

export function isValidFloor(floor: number): boolean {
  return Number.isInteger(floor) && floor >= 0 && floor < FLOOR_COUNT;
}
