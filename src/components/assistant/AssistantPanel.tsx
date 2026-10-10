"use client";

import { useEffect, useRef, useState } from "react";
import { Footprints, Loader2, Route as RouteIcon, Send, Sparkles, X } from "lucide-react";
import { getProduct } from "@/data/products";
import { getStore } from "@/data/stores";
import { player } from "@/lib/runtime";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { navigateTo } from "@/features/exploration/actions";
import { localAnswer } from "@/features/ai-assistant/localAssistant";
import { MAX_CHARS, MAX_TURNS, type AssistantAction, type AssistantError, type AssistantResponse } from "@/features/ai-assistant/types";
import { Button, IconButton, cn, formatPrice, useFocusTrap } from "../ui/primitives";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
  source?: "ai" | "local";
  /** Service note shown under the reply in its own direction (never mixed into RTL text). */
  note?: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "Where is the electronics store?",
  "Take me to the sneaker store",
  "Show me shoes under $100",
  "Which floor has the restaurants?",
  "Ø£ÙŠÙ† Ø£Ù‚Ø±Ø¨ Ù…ØµØ¹Ø¯ØŸ",
  "Ø§Ù‚ØªØ±Ø­ Ù‡Ø¯ÙŠØ© Ø¨Ø£Ù‚Ù„ Ù…Ù† 50 Ø¯ÙˆÙ„Ø§Ø±",
];

let nextId = 1;

/** "AI unavailable" is remembered for the session so we don't retry on every message. */
let aiUnavailable = false;

async function ask(history: Message[]): Promise<{ res: AssistantResponse; source: "ai" | "local"; note?: string }> {
  const last = history[history.length - 1].text;
  const here = { x: player.x, z: player.z, floor: player.floor };
  if (aiUnavailable) return { res: localAnswer(last, here), source: "local" };
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: history.filter((m) => !m.error).slice(-MAX_TURNS).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) })),
        context: here,
      }),
    });
    if (response.ok) return { res: (await response.json()) as AssistantResponse, source: "ai" };
    const err = (await response.json().catch(() => null)) as AssistantError | null;
    if (err?.error === "not_configured") aiUnavailable = true;
    if (err?.error === "refused") return { res: { reply: err.message, actions: [] }, source: "ai" };
    return { res: localAnswer(last, here), source: "local", note: err?.message };
  } catch {
    return { res: localAnswer(last, here), source: "local", note: "The assistant couldn't be reached." };
  }
}

function ActionButtons({ actions }: { actions: AssistantAction[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((a, i) => {
        if (a.type === "route" || a.type === "navigate")
          return (
            <div key={i} className="flex gap-1.5">
              <Button className="min-h-8 rounded-full px-3 text-xs" onClick={() => navigateTo(a.destinationId, false)}>
                <RouteIcon size={13} aria-hidden /> Show route
              </Button>
              <Button variant="primary" className="min-h-8 rounded-full px-3 text-xs" onClick={() => navigateTo(a.destinationId, true)}>
                <Footprints size={13} aria-hidden /> Walk me to {a.label}
              </Button>
            </div>
          );
        if (a.type === "products")
          return a.productIds.slice(0, 6).map((id) => {
            const p = getProduct(id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => useExperienceStore.getState().browseStore(p.storeId)}
                className="rounded-full border border-line-strong px-3 py-1 text-xs text-ivory hover:bg-ink-3"
              >
                {p.name} Â· <span className="text-bronze">{formatPrice(p.priceCents)}</span>
              </button>
            );
          });
        if (a.type === "stores")
          return a.storeIds.slice(0, 4).map((id) => {
            const s = getStore(id);
            if (!s) return null;
            return (
              <button key={id} type="button" onClick={() => navigateTo(id, false)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ivory">
                {s.name} Â· L{s.floor + 1}
              </button>
            );
          });
        return null;
      })}
    </div>
  );
}

export function AssistantPanel() {
  const open = useExperienceStore((s) => s.panel === "assistant");
  const phase = useExperienceStore((s) => s.phase);
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, close);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, MAX_CHARS);
    if (!trimmed || busy) return;
    const history: Message[] = [...messages, { id: nextId++, role: "user", text: trimmed }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    const { res, source, note } = await ask(history);
    setBusy(false);
    setMessages((m) => [...m, { id: nextId++, role: "assistant", text: res.reply, note, actions: res.actions, source }]);
    const nav = res.actions.find((a) => a.type === "navigate");
    if (nav && nav.type === "navigate" && phase === "explore") {
      if (navigateTo(nav.destinationId, true)) close();
    }
  };

  if (phase !== "explore" && phase !== "inspect") return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => useExperienceStore.getState().openPanel("assistant")}
          className="pointer-events-auto fixed bottom-24 right-4 z-20 inline-flex h-12 items-center gap-2 rounded-full border border-bronze/50 bg-ink/95 pl-3 pr-4 text-sm font-medium text-ivory shadow-[var(--shadow-panel)] hover:bg-ink-3 sm:bottom-24 sm:right-5 md:bottom-20"
          aria-label="Ask the MallVerse assistant"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-bronze text-ink">
            <Sparkles size={16} aria-hidden />
          </span>
          Ask MallVerse
        </button>
      )}
      {open && (
        <div
          ref={ref}
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[78vh] flex-col rounded-t-[18px] border border-line bg-ink shadow-[var(--shadow-panel)] anim-rise sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[560px] sm:max-h-[calc(100vh-7rem)] sm:w-[400px] sm:rounded-[var(--radius-panel)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-bronze text-ink">
                <Sparkles size={17} aria-hidden />
              </span>
              <div>
                <h2 id="assistant-title" className="text-sm font-semibold text-ivory">
                  MallVerse concierge
                </h2>
                <p className="text-[11px] text-faint">{aiUnavailable ? "Offline directory search Â· AI not configured" : "Stores, products and directions Â· Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© / English"}</p>
              </div>
            </div>
            <IconButton label="Close assistant" shortcut="Esc" onClick={close} tooltipSide="left">
              <X size={18} aria-hidden />
            </IconButton>
          </header>

          <div ref={list} className="mv-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-muted">Ask about any store, product or how to get somewhere. Answers use the mall&apos;s real directory and prices.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" dir="auto" onClick={() => void send(s)} className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ivory hover:bg-ink-3">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  dir="auto"
                  className={cn(
                    "max-w-[88%] whitespace-pre-line rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "bg-bronze text-ink" : "border border-line bg-ink-2 text-ivory",
                  )}
                >
                  {m.text}
                  {m.note && <p dir="ltr" className="mt-2 text-xs text-muted">{m.note}</p>}
                  {m.actions && m.actions.length > 0 && <ActionButtons actions={m.actions} />}
                </div>
              </div>
            ))}
            {busy && (
              <p className="inline-flex items-center gap-2 text-xs text-muted" role="status">
                <Loader2 size={14} className="animate-spin" aria-hidden /> Looking that upâ€¦
              </p>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              Message the concierge
            </label>
            <textarea
              id="assistant-input"
              data-autofocus
              rows={1}
              dir="auto"
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="Ask anything Â· Ø§Ø³Ø£Ù„ Ø£ÙŠ Ø´ÙŠØ¡"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-[10px] border border-line-strong bg-ink-2 px-3 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-bronze/70 focus:outline-none"
            />
            <Button type="submit" variant="primary" className="h-10 w-10 px-0" disabled={busy || !draft.trim()} aria-label="Send">
              <Send size={16} aria-hidden />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
