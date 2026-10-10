import type { FloorPoint, StoreCategory } from "@/types";
import { STORES } from "@/data/stores";
import { FLOORS } from "@/data/floors";
import type { AssistantAction, AssistantResponse } from "./types";
import { directions, floorsOverview, nearestFacility, searchProducts, searchStores, type Facility } from "./knowledge";

/**
 * Offline directory search — used when no AI provider is configured or reachable.
 * Deterministic keyword matching (English + Arabic) over the same knowledge functions as
 * the AI tools. It is labelled as such in the UI; it does not pretend to be the AI.
 */

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

const CATEGORY_WORDS: [StoreCategory, string[]][] = [
  ["footwear", ["sneaker", "sneakers", "shoe", "shoes", "trainers", "حذاء", "أحذية", "احذية", "جزمة", "جزم", "سنيكرز", "كوتشي"]],
  ["technology", ["electronics", "electronic", "phone", "laptop", "tech", "tablet", "إلكترونيات", "الكترونيات", "جوال", "هاتف", "لابتوب", "تقنية"]],
  ["gaming", ["gaming", "game", "games", "console", "controller", "ألعاب", "العاب", "بلايستيشن", "قيمز"]],
  ["fashion", ["fashion", "clothes", "clothing", "coat", "dress", "أزياء", "ملابس", "فستان", "معطف"]],
  ["accessories", ["accessories", "jewellery", "jewelry", "bag", "bags", "watch", "perfume", "إكسسوارات", "اكسسوارات", "مجوهرات", "حقيبة", "حقائب", "ساعة", "عطر"]],
  ["home", ["furniture", "home", "sofa", "chair", "lamp", "أثاث", "اثاث", "منزل", "كنبة", "كرسي"]],
  ["food", ["restaurant", "restaurants", "food", "eat", "coffee", "cafe", "café", "مطعم", "مطاعم", "أكل", "اكل", "طعام", "قهوة", "مقهى", "كافيه"]],
];

const FACILITY_WORDS: [Facility, string[]][] = [
  ["lift", ["elevator", "lift", "مصعد", "اسانسير", "أسانسير"]],
  ["escalator", ["escalator", "escalators", "سلم كهربائي", "السلم الكهربائي", "سلالم"]],
  ["information_desk", ["information", "info desk", "help desk", "استعلامات", "الاستعلامات", "مكتب المعلومات"]],
  ["cafe", ["coffee", "cafe", "café", "قهوة", "مقهى", "كافيه"]],
  ["restaurant", ["restaurant", "restaurants", "مطعم", "مطاعم"]],
  ["food_court", ["food court", "ساحة الطعام", "صالة الطعام"]],
];

const NAVIGATE = ["take me", "go to", "navigate", "bring me", "guide me", "walk me", "خذني", "وديني", "ودّيني", "اذهب", "روح", "وصلني", "دلني", "دلّني"];
const WHERE = ["where", "which floor", "what floor", "find", "أين", "وين", "فين", "أي طابق", "اي طابق", "في أي طابق"];
const NEAREST = ["nearest", "closest", "near me", "أقرب", "اقرب", "قريب"];
const UNDER = ["under", "below", "less than", "cheaper than", "max", "budget", "أقل من", "اقل من", "تحت", "بأقل", "ميزانية", "حدود"];
const FLOORS_Q = ["floors", "levels", "floor plan", "الطوابق", "الأدوار", "طابق", "دور"];

/** Case-, accent- and Arabic-diacritic-insensitive form (أ/إ/آ → ا, ة → ه, ى → ي). */
export function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(fold(w)));
}

function matchCategory(text: string): StoreCategory | null {
  for (const [cat, words] of CATEGORY_WORDS) if (includesAny(text, words)) return cat;
  return null;
}

function matchStore(text: string) {
  return STORES.find((s) => {
    const name = s.name.toLowerCase();
    return text.includes(fold(name)) || name.split(/\s+/).some((w) => w.length > 3 && text.includes(fold(w)));
  });
}

function priceLimit(text: string): number | null {
  const digits = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m = digits.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const fmt = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

export function localAnswer(input: string, from: FloorPoint): AssistantResponse {
  const raw = input.trim();
  const text = fold(raw);
  const ar = isArabic(raw);
  const actions: AssistantAction[] = [];
  const floorName = (f: number) => (ar ? `الطابق ${f + 1}` : `Level ${f + 1}`);

  // 1. Nearest facility (lift, escalator, info desk, restaurant…)
  if (includesAny(text, NEAREST) || FACILITY_WORDS.slice(0, 3).some(([, w]) => includesAny(text, w))) {
    const facility = FACILITY_WORDS.find(([, w]) => includesAny(text, w))?.[0];
    if (facility) {
      const d = nearestFacility(from, facility);
      if (d) {
        actions.push({ type: includesAny(text, NAVIGATE) ? "navigate" : "route", destinationId: d.destinationId, label: d.label });
        return {
          reply: ar
            ? `أقرب وجهة: ${d.label} في ${floorName(d.floor)}، على بُعد حوالي ${d.distanceMeters} م.`
            : `The nearest is ${d.label} on ${floorName(d.floor)}, about ${d.distanceMeters} m away.`,
          actions,
        };
      }
    }
  }

  // 2. Products under a budget
  const limit = priceLimit(text);
  const category = matchCategory(text);
  if (limit !== null && (includesAny(text, UNDER) || category)) {
    const products = searchProducts({ category, maxPriceUsd: limit, limit: 6 });
    if (!products.length) {
      return { reply: ar ? `لا توجد منتجات بسعر ${fmt(limit)} أو أقل في هذه الفئة.` : `Nothing in that category at ${fmt(limit)} or less.`, actions };
    }
    actions.push({ type: "products", productIds: products.map((p) => p.id) });
    const lines = products.map((p) => `• ${p.name}, ${fmt(p.priceUsd)} (${p.storeName}, ${floorName(p.floor)})`);
    return { reply: (ar ? `وجدت ${products.length === 1 ? "منتجًا واحدًا" : `${products.length} منتجات`} بسعر ${fmt(limit)} أو أقل:\n` : `${products.length} ${products.length === 1 ? "option" : "options"} at ${fmt(limit)} or less:\n`) + lines.join("\n"), actions };
  }

  // 3. A specific store, or a category's stores: where / take me
  const store = matchStore(text);
  let stores = store ? [searchStores({ query: store.name })[0]] : category ? searchStores({ category }) : [];
  // "Restaurants" should lead with sit-down restaurants rather than the café in the same category.
  const restaurantWords = FACILITY_WORDS.find(([k]) => k === "restaurant")?.[1] ?? [];
  if (!store && includesAny(text, restaurantWords)) {
    const isRestaurant = (id: string) => (STORES.find((s) => s.id === id)?.interior === "restaurant" ? 1 : 0);
    stores = [...stores].sort((a, b) => isRestaurant(b.id) - isRestaurant(a.id));
  }
  if (stores.length) {
    const target = stores[0];
    const wantsNav = includesAny(text, NAVIGATE);
    const d = directions(from, target.id);
    if (d) actions.push({ type: wantsNav ? "navigate" : "route", destinationId: target.id, label: target.name });
    if (stores.length > 1) actions.push({ type: "stores", storeIds: stores.map((s) => s.id) });
    const list = stores.map((s) => `${s.name} (${floorName(s.floor)})`).join(ar ? "، " : ", ");
    return {
      reply: ar
        ? `${list}.${wantsNav ? " سأرشدك الآن." : d ? ` المسافة حوالي ${d.distanceMeters} م.` : ""}`
        : `${list}.${wantsNav ? " Guiding you there now." : d ? ` About ${d.distanceMeters} m from you.` : ""}`,
      actions,
    };
  }

  // 4. Floor overview
  if (includesAny(text, FLOORS_Q) || includesAny(text, WHERE)) {
    const lines = floorsOverview().map((f) => `• ${floorName(f.floor)}: ${ar ? FLOORS[f.floor].theme : f.theme} (${f.stores.map((s) => s.name).join(", ")})`);
    return { reply: (ar ? "طوابق المول:\n" : "Here's what's on each level:\n") + lines.join("\n"), actions };
  }

  return {
    reply: ar
      ? "لم أفهم الطلب. جرّب مثلاً: «وين متجر الإلكترونيات؟» أو «أحذية أقل من 100 دولار» أو «أقرب مصعد»."
      : "I couldn't match that. Try “Where is the electronics store?”, “Shoes under $100” or “Nearest elevator”.",
    actions,
  };
}
