"use client";

import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-ink-3 px-1.5 font-sans text-[11px] font-medium leading-none text-ivory",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  active?: boolean;
  tooltipSide?: "bottom" | "top" | "left";
  badge?: ReactNode;
}

/** Square icon button with an accessible name, tooltip and optional shortcut hint. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, tooltipSide = "bottom", badge, className, children, ...rest },
  ref,
) {
  const tipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={tipId}
        aria-pressed={active}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border text-ivory transition-colors duration-[var(--duration-fast)]",
          active ? "border-bronze/60 bg-ink-3" : "border-line bg-ink/90 hover:bg-ink-3 hover:border-line-strong",
          "disabled:opacity-40",
          className,
        )}
        {...rest}
      >
        {children}
        {badge}
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md border border-line bg-ink px-2 py-1 text-xs text-ivory shadow-lg group-hover:flex group-focus-within:flex items-center gap-1.5",
          tooltipSide === "bottom" && "left-1/2 top-full mt-2 -translate-x-1/2",
          tooltipSide === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
          tooltipSide === "left" && "right-full top-1/2 mr-2 -translate-y-1/2",
        )}
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  );
});

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "secondary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-bronze text-ink hover:bg-[#dab57a]",
        variant === "secondary" && "border border-line-strong bg-ink-2 text-ivory hover:bg-ink-3",
        variant === "ghost" && "text-muted hover:bg-ink-3 hover:text-ivory",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for overlays: moves focus inside on open, keeps Tab cycling within,
 * closes on Escape and restores focus to the opener on close.
 */
export function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // Prefer an explicit target; otherwise focus the dialog itself so screen readers announce
    // it without a button tooltip popping open on the first control.
    const target = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node;
    if (target === node && node && !node.hasAttribute("tabindex")) {
      node.tabIndex = -1;
      node.style.outline = "none";
    }
    target?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    node?.addEventListener("keydown", onKey);
    return () => {
      node?.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
