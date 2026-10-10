/**
 * 3D product configurators (sample data). Each part maps to a named material slot on the
 * product's 3D model; choices update the model live and travel with the cart line.
 */

export interface ConfigOption {
  id: string;
  label: string;
  /** Colour for colour parts. */
  hex?: string;
  /** Surface description for material parts (shown when inspecting the material). */
  note?: string;
  priceDeltaCents?: number;
}

export interface ConfigPart {
  id: string;
  label: string;
  kind: "color" | "material";
  options: ConfigOption[];
}

export interface Configurator {
  productId: string;
  parts: ConfigPart[];
}

export const CONFIGURATORS: readonly Configurator[] = [
  {
    productId: "stride-arc-runner",
    parts: [
      {
        id: "upper",
        label: "Upper",
        kind: "color",
        options: [
          { id: "bone", label: "Bone", hex: "#e6dfd2" },
          { id: "onyx", label: "Onyx", hex: "#222222" },
          { id: "clay", label: "Clay", hex: "#b77757" },
          { id: "sage", label: "Sage", hex: "#9aa58c" },
          { id: "cobalt", label: "Cobalt", hex: "#2c4a6b" },
        ],
      },
      {
        id: "material",
        label: "Upper material",
        kind: "material",
        options: [
          { id: "knit", label: "Recycled knit", note: "Breathable engineered knit, 62% recycled polyester." },
          { id: "leather", label: "Full-grain leather", note: "Smooth full-grain leather with a waxed finish.", priceDeltaCents: 2000 },
          { id: "suede", label: "Suede", note: "Brushed suede with a soft nap; water-repellent treatment.", priceDeltaCents: 1500 },
        ],
      },
      {
        id: "sole",
        label: "Sole",
        kind: "color",
        options: [
          { id: "white", label: "White", hex: "#f2f0ea" },
          { id: "gum", label: "Gum", hex: "#b8864f" },
          { id: "black", label: "Black", hex: "#1d1d1d" },
        ],
      },
      {
        id: "laces",
        label: "Laces",
        kind: "color",
        options: [
          { id: "white", label: "White", hex: "#f4f1ea" },
          { id: "black", label: "Black", hex: "#1b1b1b" },
          { id: "clay", label: "Clay", hex: "#c96f4a" },
        ],
      },
    ],
  },
];

export function getConfigurator(productId: string): Configurator | undefined {
  return CONFIGURATORS.find((c) => c.productId === productId);
}

export function defaultConfiguration(c: Configurator): Record<string, string> {
  return Object.fromEntries(c.parts.map((p) => [p.id, p.options[0].id]));
}

/** Accept only known parts/options; returns null when anything is invalid or missing. */
export function validateConfiguration(productId: string, options: Record<string, string> | undefined): Record<string, string> | null {
  const c = getConfigurator(productId);
  if (!c) return options && Object.keys(options).length ? null : {};
  if (!options) return null;
  const out: Record<string, string> = {};
  for (const part of c.parts) {
    const v = options[part.id];
    if (!part.options.some((o) => o.id === v)) return null;
    out[part.id] = v;
  }
  return out;
}

export function configurationDeltaCents(productId: string, options: Record<string, string> | undefined): number {
  const c = getConfigurator(productId);
  if (!c || !options) return 0;
  return c.parts.reduce((sum, part) => sum + (part.options.find((o) => o.id === options[part.id])?.priceDeltaCents ?? 0), 0);
}

export function describeConfiguration(productId: string, options: Record<string, string> | undefined): string {
  const c = getConfigurator(productId);
  if (!c || !options) return "";
  return c.parts.map((p) => p.options.find((o) => o.id === options[p.id])?.label).filter(Boolean).join(" · ");
}
