/** Wire types for the shopping assistant (client ⇄ /api/assistant). */

export type AssistantAction =
  /** Show a route on the map/floor with "Walk me there". */
  | { type: "route"; destinationId: string; label: string }
  /** Start guided navigation immediately (the visitor asked to be taken there). */
  | { type: "navigate"; destinationId: string; label: string }
  | { type: "products"; productIds: string[] }
  | { type: "stores"; storeIds: string[] };

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantRequest {
  messages: ChatTurn[];
  /** The visitor's position, used for directions and "nearest" questions. */
  context: { floor: number; x: number; z: number };
}

export interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}

export interface AssistantError {
  error: "not_configured" | "rate_limited" | "bad_request" | "upstream" | "refused";
  message: string;
}

export const MAX_TURNS = 12;
export const MAX_CHARS = 600;
