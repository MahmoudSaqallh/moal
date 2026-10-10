import { DIMENSIONS } from "@/data/layout";
import { CEILING_HEIGHT, FLOOR_HEIGHT, ROOF_HEIGHT, SLAB_THICKNESS } from "@/data/floors";

/** Vertical datums shared by every architectural component. */
export const H = FLOOR_HEIGHT;
export const G = CEILING_HEIGHT; // underside of a level's ceiling slab, relative to that level
export const SLAB = SLAB_THICKNESS;
export const GT = G + SLAB; // = FLOOR_HEIGHT: walking level of the next storey
export const WING_ROOF = DIMENSIONS.wingRoof;
export const ATRIUM_ROOF = ROOF_HEIGHT;
export const ENTRANCE_CEILING = 12;
