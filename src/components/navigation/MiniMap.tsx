"use client";

import { useEffect, useRef } from "react";
import { Map as MapIcon } from "lucide-react";
import { player } from "@/lib/runtime";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { openDirectory } from "@/features/exploration/actions";
import { MallMap, PlayerMarker } from "./MallMap";

const SPAN = 58; // metres visible across the minimap

/**
 * North-up map of the visitor's current level. The viewBox and marker move imperatively
 * in a requestAnimationFrame loop, so the map tracks the avatar without React re-renders.
 */
export function MiniMap() {
  const route = useExperienceStore((s) => s.route);
  const floor = useExperienceStore((s) => s.floor);
  const svg = useRef<SVGSVGElement>(null);
  const marker = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      svg.current?.setAttribute("viewBox", `${player.x - SPAN / 2} ${player.z - SPAN / 2} ${SPAN} ${SPAN}`);
      marker.current?.setAttribute("transform", `translate(${player.x} ${player.z}) rotate(${(-player.yaw * 180) / Math.PI})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button
      type="button"
      onClick={openDirectory}
      className="group relative block h-36 w-36 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-[#191612] shadow-[var(--shadow-panel)] sm:h-44 sm:w-44"
      aria-label={`Open the mall map and directory. You are on level ${floor + 1}.`}
    >
      <MallMap ref={svg} floor={floor} viewBox={`0 0 ${SPAN} ${SPAN}`} route={route} labelSize={2.4} title="Mini map around your position" className="h-full w-full">
        <PlayerMarker ref={marker} size={1.5} />
      </MallMap>
      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-ink/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">N</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-bronze px-1.5 py-0.5 text-[11px] font-semibold text-ink">L{floor + 1}</span>
      <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-ink/85 px-1.5 py-1 text-[11px] text-ivory opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <MapIcon size={12} aria-hidden /> Map
      </span>
    </button>
  );
}
