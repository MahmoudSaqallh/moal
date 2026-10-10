"use client";

import { useState } from "react";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { Button } from "../ui/primitives";

/** Real progress (texture painting, shader compilation), never a timed fake. */
export function LoadingScreen() {
  const phase = useExperienceStore((s) => s.phase);
  const { progress, label, error } = useExperienceStore((s) => s.loading);
  const loading = phase === "loading";
  // Loading happens once per session; after the fade-out the screen unmounts for good.
  const [gone, setGone] = useState(false);
  if (gone && !loading) return null;

  const pct = Math.round(progress * 100);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#0f0d0a] transition-opacity duration-700"
      style={{ opacity: loading ? 1 : 0, pointerEvents: loading ? "auto" : "none" }}
      aria-hidden={!loading}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !loading) setGone(true);
      }}
    >
      <div className="w-[min(320px,80vw)] text-center">
        <p className="font-display text-5xl italic text-ivory">MallVerse</p>
        {error ? (
          <div role="alert" className="mt-8 space-y-4">
            <p className="text-sm text-muted">{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <div
              role="progressbar"
              aria-label="Loading the mall"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={`${pct}% · ${label}`}
              className="h-[2px] w-full overflow-hidden rounded-full bg-line"
            >
              <div className="h-full bg-bronze transition-[width] duration-300 ease-out" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <p className="mt-3 flex justify-between text-xs text-muted">
              <span>{label}</span>
              <span className="tabular-nums">{pct}%</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
