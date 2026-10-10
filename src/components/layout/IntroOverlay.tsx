"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowRight, FastForward } from "lucide-react";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { enterMall, skipIntro } from "@/features/exploration/actions";
import { useReducedMotion } from "@/lib/motion";

/**
 * Cinematic title card over the exterior establishing shot. Copy and the call to action
 * are staggered in with one GSAP timeline once the camera settles.
 */
export function IntroOverlay() {
  const phase = useExperienceStore((s) => s.phase);
  const settled = useExperienceStore((s) => s.introSettled);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (phase !== "intro" || !settled || !root.current) return;
    setLeaving(false);
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      if (reduced) {
        gsap.set(items, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(items, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 });
      }
    }, root);
    const t = window.setTimeout(() => cta.current?.focus({ preventScroll: true }), reduced ? 0 : 700);
    return () => {
      ctx.revert();
      window.clearTimeout(t);
    };
  }, [phase, settled, reduced]);

  const onEnter = () => {
    if (!root.current) return enterMall();
    setLeaving(true);
    if (reduced) return enterMall();
    gsap.to(root.current.querySelectorAll("[data-reveal]"), {
      opacity: 0,
      y: -12,
      duration: 0.45,
      ease: "power2.in",
      stagger: 0.05,
      onComplete: enterMall,
    });
  };

  if (phase === "entering") {
    return (
      <div className="pointer-events-none fixed inset-0 z-20">
        <button
          type="button"
          onClick={skipIntro}
          className="pointer-events-auto absolute bottom-6 right-6 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-ink/80 px-4 text-sm text-ivory hover:bg-ink"
        >
          <FastForward size={15} aria-hidden /> Skip to the atrium
        </button>
      </div>
    );
  }
  if (phase !== "intro") return null;

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-20">
      {/* Soft scrim keeps the title legible without dimming the architecture. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_100%,rgba(12,10,8,0.78)_0%,rgba(12,10,8,0.35)_40%,transparent_70%)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[rgba(12,10,8,0.82)] via-[rgba(12,10,8,0.45)] to-transparent sm:hidden" aria-hidden />
      {settled && (
        <section
          aria-labelledby="intro-title"
          className="pointer-events-auto absolute bottom-[max(2.5rem,env(safe-area-inset-bottom))] left-6 right-6 max-w-xl sm:bottom-16 sm:left-14"
        >
          <p data-reveal className="text-[11px] font-medium uppercase tracking-[0.32em] text-bronze opacity-0">
            Open daily · Ground level
          </p>
          <h2 id="intro-title" data-reveal className="mt-3 font-display text-6xl italic leading-[0.95] text-ivory opacity-0 sm:text-8xl">
            MallVerse
          </h2>
          <p data-reveal className="mt-4 max-w-md text-base leading-relaxed text-ivory/80 opacity-0 sm:text-lg">
            Three floors of fashion, technology and food around a sunlit atrium. Create your avatar, ride the glass lift, and take a closer look at anything that catches your eye.
          </p>
          <div data-reveal className="mt-7 flex flex-wrap items-center gap-3 opacity-0">
            <button
              ref={cta}
              type="button"
              disabled={leaving}
              onClick={onEnter}
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-ivory pl-7 pr-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-white disabled:opacity-60"
            >
              Enter the mall
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-ivory transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight size={18} aria-hidden />
              </span>
            </button>
            <button
              type="button"
              onClick={skipIntro}
              className="inline-flex h-12 items-center rounded-full px-4 text-sm text-ivory/80 underline-offset-4 hover:text-ivory hover:underline"
            >
              Skip intro
            </button>
          </div>
        </section>
      )}
      {!settled && (
        <button
          type="button"
          onClick={skipIntro}
          className="pointer-events-auto absolute bottom-6 right-6 inline-flex h-10 items-center gap-2 rounded-full border border-line bg-ink/80 px-4 text-sm text-ivory hover:bg-ink"
        >
          <FastForward size={15} aria-hidden /> Skip intro
        </button>
      )}
    </div>
  );
}
