import * as THREE from "three";

/**
 * Procedural texture painters.
 *
 * No bitmap assets ship with the mall: every surface texture is painted once into a
 * canvas at load time (deterministically seeded), uploaded to the GPU with mipmaps and
 * shared by every material that needs it. This keeps the download tiny while avoiding
 * flat, untextured surfaces.
 */

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number, h = size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

export function toTexture(c: HTMLCanvasElement, opts: { repeat?: boolean; color?: boolean; anisotropy?: number } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (opts.color !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = opts.anisotropy ?? 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, size: number, rand: () => number, count: number, colors: string[], min: number, max: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const r = min + rand() * (max - min);
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, r, r * (0.55 + rand() * 0.45), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Soft low-frequency mottling so large surfaces never look perfectly flat. */
function cloud(ctx: CanvasRenderingContext2D, size: number, rand: () => number, tint: string, count: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.08 + rand() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tint);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    // Draw wrapped copies so the texture tiles seamlessly.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) ctx.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
  }
  ctx.restore();
}

function veins(ctx: CanvasRenderingContext2D, size: number, rand: () => number, color: string, count: number, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    let x = rand() * size;
    let y = rand() * size;
    let angle = rand() * Math.PI * 2;
    ctx.lineWidth = width * (0.3 + rand());
    ctx.globalAlpha = 0.18 + rand() * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 30 + Math.floor(rand() * 50);
    for (let s = 0; s < steps; s++) {
      angle += (rand() - 0.5) * 0.7;
      x += Math.cos(angle) * size * 0.012;
      y += Math.sin(angle) * size * 0.012;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Polished marble floor in large-format tiles (warm grey-beige, after the luxury
 * storefront reference). One texture repeat = 2.4 m: 2 × 4 tiles of 1.2 × 0.6 m, staggered.
 */
export function paintMarble(size: number, seed = 7, base = "#d8d0c4", vein = "#9d9384", highlights = true) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  cloud(ctx, size, rand, "rgba(255,250,240,0.9)", 18, 0.35);
  cloud(ctx, size, rand, "rgba(150,138,120,0.8)", 14, 0.18);
  veins(ctx, size, rand, vein, 26, size / 400);
  if (highlights) veins(ctx, size, rand, "#ffffff", 14, size / 600);
  // Per-tile tonal variation + seams.
  const cols = 2;
  const rows = 4;
  const tw = size / cols;
  const th = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? tw / 2 : 0;
    for (let col = -1; col < cols; col++) {
      const x = col * tw + offset;
      ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(60,50,40,0.04)";
      ctx.fillRect(x, r * th, tw, th);
      ctx.fillStyle = "rgba(70,62,52,0.35)";
      ctx.fillRect(x, r * th, Math.max(1, size / 700), th);
    }
    ctx.fillStyle = "rgba(70,62,52,0.35)";
    ctx.fillRect(0, r * th, size, Math.max(1, size / 700));
  }
  return c;
}

/** Cream terrazzo with stone chips (atrium reference). */
export function paintTerrazzo(size: number, seed = 11, base = "#e9e2d5") {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  cloud(ctx, size, rand, "rgba(255,255,255,0.8)", 10, 0.25);
  const s = size / 1024;
  speckle(ctx, size, rand, 2600, ["#cfc6b6", "#bfb4a2", "#d9d2c5", "#a99d8a"], 1 * s, 3.2 * s);
  speckle(ctx, size, rand, 380, ["#8c8273", "#b8a48a", "#6f675d", "#c9b79c", "#e0d6c4"], 2 * s, 5.5 * s);
  speckle(ctx, size, rand, 24, ["#7d7366", "#a68e70", "#5c564f"], 5 * s, 9 * s);
  return c;
}

/** Light oak planks with grain (used for arches, slats, furniture). */
export function paintOak(size: number, seed = 3, base = "#c9a57a") {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const planks = 6;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const shade = (rand() - 0.5) * 22;
    ctx.fillStyle = `rgba(${shade > 0 ? 255 : 90},${shade > 0 ? 240 : 60},${shade > 0 ? 220 : 30},${Math.abs(shade) / 160})`;
    ctx.fillRect(0, p * ph, size, ph);
    for (let g = 0; g < 26; g++) {
      const y = p * ph + rand() * ph;
      ctx.strokeStyle = rand() > 0.5 ? "rgba(120,82,45,0.16)" : "rgba(255,236,205,0.14)";
      ctx.lineWidth = 0.6 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += size / 16) ctx.lineTo(x, y + Math.sin(x * 0.01 + g) * ph * 0.06 * rand());
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(80,55,30,0.25)";
    ctx.fillRect(0, p * ph, size, Math.max(1, size / 512));
  }
  return c;
}

/** Herringbone oak parquet (sneaker store reference). Repeat = 1.6 m. */
export function paintHerringbone(size: number, seed = 5) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = "#dcc6a5";
  ctx.fillRect(0, 0, size, size);
  const unit = size / 8;
  const len = unit * 4;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-size, -size);
  for (let i = -2; i < 24; i++) {
    for (let j = -2; j < 24; j++) {
      const x = i * unit + j * unit;
      const y = j * unit - i * unit;
      const vertical = (i + j) % 2 === 0;
      const tone = 200 + Math.floor(rand() * 34);
      ctx.fillStyle = `rgb(${tone + 14},${tone - 8},${tone - 42})`;
      if (vertical) ctx.fillRect(x, y, unit, len / 2);
      else ctx.fillRect(x, y, len / 2, unit);
      ctx.strokeStyle = "rgba(110,80,50,0.35)";
      ctx.lineWidth = Math.max(1, size / 900);
      if (vertical) ctx.strokeRect(x, y, unit, len / 2);
      else ctx.strokeRect(x, y, len / 2, unit);
    }
  }
  ctx.restore();
  cloud(ctx, size, rand, "rgba(255,245,225,0.7)", 8, 0.2);
  return c;
}

/** Pale polished concrete / microcement (electronics reference). */
export function paintConcrete(size: number, seed = 13, base = "#cfd1d3") {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  cloud(ctx, size, rand, "rgba(255,255,255,0.9)", 22, 0.22);
  cloud(ctx, size, rand, "rgba(120,124,128,0.9)", 16, 0.12);
  speckle(ctx, size, rand, 1800, ["rgba(90,95,100,0.25)", "rgba(255,255,255,0.3)"], 0.5, 1.4);
  return c;
}

/** Warm limestone / plaster wall with faint trowel marks. */
export function paintPlaster(size: number, seed = 17, base = "#e6ddcf") {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  cloud(ctx, size, rand, "rgba(255,252,245,0.9)", 20, 0.05);
  cloud(ctx, size, rand, "rgba(160,140,115,0.8)", 12, 0.025);
  speckle(ctx, size, rand, 900, ["rgba(140,120,95,0.12)", "rgba(255,255,255,0.18)"], 0.6, 1.6);
  return c;
}

/** Limestone cladding panels (1.2 × 2.4 m) for walls and the exterior. */
export function paintStonePanels(size: number, seed = 19, base = "#ebe6dc") {
  const c = paintPlaster(size, seed, base);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(90,80,65,0.28)";
  const w = Math.max(1, size / 512);
  ctx.fillRect(0, 0, size, w);
  ctx.fillRect(0, size / 2, size, w);
  ctx.fillRect(0, 0, w, size);
  return c;
}

/** Exterior paving: large pale granite slabs. Repeat = 3 m. */
export function paintPaving(size: number, seed = 23) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = "#a7aaad";
  ctx.fillRect(0, 0, size, size);
  const n = 3;
  const t = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n * 2; j++) {
      const tone = 150 + Math.floor(rand() * 24);
      ctx.fillStyle = `rgb(${tone},${tone + 3},${tone + 8})`;
      const off = j % 2 ? t / 2 : 0;
      ctx.fillRect(i * t + off, (j * t) / 2, t, t / 2);
      if (off) ctx.fillRect(i * t + off - size, (j * t) / 2, t, t / 2);
    }
  speckle(ctx, size, rand, 3000, ["rgba(80,80,85,0.25)", "rgba(255,255,255,0.35)"], 0.5, 1.5);
  ctx.strokeStyle = "rgba(70,72,78,0.5)";
  ctx.lineWidth = Math.max(1, size / 400);
  for (let j = 0; j <= n * 2; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (j * t) / 2);
    ctx.lineTo(size, (j * t) / 2);
    ctx.stroke();
    const off = j % 2 ? t / 2 : 0;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * t + off, (j * t) / 2);
      ctx.lineTo(i * t + off, ((j + 1) * t) / 2);
      ctx.stroke();
    }
  }
  return c;
}

export function paintGrass(size: number, seed = 29) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = "#5f7c3c";
  ctx.fillRect(0, 0, size, size);
  cloud(ctx, size, rand, "rgba(140,170,80,0.9)", 20, 0.1);
  cloud(ctx, size, rand, "rgba(40,60,25,0.9)", 14, 0.08);
  speckle(ctx, size, rand, 5000, ["#6f8d43", "#4f6a30", "#86a450"], 0.5, 1.5);
  return c;
}

/** Subtle woven fabric for upholstery. */
export function paintFabric(size: number, seed = 31) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const step = size / 128;
  for (let i = 0; i < 128; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.04})`;
    ctx.fillRect(i * step, 0, step * 0.5, size);
    ctx.fillRect(0, i * step, size, step * 0.5);
  }
  speckle(ctx, size, rand, 1200, ["rgba(0,0,0,0.06)", "rgba(255,255,255,0.4)"], 0.6, 1.8);
  return c;
}

/** Alpha foliage card: overlapping leaves on transparent background. */
export function paintLeaves(size: number, seed = 37, palette = ["#3f6b34", "#4f7d3c", "#5f8e45", "#2f5229", "#6f9b4f"]) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = size * (0.08 + rand() * 0.84);
    const y = size * (0.08 + rand() * 0.84);
    const dx = x - size / 2;
    const dy = y - size / 2;
    if (dx * dx + dy * dy > (size * 0.46) ** 2) continue;
    const len = size * (0.035 + rand() * 0.04);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.quadraticCurveTo(len * 0.55, 0, 0, len);
    ctx.quadraticCurveTo(-len * 0.55, 0, 0, -len);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,230,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(0, len);
    ctx.stroke();
    ctx.restore();
  }
  return c;
}

/** Palm frond on transparent background, stem along the vertical centre. */
export function paintFrond(size: number, seed = 41) {
  const { c, ctx } = canvas(size / 4, size);
  const rand = seeded(seed);
  const w = size / 4;
  ctx.clearRect(0, 0, w, size);
  ctx.strokeStyle = "#5b6b2e";
  ctx.lineWidth = w * 0.04;
  ctx.beginPath();
  ctx.moveTo(w / 2, size);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  for (let y = size * 0.04; y < size * 0.97; y += size * 0.018) {
    const t = y / size;
    const leaf = w * 0.48 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + w * 0.06;
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = rand() > 0.5 ? "#4a7a32" : "#3d6a2b";
      ctx.lineWidth = w * 0.035;
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.quadraticCurveTo(w / 2 + dir * leaf * 0.6, y + size * 0.01, w / 2 + dir * leaf, y + size * 0.05);
      ctx.stroke();
    }
  }
  return c;
}

/** Radial gradient: white centre to transparent. Used for light pools and glow sprites. */
export function paintRadial(size: number, inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,0.35)") {
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Soft contact shadow (baked ambient occlusion blob). */
export function paintBlobShadow(size: number) {
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.5, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/**
 * A warmly lit shop interior seen through glazing: bright ceiling with downlights,
 * displays and silhouettes in the mid-ground. Tiles horizontally (one repeat ≈ 6 m).
 */
export function paintInteriorGlow(w: number, seed = 53) {
  const h = w / 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const rand = seeded(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#fff1da");
  g.addColorStop(0.18, "#f7dcb4");
  g.addColorStop(0.65, "#d9b78a");
  g.addColorStop(1, "#b8946a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Ceiling line and downlights
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(0, h * 0.1, w, h * 0.012);
  for (let x = w * 0.06; x < w; x += w / 9) {
    const r = ctx.createRadialGradient(x, h * 0.13, 0, x, h * 0.13, h * 0.12);
    r.addColorStop(0, "rgba(255,255,245,0.95)");
    r.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = r;
    ctx.fillRect(x - h * 0.12, h * 0.01, h * 0.24, h * 0.24);
  }
  // Displays, racks and figures
  for (let i = 0; i < 16; i++) {
    const x = rand() * w;
    const bw = w * (0.03 + rand() * 0.08);
    const bh = h * (0.18 + rand() * 0.38);
    const tone = 70 + Math.floor(rand() * 70);
    ctx.fillStyle = `rgba(${tone + 40},${tone + 20},${tone},${0.35 + rand() * 0.35})`;
    ctx.fillRect(x, h - bh - h * 0.06, bw, bh);
    ctx.fillStyle = "rgba(255,248,232,0.35)";
    ctx.fillRect(x, h - bh - h * 0.06, bw, h * 0.01);
  }
  for (let i = 0; i < 7; i++) {
    const x = rand() * w;
    const s = h * (0.22 + rand() * 0.08);
    ctx.fillStyle = "rgba(60,45,35,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, h - s - h * 0.08, s * 0.09, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - s * 0.14, h - s * 0.95 - h * 0.06, s * 0.28, s * 0.95);
  }
  // Floor reflection band
  ctx.fillStyle = "rgba(255,240,215,0.25)";
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  return c;
}

/** Tileable ripple normal map for water surfaces (sum of wrapped sine waves). */
export function paintWaterNormal(size: number, seed = 43) {
  const { c, ctx } = canvas(size);
  const rand = seeded(seed);
  const waves = Array.from({ length: 9 }, () => ({
    kx: Math.round(1 + rand() * 6) * (rand() > 0.5 ? 1 : -1),
    ky: Math.round(1 + rand() * 6) * (rand() > 0.5 ? 1 : -1),
    phase: rand() * Math.PI * 2,
    amp: 0.4 + rand() * 0.6,
  }));
  const img = ctx.createImageData(size, size);
  const k = (Math.PI * 2) / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const arg = (w.kx * x + w.ky * y) * k + w.phase;
        const d = Math.cos(arg) * w.amp;
        dx += d * w.kx * 0.08;
        dy += d * w.ky * 0.08;
      }
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Vertical streaks used to animate falling water. */
export function paintStreaks(size: number, seed = 47) {
  const { c, ctx } = canvas(64, size);
  const rand = seeded(seed);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 64, size);
  for (let i = 0; i < 40; i++) {
    const x = rand() * 64;
    const y = rand() * size;
    const len = size * (0.05 + rand() * 0.2);
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1 + rand() * 4, len);
  }
  return c;
}

/** Vertical gradient used to fake soft ambient occlusion at the foot of walls. */
export function paintWallAO(size: number) {
  const { c, ctx } = canvas(8, size);
  const g = ctx.createLinearGradient(0, size, 0, 0);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(0.25, "rgba(0,0,0,0.1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, size);
  return c;
}
