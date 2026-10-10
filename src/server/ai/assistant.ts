import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { FloorPoint, StoreCategory } from "@/types";
import { CATEGORIES, directions, floorsOverview, nearestFacility, searchProducts, searchStores, type Facility } from "@/features/ai-assistant/knowledge";
import { getDestination, DESTINATIONS } from "@/data/navigation";
import type { AssistantAction, AssistantResponse, ChatTurn } from "@/features/ai-assistant/types";

/**
 * Server-side shopping assistant: Claude with tools over the mall's real data.
 * The model never sees secrets and can only state facts that came back from a tool.
 */

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 5;

const DESTINATION_IDS = DESTINATIONS.map((d) => d.id);
const FACILITIES: Facility[] = ["lift", "escalator", "information_desk", "directory", "restaurant", "cafe", "food_court"];

const SYSTEM = `You are the MallVerse concierge, a friendly shopping assistant inside a virtual 3D shopping mall.

Answer in the language the visitor writes in (Arabic or English). Keep replies short: two or three sentences, or a brief bulleted list for products.

Every fact about stores, products, prices, floors, opening hours and directions must come from your tools. If a tool returns nothing, say so plainly and suggest something the tools do have. Never invent stores, products, prices, discounts, stock levels or locations.

Prices are in US dollars. The catalogue is sample data in a demo store: if asked about payment, delivery or stock, say the mall is a demo and no real orders are fulfilled.

When the visitor asks where something is, call get_directions so they can see the route. When they ask you to take, guide or walk them somewhere, call start_navigation. For "nearest" questions use find_nearest. Do not repeat raw IDs to the visitor.`;

const nullable = (type: "string" | "number" | "integer") => ({ type: [type, "null"] });

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_stores",
    description: "Search the mall's stores by text, category and/or floor (0 = Level 1, 1 = Level 2, 2 = Level 3). Returns name, category, floor and hours.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: { ...nullable("string"), description: "Free text, e.g. a store name or product type." },
        category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
        floor: { ...nullable("integer"), description: "0, 1 or 2" },
      },
      required: ["query", "category", "floor"],
      additionalProperties: false,
    },
  },
  {
    name: "search_products",
    description: "Search the sample catalogue. Filter by text, store, category and USD price range. Returns up to 8 products with prices, store and floor.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: nullable("string"),
        store_id: nullable("string"),
        category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
        min_price_usd: nullable("number"),
        max_price_usd: nullable("number"),
      },
      required: ["query", "store_id", "category", "min_price_usd", "max_price_usd"],
      additionalProperties: false,
    },
  },
  {
    name: "get_directions",
    description: "Plan a walking route from the visitor's current position to a destination and show it to them. Returns distance and step-by-step instructions (escalators/lift included).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { destination_id: { type: "string", enum: DESTINATION_IDS } },
      required: ["destination_id"],
      additionalProperties: false,
    },
  },
  {
    name: "start_navigation",
    description: "Start guiding the visitor's avatar to a destination right now. Use only when they ask to be taken there.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { destination_id: { type: "string", enum: DESTINATION_IDS } },
      required: ["destination_id"],
      additionalProperties: false,
    },
  },
  {
    name: "find_nearest",
    description: "Find the nearest facility to the visitor by actual walking route.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { facility: { type: "string", enum: FACILITIES } },
      required: ["facility"],
      additionalProperties: false,
    },
  },
  {
    name: "list_floors",
    description: "Overview of the mall's three levels and the stores on each.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cat = (v: unknown) => (typeof v === "string" && (CATEGORIES as string[]).includes(v) ? (v as StoreCategory) : null);

/** Execute one tool call against real data; records UI actions as a side effect. */
function runTool(name: string, input: unknown, from: FloorPoint, actions: AssistantAction[]): { content: string; isError?: boolean } {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "search_stores": {
      const floor = num(i.floor);
      const stores = searchStores({ query: str(i.query), category: cat(i.category), floor: floor !== null && floor >= 0 && floor <= 2 ? Math.round(floor) : null });
      if (stores.length) actions.push({ type: "stores", storeIds: stores.map((s) => s.id) });
      return { content: JSON.stringify({ stores }) };
    }
    case "search_products": {
      const products = searchProducts({
        query: str(i.query),
        storeId: str(i.store_id),
        category: cat(i.category),
        minPriceUsd: num(i.min_price_usd),
        maxPriceUsd: num(i.max_price_usd),
      });
      if (products.length) actions.push({ type: "products", productIds: products.map((p) => p.id) });
      return { content: JSON.stringify({ products, note: "Sample catalogue; prices in USD." }) };
    }
    case "get_directions":
    case "start_navigation": {
      const id = str(i.destination_id);
      const dest = id ? getDestination(id) : undefined;
      if (!id || !dest) return { content: "Unknown destination.", isError: true };
      const d = directions(from, id);
      if (!d) return { content: "No walkable route from the visitor's position.", isError: true };
      actions.push({ type: name === "start_navigation" ? "navigate" : "route", destinationId: id, label: dest.label });
      return { content: JSON.stringify({ ...d, started: name === "start_navigation" }) };
    }
    case "find_nearest": {
      const facility = typeof i.facility === "string" && (FACILITIES as string[]).includes(i.facility) ? (i.facility as Facility) : null;
      if (!facility) return { content: "Unknown facility.", isError: true };
      const d = nearestFacility(from, facility);
      if (!d) return { content: "None reachable.", isError: true };
      actions.push({ type: "route", destinationId: d.destinationId, label: d.label });
      return { content: JSON.stringify(d) };
    }
    case "list_floors":
      return { content: JSON.stringify({ floors: floorsOverview() }) };
    default:
      return { content: `Unknown tool ${name}.`, isError: true };
  }
}

export class AssistantRefusal extends Error {}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function askAssistant(history: ChatTurn[], from: FloorPoint): Promise<AssistantResponse> {
  const actions: AssistantAction[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));
  const context = `Visitor position: Level ${from.floor + 1} (floor index ${from.floor}).`;
  // Position is volatile, so it goes in a mid-conversation system message after the cached prefix.
  messages.push({ role: "system", content: context } as unknown as Anthropic.Beta.BetaMessageParam);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") throw new AssistantRefusal("refused");

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "tool_use" && toolUses.length) {
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t) => {
        const r = runTool(t.name, t.input, from, actions);
        return { type: "tool_result", tool_use_id: t.id, content: r.content, is_error: r.isError };
      });
      messages.push({ role: "user", content: results });
      continue;
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "Sorry, I couldn't put an answer together. Please try again.", actions: dedupe(actions) };
  }
  return { reply: "That took more steps than expected. Could you rephrase?", actions: dedupe(actions) };
}

function dedupe(actions: AssistantAction[]): AssistantAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = JSON.stringify(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
