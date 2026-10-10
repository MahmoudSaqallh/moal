import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { AssistantRefusal, askAssistant, assistantConfigured } from "@/server/ai/assistant";
import { MAX_CHARS, MAX_TURNS, type AssistantError, type ChatTurn } from "@/features/ai-assistant/types";
import { isWalkable } from "@/lib/collision";

/**
 * POST /api/assistant — the MallVerse concierge.
 * Validates input, rate-limits per client, and calls Claude server-side with tools over
 * real mall data. Responds 503 `not_configured` when no API credentials are set, which the
 * client turns into the clearly labelled offline directory search.
 */

const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // bound memory on a busy single instance
  return recent.length > MAX_REQUESTS;
}

function fail(status: number, error: AssistantError["error"], message: string) {
  return Response.json({ error, message } satisfies AssistantError, { status });
}

function parse(body: unknown): { messages: ChatTurn[]; context: { floor: number; x: number; z: number } } | null {
  if (!body || typeof body !== "object") return null;
  const { messages, context } = body as { messages?: unknown; context?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_TURNS) return null;
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return null;
    const { role, text } = m as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
    const trimmed = text.trim().slice(0, MAX_CHARS);
    if (!trimmed) return null;
    turns.push({ role, text: trimmed });
  }
  if (turns[0].role !== "user" || turns.at(-1)!.role !== "user") return null;
  const c = (context ?? {}) as { floor?: unknown; x?: unknown; z?: unknown };
  const floor = typeof c.floor === "number" && Number.isInteger(c.floor) && c.floor >= 0 && c.floor <= 2 ? c.floor : 0;
  const x = typeof c.x === "number" && Number.isFinite(c.x) ? c.x : 0;
  const z = typeof c.z === "number" && Number.isFinite(c.z) ? c.z : 13.5;
  // Fall back to the atrium if the claimed position isn't on the floor plan.
  const valid = isWalkable(floor, x, z);
  return { messages: turns, context: valid ? { floor, x, z } : { floor: 0, x: 0, z: 13.5 } };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (rateLimited(ip)) return fail(429, "rate_limited", "Too many questions in a short time. Please wait a moment.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Invalid JSON body.");
  }
  const input = parse(body);
  if (!input) return fail(400, "bad_request", "Send 1–12 non-empty messages, starting and ending with the visitor.");

  if (!assistantConfigured()) return fail(503, "not_configured", "The AI assistant isn't configured on this server.");

  try {
    const result = await askAssistant(input.messages, input.context);
    return Response.json(result);
  } catch (err) {
    if (err instanceof AssistantRefusal) return fail(422, "refused", "I can't help with that one, but I'm happy to help you shop or find your way.");
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      return fail(503, "not_configured", "The AI assistant's credentials were rejected.");
    if (err instanceof Anthropic.RateLimitError) return fail(429, "rate_limited", "The assistant is busy right now. Please try again shortly.");
    if (err instanceof Anthropic.APIError) {
      console.error("Assistant upstream error", err.status, err.message);
      return fail(502, "upstream", "The assistant couldn't be reached. Please try again.");
    }
    console.error("Assistant error", err);
    return fail(500, "upstream", "Something went wrong answering that.");
  }
}
