import type { Product } from "@/types";

/**
 * SAMPLE CATALOGUE — demonstration data only.
 *
 * Prices, names and descriptions are fictional and exist to drive the in-mall shopping
 * experience. There is no inventory, payment or fulfilment system behind them; the cart
 * is a client-side demo (see `stores/useCartStore.ts`).
 */
export const PRODUCTS: readonly Product[] = [
  // ── Lumen (electronics) ────────────────────────────────────────────────
  {
    id: "lumen-aero-phone",
    storeId: "lumen",
    name: "Aero 9 Phone",
    priceCents: 89900,
    kind: "phone",
    description: "A 6.3\" edge-to-edge OLED phone milled from a single block of recycled aluminium.",
    details: ["6.3\" 120 Hz OLED", "Triple 48 MP camera", "Two-day battery", "Recycled aluminium frame"],
    colors: [
      { id: "glacier", label: "Glacier", hex: "#c9d6e3" },
      { id: "graphite", label: "Graphite", hex: "#3a3d42" },
      { id: "sage", label: "Sage", hex: "#a9b8a2" },
    ],
    sizes: ["128 GB", "256 GB", "512 GB"],
  },
  {
    id: "lumen-slate-laptop",
    storeId: "lumen",
    name: "Slate 14 Laptop",
    priceCents: 149900,
    kind: "laptop",
    description: "A 1.2 kg creative laptop with a colour-calibrated 14\" display and an all-day battery.",
    details: ["14\" 3K calibrated display", "32 GB unified memory", "18-hour battery", "Fanless chassis"],
    colors: [
      { id: "silver", label: "Silver", hex: "#d3d6da" },
      { id: "midnight", label: "Midnight", hex: "#2b2f38" },
    ],
    sizes: ["512 GB", "1 TB", "2 TB"],
  },
  {
    id: "lumen-halo-headphones",
    storeId: "lumen",
    name: "Halo Over-Ear Headphones",
    priceCents: 34900,
    kind: "headphones",
    description: "Adaptive noise cancelling with memory-foam cushions wrapped in protein leather.",
    details: ["Adaptive ANC", "40-hour battery", "Spatial audio", "Foldable aluminium yoke"],
    colors: [
      { id: "chalk", label: "Chalk", hex: "#e8e4dc" },
      { id: "ink", label: "Ink", hex: "#23252b" },
      { id: "mist", label: "Mist Blue", hex: "#9fb4cc" },
    ],
  },
  {
    id: "lumen-orbit-watch",
    storeId: "lumen",
    name: "Orbit Watch",
    priceCents: 42900,
    kind: "watch",
    description: "A titanium smartwatch with a sapphire face and fully round always-on display.",
    details: ["Titanium case", "Sapphire crystal", "ECG & SpO₂ sensors", "Water resistant 50 m"],
    colors: [
      { id: "natural", label: "Natural Titanium", hex: "#b9b4ab" },
      { id: "black", label: "Black Titanium", hex: "#2c2c2e" },
    ],
    sizes: ["41 mm", "45 mm"],
  },
  {
    id: "lumen-pillar-speaker",
    storeId: "lumen",
    name: "Pillar Home Speaker",
    priceCents: 27900,
    kind: "speaker",
    description: "360° room-filling sound in a knitted acoustic sleeve, with room-aware tuning.",
    details: ["360° sound", "Room-aware tuning", "Multi-room ready", "Knitted acoustic sleeve"],
    colors: [
      { id: "oat", label: "Oat", hex: "#d8cdbb" },
      { id: "charcoal", label: "Charcoal", hex: "#3d3d3f" },
    ],
  },
  {
    id: "lumen-canvas-tablet",
    storeId: "lumen",
    name: "Canvas 12 Tablet",
    priceCents: 79900,
    kind: "tablet",
    description: "A 12.4\" drawing tablet with paper-feel glass and a magnetic pencil.",
    details: ["12.4\" paper-feel display", "Pencil included", "USB-C 40 Gb/s", "5G optional"],
    colors: [
      { id: "silver", label: "Silver", hex: "#d6d8db" },
      { id: "graphite", label: "Graphite", hex: "#3a3d42" },
    ],
    sizes: ["256 GB", "512 GB"],
  },

  // ── Maison Élan (fashion) ─────────────────────────────────────────────
  {
    id: "elan-wool-coat",
    storeId: "maison-elan",
    name: "Double-Faced Wool Coat",
    priceCents: 89000,
    kind: "coat",
    description: "An unlined, double-faced wool and cashmere coat with a softly dropped shoulder.",
    details: ["80% wool, 20% cashmere", "Hand-finished seams", "Made in Portugal", "Dry clean only"],
    colors: [
      { id: "camel", label: "Camel", hex: "#b48a5e" },
      { id: "ivory", label: "Ivory", hex: "#e9e2d4" },
      { id: "ink", label: "Ink", hex: "#262a33" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    id: "elan-silk-dress",
    storeId: "maison-elan",
    name: "Bias-Cut Silk Dress",
    priceCents: 64000,
    kind: "dress",
    description: "A fluid midi dress cut on the bias from heavyweight sand-washed silk.",
    details: ["100% mulberry silk", "Bias cut", "Midi length", "Concealed side zip"],
    colors: [
      { id: "sand", label: "Sand", hex: "#cdb79a" },
      { id: "olive", label: "Olive", hex: "#6f6b4a" },
      { id: "noir", label: "Noir", hex: "#1f1e1d" },
    ],
    sizes: ["XS", "S", "M", "L"],
  },
  {
    id: "elan-cashmere-knit",
    storeId: "maison-elan",
    name: "Cashmere Crew Knit",
    priceCents: 38000,
    kind: "knit",
    description: "A relaxed crew-neck in two-ply Mongolian cashmere, finished with ribbed cuffs.",
    details: ["100% cashmere, 2-ply", "Relaxed fit", "Ribbed trims", "Hand wash cold"],
    colors: [
      { id: "oatmeal", label: "Oatmeal", hex: "#d6c8b2" },
      { id: "forest", label: "Forest", hex: "#3d4f3e" },
      { id: "rust", label: "Rust", hex: "#a2573a" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    id: "elan-trench",
    storeId: "maison-elan",
    name: "Cotton Gabardine Trench",
    priceCents: 72000,
    kind: "coat",
    description: "A modern trench with a storm flap and horn buttons in water-repellent gabardine.",
    details: ["Water-repellent cotton", "Horn buttons", "Detachable belt", "Regular fit"],
    colors: [
      { id: "stone", label: "Stone", hex: "#c8b89a" },
      { id: "navy", label: "Navy", hex: "#2b3346" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },

  // ── Aurelia (luxury accessories) ──────────────────────────────────────
  {
    id: "aurelia-arc-bag",
    storeId: "aurelia",
    name: "Arc Top-Handle Bag",
    priceCents: 245000,
    kind: "handbag",
    description: "A structured top-handle bag in grained calfskin with a brushed-brass arc clasp.",
    details: ["Grained calfskin", "Brushed brass hardware", "Suede lining", "Detachable strap"],
    colors: [
      { id: "cognac", label: "Cognac", hex: "#8a4f2a" },
      { id: "black", label: "Black", hex: "#1c1a19" },
      { id: "bone", label: "Bone", hex: "#e2d7c3" },
    ],
  },
  {
    id: "aurelia-meridian-watch",
    storeId: "aurelia",
    name: "Meridian Automatic",
    priceCents: 398000,
    kind: "watch",
    description: "A 38 mm automatic with a sunray dial, gold-tone case and hand-stitched strap.",
    details: ["Automatic movement", "Sapphire crystal", "Exhibition caseback", "38 mm case"],
    colors: [
      { id: "gold", label: "Gold Tone", hex: "#c9a35f" },
      { id: "steel", label: "Steel", hex: "#b7b9bc" },
    ],
  },
  {
    id: "aurelia-solstice-necklace",
    storeId: "aurelia",
    name: "Solstice Pendant",
    priceCents: 128000,
    kind: "necklace",
    description: "A hand-polished 18k gold vermeil pendant on a fine cable chain.",
    details: ["18k gold vermeil", "45 cm chain", "Hand polished", "Gift boxed"],
    colors: [
      { id: "gold", label: "Yellow Gold", hex: "#d4af61" },
      { id: "rose", label: "Rose Gold", hex: "#c8907a" },
    ],
  },
  {
    id: "aurelia-noon-sunglasses",
    storeId: "aurelia",
    name: "Noon Sunglasses",
    priceCents: 42000,
    kind: "sunglasses",
    description: "Hand-made acetate frames with polarised mineral lenses and a keyhole bridge.",
    details: ["Italian acetate", "Polarised mineral lenses", "UV400", "Leather case"],
    colors: [
      { id: "tortoise", label: "Tortoise", hex: "#6b4024" },
      { id: "black", label: "Black", hex: "#151515" },
    ],
  },
  {
    id: "aurelia-ambre-perfume",
    storeId: "aurelia",
    name: "Ambre Nuit Eau de Parfum",
    priceCents: 21500,
    kind: "perfume",
    description: "Amber, smoked vanilla and iris in a hand-cut glass flacon.",
    details: ["100 ml Eau de Parfum", "Notes: amber, vanilla, iris", "Refillable flacon"],
    colors: [{ id: "amber", label: "Amber", hex: "#c98a3c" }],
    sizes: ["50 ml", "100 ml"],
  },

  // ── Stride Atelier (sneakers) ─────────────────────────────────────────
  {
    id: "stride-arc-runner",
    storeId: "stride",
    name: "Arc Runner",
    priceCents: 19000,
    kind: "sneaker",
    description: "A featherweight runner with a sculpted foam midsole and recycled knit upper.",
    details: ["Recycled knit upper", "Responsive foam", "212 g (UK 8)", "Rubber traction pods"],
    colors: [
      { id: "bone", label: "Bone", hex: "#e6dfd2" },
      { id: "onyx", label: "Onyx", hex: "#222222" },
      { id: "clay", label: "Clay", hex: "#b77757" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
  },
  {
    id: "stride-court-low",
    storeId: "stride",
    name: "Court Low Leather",
    priceCents: 17500,
    kind: "sneaker",
    description: "A clean tennis-inspired low-top in full-grain leather with a cup sole.",
    details: ["Full-grain leather", "Stitched cup sole", "Cork footbed", "Made in Portugal"],
    colors: [
      { id: "white", label: "White", hex: "#f2f0ea" },
      { id: "black", label: "Black", hex: "#1d1d1d" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
  },
  {
    id: "stride-trail-mid",
    storeId: "stride",
    name: "Trail Mid GTX",
    priceCents: 22500,
    kind: "sneaker",
    description: "A waterproof mid-top for city and trail with a lugged outsole.",
    details: ["Waterproof membrane", "Lugged outsole", "Suede overlays", "Speed-lace system"],
    colors: [
      { id: "moss", label: "Moss", hex: "#6c7356" },
      { id: "sand", label: "Sand", hex: "#c3ab86" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
  },
  {
    id: "stride-slip-on",
    storeId: "stride",
    name: "Canvas Slip-On",
    priceCents: 9500,
    kind: "sneaker",
    description: "An easy slip-on in heavyweight organic canvas with a vulcanised sole.",
    details: ["Organic canvas", "Vulcanised sole", "Padded collar", "Machine washable"],
    colors: [
      { id: "ecru", label: "Ecru", hex: "#ddd4c0" },
      { id: "slate", label: "Slate", hex: "#5d6670" },
    ],
    sizes: ["UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
  },

  // ── Casa Linea (furniture & home) ─────────────────────────────────────
  {
    id: "casa-curve-sofa",
    storeId: "casa-linea",
    name: "Curve Three-Seater Sofa",
    priceCents: 329000,
    kind: "sofa",
    description: "A low, generously curved sofa upholstered in removable bouclé.",
    details: ["Kiln-dried oak frame", "Removable bouclé cover", "W 228 × D 96 × H 72 cm", "10-year frame warranty"],
    colors: [
      { id: "cream", label: "Cream Bouclé", hex: "#e6ddcd" },
      { id: "moss", label: "Moss", hex: "#7c8467" },
      { id: "terracotta", label: "Terracotta", hex: "#b06c4c" },
    ],
  },
  {
    id: "casa-lounge-chair",
    storeId: "casa-linea",
    name: "Oak Lounge Chair",
    priceCents: 118000,
    kind: "lounge-chair",
    description: "A solid oak lounge chair with a woven paper-cord seat and loose cushion.",
    details: ["Solid white oak", "Paper-cord seat", "Linen cushion", "Hand-finished oil"],
    colors: [
      { id: "natural", label: "Natural Oak", hex: "#c79e6e" },
      { id: "smoked", label: "Smoked Oak", hex: "#5e4532" },
    ],
  },
  {
    id: "casa-arc-lamp",
    storeId: "casa-linea",
    name: "Arc Floor Lamp",
    priceCents: 56000,
    kind: "floor-lamp",
    description: "A sweeping brass floor lamp with a hand-blown opal glass shade.",
    details: ["Brushed brass", "Opal glass shade", "Dimmable", "Marble base"],
    colors: [
      { id: "brass", label: "Brass", hex: "#b8925a" },
      { id: "black", label: "Matte Black", hex: "#262626" },
    ],
  },
  {
    id: "casa-ceramic-vase",
    storeId: "casa-linea",
    name: "Stoneware Vessel",
    priceCents: 14500,
    kind: "vase",
    description: "A hand-thrown stoneware vessel with a speckled matte glaze. Each piece is unique.",
    details: ["Hand-thrown stoneware", "Speckled matte glaze", "H 38 cm", "Watertight"],
    colors: [
      { id: "sand", label: "Sand", hex: "#d9c8ad" },
      { id: "charcoal", label: "Charcoal", hex: "#45413c" },
      { id: "sage", label: "Sage", hex: "#9aa58c" },
    ],
  },

  // ── Atrium Roasters (coffee) ──────────────────────────────────────────
  {
    id: "roasters-house-blend",
    storeId: "atrium-roasters",
    name: "Atrium House Blend, 250 g",
    priceCents: 1800,
    kind: "coffee-bag",
    description: "Chocolate, toasted hazelnut and red apple. Our everyday espresso, roasted in-house weekly.",
    details: ["Brazil & Ethiopia", "Medium roast", "Notes: cocoa, hazelnut, apple", "Roasted weekly"],
    colors: [{ id: "kraft", label: "Kraft", hex: "#b48b5e" }],
    sizes: ["Whole bean", "Espresso grind", "Filter grind"],
  },
  {
    id: "roasters-ceramic-mug",
    storeId: "atrium-roasters",
    name: "Speckled Ceramic Cup",
    priceCents: 2600,
    kind: "mug",
    description: "A 240 ml hand-glazed stoneware cup made by a local ceramicist.",
    details: ["240 ml", "Hand-glazed stoneware", "Dishwasher safe"],
    colors: [
      { id: "cream", label: "Cream", hex: "#ece4d6" },
      { id: "clay", label: "Clay", hex: "#b4704f" },
      { id: "ink", label: "Ink", hex: "#2e3238" },
    ],
  },
  {
    id: "roasters-home-espresso",
    storeId: "atrium-roasters",
    name: "Studio Home Espresso Machine",
    priceCents: 129000,
    kind: "espresso-machine",
    description: "A dual-boiler home espresso machine with PID temperature control and a steam wand.",
    details: ["Dual boiler", "PID control", "58 mm portafilter", "Stainless steel body"],
    colors: [
      { id: "steel", label: "Brushed Steel", hex: "#c4c6c8" },
      { id: "cream", label: "Cream", hex: "#e8e0d0" },
    ],
  },

  // ── Pixel Forge (gaming, Level 2) ──────────────────────────────────────
  {
    id: "pixel-nebula-console",
    storeId: "pixel-forge",
    name: "Nebula X Console",
    priceCents: 49900,
    kind: "console",
    description: "A quiet, vertical 4K console with a 2 TB SSD and instant resume across eight games.",
    details: ["4K / 120 Hz output", "2 TB NVMe SSD", "Ray-traced lighting", "Whisper-quiet cooling"],
    colors: [
      { id: "arctic", label: "Arctic", hex: "#e9ecef" },
      { id: "carbon", label: "Carbon", hex: "#2b2e33" },
    ],
    sizes: ["Standard", "Digital"],
    sizeLabel: "Edition",
  },
  {
    id: "pixel-pulse-controller",
    storeId: "pixel-forge",
    name: "Pulse Pro Controller",
    priceCents: 6900,
    kind: "controller",
    description: "Hall-effect sticks, adaptive triggers and swappable back paddles in a balanced shell.",
    details: ["Hall-effect sticks", "Adaptive triggers", "Four back paddles", "40-hour battery"],
    colors: [
      { id: "mint", label: "Mint", hex: "#9fd8c8" },
      { id: "carbon", label: "Carbon", hex: "#2b2e33" },
      { id: "coral", label: "Coral", hex: "#ef8a6f" },
    ],
  },
  {
    id: "pixel-echo-headset",
    storeId: "pixel-forge",
    name: "Echo Wireless Headset",
    priceCents: 12900,
    kind: "headphones",
    description: "Low-latency wireless audio with a detachable boom mic and spatial sound.",
    details: ["2.4 GHz + Bluetooth", "Detachable boom mic", "Spatial audio", "30-hour battery"],
    colors: [
      { id: "carbon", label: "Carbon", hex: "#2b2e33" },
      { id: "arctic", label: "Arctic", hex: "#e9ecef" },
    ],
  },
  {
    id: "pixel-drift-handheld",
    storeId: "pixel-forge",
    name: "Drift Handheld",
    priceCents: 39900,
    kind: "handheld",
    description: "A 7\" OLED handheld PC that plays your library anywhere and docks to the TV.",
    details: ["7\" 90 Hz OLED", "512 GB storage", "Dock-ready USB-C", "Trackpads + gyro"],
    colors: [
      { id: "carbon", label: "Carbon", hex: "#2b2e33" },
      { id: "glacier", label: "Glacier", hex: "#cfdbe6" },
    ],
  },

  // ── Saffron Table (restaurant, Level 3) ───────────────────────────────
  {
    id: "saffron-lamb-tagine",
    storeId: "saffron-table",
    name: "Lamb & Apricot Tagine",
    priceCents: 2400,
    kind: "bowl",
    description: "Lamb shoulder slow-cooked with apricots, saffron and toasted almonds. Served with herbed couscous.",
    details: ["Order ahead, collect at the pass", "Contains nuts", "Serves one"],
    colors: [{ id: "classic", label: "Classic", hex: "#b4643a" }],
    sizes: ["Regular", "Sharing"],
    sizeLabel: "Portion",
  },
  {
    id: "saffron-mezze-platter",
    storeId: "saffron-table",
    name: "Mezze Platter",
    priceCents: 1800,
    kind: "plate",
    description: "Hummus, smoky baba ghanoush, tabbouleh, falafel and warm flatbread.",
    details: ["Vegetarian", "Contains sesame and gluten", "Serves two"],
    colors: [{ id: "classic", label: "Classic", hex: "#d9b46a" }],
  },
  {
    id: "saffron-pistachio-cake",
    storeId: "saffron-table",
    name: "Rosewater Pistachio Cake",
    priceCents: 900,
    kind: "dessert",
    description: "A moist semolina cake soaked in rosewater syrup and finished with crushed pistachios.",
    details: ["Contains nuts, gluten and dairy", "Baked daily"],
    colors: [{ id: "classic", label: "Classic", hex: "#a8c27a" }],
  },

  // ── Umami Street (restaurant, Level 3) ────────────────────────────────
  {
    id: "umami-tonkotsu-ramen",
    storeId: "umami-street",
    name: "Tonkotsu Ramen",
    priceCents: 1600,
    kind: "bowl",
    description: "An eighteen-hour pork broth with chashu, a marinated egg and fresh wheat noodles.",
    details: ["Order ahead, collect at the counter", "Contains gluten, egg and soy"],
    colors: [{ id: "classic", label: "Classic", hex: "#e8cf9a" }],
    sizes: ["Regular", "Large"],
    sizeLabel: "Portion",
  },
  {
    id: "umami-gyoza",
    storeId: "umami-street",
    name: "Pan-Fried Gyoza (6)",
    priceCents: 800,
    kind: "plate",
    description: "Hand-folded pork and cabbage dumplings with a crisp lattice skirt and ponzu.",
    details: ["Six pieces", "Contains gluten and soy"],
    colors: [{ id: "classic", label: "Classic", hex: "#d7a65d" }],
  },
  {
    id: "umami-matcha-softserve",
    storeId: "umami-street",
    name: "Matcha Soft Serve",
    priceCents: 600,
    kind: "dessert",
    description: "Ceremonial-grade matcha soft serve in a crisp cone.",
    details: ["Contains dairy and gluten", "Vegetarian"],
    colors: [{ id: "classic", label: "Classic", hex: "#9cc27a" }],
  },];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product | undefined {
  return BY_ID.get(id);
}

export function getStoreProducts(storeId: string): Product[] {
  return PRODUCTS.filter((p) => p.storeId === storeId);
}
