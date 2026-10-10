import { STORES } from "@/data/stores";
import { AREAS, STORE_FOOTPRINTS, MAP_BOUNDS, FOUNTAIN } from "@/data/layout";
import type { Rect, StoreConfig } from "@/types";
import { seeded } from "./textures";

/**
 * Text and graphic painters for in-world signage. Fonts come from the same self-hosted
 * families as the HTML UI (exposed as CSS variables by next/font in the root layout).
 */

export type SignFont = "serif" | "sans" | "display";

const FONT_VARS: Record<SignFont, string> = {
  serif: "--font-luxe",
  sans: "--font-geist-sans",
  display: "--font-cormorant",
};
const FALLBACK: Record<SignFont, string> = {
  serif: "Didot, 'Bodoni 72', Georgia, serif",
  sans: "'Helvetica Neue', Arial, sans-serif",
  display: "Georgia, serif",
};

export function fontFamily(font: SignFont): string {
  if (typeof document === "undefined") return FALLBACK[font];
  const value = getComputedStyle(document.documentElement).getPropertyValue(FONT_VARS[font]).trim();
  return value || FALLBACK[font];
}

/** Ensure web fonts are ready before painting text into textures. */
export async function loadSignFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const specs = (["serif", "sans", "display"] as SignFont[]).flatMap((f) => [
    `400 64px ${fontFamily(f)}`,
    `500 64px ${fontFamily(f)}`,
    `italic 500 64px ${fontFamily(f)}`,
  ]);
  await Promise.race([
    Promise.all(specs.map((s) => document.fonts.load(s).catch(() => undefined))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

interface TextOptions {
  font: SignFont;
  color: string;
  weight?: number;
  italic?: boolean;
  uppercase?: boolean;
  /** Extra tracking in em. */
  tracking?: number;
  /** Height of the canvas in px; width follows the text. */
  height?: number;
  /** Optional soft halo colour behind letters (backlit signage). */
  halo?: string;
}

export function paintText(text: string, o: TextOptions): { canvas: HTMLCanvasElement; aspect: number } {
  const height = o.height ?? 256;
  const fontSize = height * 0.62;
  const label = o.uppercase ? text.toUpperCase() : text;
  const fontSpec = `${o.italic ? "italic " : ""}${o.weight ?? 500} ${fontSize}px ${fontFamily(o.font)}`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = fontSpec;
  const tracking = (o.tracking ?? 0) * fontSize;
  const chars = Array.from(label);
  const widths = chars.map((ch) => measure.measureText(ch).width);
  const textWidth = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  const pad = height * 0.35;
  const width = Math.ceil(Math.min(4096, textWidth + pad * 2));
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.font = fontSpec;
  ctx.textBaseline = "middle";
  const draw = () => {
    let x = (width - textWidth) / 2;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, x, height * 0.54);
      x += widths[i] + tracking;
    });
  };
  if (o.halo) {
    ctx.save();
    ctx.shadowColor = o.halo;
    ctx.shadowBlur = height * 0.18;
    ctx.fillStyle = o.halo;
    draw();
    ctx.restore();
  }
  ctx.fillStyle = o.color;
  draw();
  return { canvas: c, aspect: width / height };
}

export function storeSignOptions(store: StoreConfig): TextOptions {
  const t = store.theme;
  switch (t.signFont) {
    case "serif":
      return { font: "serif", color: t.sign, weight: 500, uppercase: true, tracking: 0.14, halo: "rgba(255,226,180,0.35)" };
    case "sans":
      return { font: "sans", color: t.sign, weight: 400, uppercase: true, tracking: 0.32 };
    case "display":
      return { font: "display", color: t.sign, weight: 500, italic: true, tracking: 0.02 };
  }
}

/** Light-box poster for the Lumen store: soft gradient with a floating device silhouette. */
export function paintPoster(seed: number, w = 512, h = 768): HTMLCanvasElement {
  const rand = seeded(seed);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const hues = [[205, 60], [220, 45], [190, 35], [260, 30]][seed % 4];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hues[0]}, ${hues[1]}%, 92%)`);
  g.addColorStop(1, `hsl(${hues[0] + 20}, ${hues[1]}%, 70%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Device silhouette.
  ctx.save();
  ctx.translate(w * 0.5, h * 0.55);
  ctx.rotate((rand() - 0.5) * 0.4);
  const dw = w * 0.42;
  const dh = dw * 2.05;
  ctx.shadowColor = "rgba(20,40,80,0.35)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#1b2230";
  roundRect(ctx, -dw / 2, -dh / 2, dw, dh, dw * 0.16);
  ctx.fill();
  ctx.shadowBlur = 0;
  const sg = ctx.createLinearGradient(-dw / 2, -dh / 2, dw / 2, dh / 2);
  sg.addColorStop(0, `hsl(${hues[0] + 30}, 80%, 65%)`);
  sg.addColorStop(1, `hsl(${hues[0] - 20}, 85%, 45%)`);
  ctx.fillStyle = sg;
  roundRect(ctx, -dw / 2 + 8, -dh / 2 + 8, dw - 16, dh - 16, dw * 0.13);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(20,28,40,0.85)";
  ctx.font = `500 ${w * 0.075}px ${fontFamily("sans")}`;
  ctx.textAlign = "center";
  ctx.fillText(["Aero 9", "Slate 14", "Halo", "Orbit"][seed % 4], w / 2, h * 0.13);
  ctx.font = `400 ${w * 0.04}px ${fontFamily("sans")}`;
  ctx.fillStyle = "rgba(20,28,40,0.6)";
  ctx.fillText("Designed to disappear.", w / 2, h * 0.19);
  return c;
}

/** Glowing wallpaper for device screens. */
export function paintScreen(seed: number, w = 256, h = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const hue = [210, 195, 250, 170, 25][seed % 5];
  const g = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.8);
  g.addColorStop(0, `hsl(${hue + 30}, 85%, 70%)`);
  g.addColorStop(0.5, `hsl(${hue}, 80%, 45%)`);
  g.addColorStop(1, `hsl(${hue - 30}, 70%, 18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Directory kiosk screen: a true-to-scale plan of the mall drawn from the same layout
 * data used for collision and the HTML map.
 */
export function paintDirectoryScreen(w = 512, h = 896): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#15130f";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e8dcc6";
  ctx.font = `500 ${w * 0.075}px ${fontFamily("display")}`;
  ctx.textAlign = "center";
  ctx.fillText("MallVerse", w / 2, h * 0.08);
  ctx.font = `400 ${w * 0.03}px ${fontFamily("sans")}`;
  ctx.fillStyle = "rgba(232,220,198,0.6)";
  ctx.fillText("GROUND LEVEL DIRECTORY", w / 2, h * 0.115);

  // Map rotated so north is up and the long axis runs vertically for a portrait screen.
  const b = MAP_BOUNDS;
  const mapTop = h * 0.15;
  const mapH = h * 0.6;
  const scale = Math.min((w * 0.9) / (b.maxZ - b.minZ), mapH / (b.maxX - b.minX));
  const cx = w / 2;
  const cy = mapTop + mapH / 2;
  const midX = (b.minX + b.maxX) / 2;
  const midZ = (b.minZ + b.maxZ) / 2;
  // Rotate 90°: world X -> screen Y (east at the bottom), world Z -> screen X.
  const tx = (z: number) => cx + (z - midZ) * scale;
  const ty = (x: number) => cy + (x - midX) * scale;
  const rect = (r: Rect, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(tx(r.minZ), ty(r.minX), (r.maxZ - r.minZ) * scale, (r.maxX - r.minX) * scale);
  };
  Object.values(AREAS).forEach((a) => rect(a, "#3a342b"));
  STORE_FOOTPRINTS.forEach((f) => {
    const s = STORES.find((st) => st.id === f.storeId)!;
    rect(f.interior, s.theme.accent);
  });
  ctx.fillStyle = "#8fb3c9";
  ctx.beginPath();
  ctx.arc(tx(FOUNTAIN.z), ty(FOUNTAIN.x), FOUNTAIN.basinRadius * scale, 0, Math.PI * 2);
  ctx.fill();

  // Legend.
  ctx.textAlign = "left";
  ctx.font = `500 ${w * 0.034}px ${fontFamily("sans")}`;
  STORES.forEach((s, i) => {
    const y = h * 0.8 + i * h * 0.03;
    ctx.fillStyle = s.theme.accent;
    ctx.fillRect(w * 0.1, y - w * 0.022, w * 0.03, w * 0.03);
    ctx.fillStyle = "#efe6d6";
    ctx.fillText(s.name, w * 0.16, y);
    ctx.fillStyle = "rgba(239,230,214,0.5)";
    ctx.textAlign = "right";
    ctx.fillText(s.categoryLabel, w * 0.9, y);
    ctx.textAlign = "left";
  });
  return c;
}

/** Café menu board. */
export function paintMenuBoard(w = 768, h = 384): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2b2420";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#f1e6d4";
  ctx.font = `italic 500 ${h * 0.13}px ${fontFamily("display")}`;
  ctx.fillText("Espresso Bar", w * 0.06, h * 0.2);
  const items = [
    ["Espresso", "3.2"],
    ["Cortado", "3.8"],
    ["Flat White", "4.4"],
    ["Pour-over", "5.5"],
    ["Cold Brew", "4.9"],
    ["Cardamom Bun", "3.9"],
  ];
  ctx.font = `400 ${h * 0.075}px ${fontFamily("sans")}`;
  items.forEach(([name, price], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = w * (0.06 + col * 0.48);
    const y = h * (0.42 + row * 0.18);
    ctx.fillStyle = "#e9dcc6";
    ctx.fillText(name, x, y);
    ctx.fillStyle = "#c98f5a";
    ctx.textAlign = "right";
    ctx.fillText(price, x + w * 0.4, y);
    ctx.textAlign = "left";
  });
  return c;
}

/** Hanging wayfinding blade sign. */
export function paintWayfinding(lines: { text: string; arrow: "left" | "right" | "up" | "down" | "none" }[], w = 1024, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1b1915";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#b08d57";
  ctx.fillRect(0, h - 6, w, 6);
  const rowH = h / lines.length;
  lines.forEach((line, i) => {
    const y = rowH * i + rowH / 2;
    ctx.fillStyle = "#f2e9da";
    ctx.font = `500 ${rowH * 0.42}px ${fontFamily("sans")}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = line.arrow === "right" ? "left" : "left";
    const text = line.text.toUpperCase();
    ctx.fillText(text, w * 0.14, y);
    drawArrow(ctx, w * 0.06, y, rowH * 0.32, line.arrow);
  });
  return c;
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: "left" | "right" | "up" | "down" | "none") {
  if (dir === "none") return;
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = "#d8b47a";
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(s, 0);
  ctx.moveTo(s * 0.3, -s * 0.65);
  ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.3, s * 0.65);
  ctx.stroke();
  ctx.restore();
}
