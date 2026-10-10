"use client";

import { forwardRef, useMemo } from "react";
import {
  AREAS,
  ATRIUM_COLUMNS,
  ATRIUM_VOID,
  BRIDGES,
  COURT_FIXTURES,
  ELEVATOR,
  ESCALATORS,
  FOUNTAIN,
  GALLERY_RING,
  INFO_DESK,
  STORE_FOOTPRINTS,
  WALKWAYS,
  WING_VOIDS,
  ATRIUM_CAFE,
} from "@/data/layout";
import { STORES } from "@/data/stores";
import type { Rect, Route } from "@/types";
import { localToWorld } from "@/lib/space";
import { cn } from "../ui/primitives";

/**
 * Plan view of one level in world units (1 SVG unit = 1 m; X east, Z south). Shared by the
 * minimap and the directory, so both always match the 3D layout. Routes draw only the
 * segments on the shown level, with markers where they change level.
 */

interface MallMapProps {
  viewBox: string;
  floor: number;
  route?: Route | null;
  selectedStoreId?: string | null;
  onSelectStore?: (id: string) => void;
  showLabels?: boolean;
  className?: string;
  /** Font size for store labels in metres. */
  labelSize?: number;
  title: string;
  children?: React.ReactNode;
}

function R({ r, className }: { r: Rect; className?: string }) {
  return <rect x={r.minX} y={r.minZ} width={r.maxX - r.minX} height={r.maxZ - r.minZ} className={className} />;
}

/** The player marker; its transform is driven imperatively for smooth updates. */
export const PlayerMarker = forwardRef<SVGGElement, { size?: number }>(function PlayerMarker({ size = 2.2 }, ref) {
  return (
    <g ref={ref}>
      <circle r={size * 2.4} className="fill-bronze/15" />
      <path d={`M 0 ${-size * 1.6} L ${size} ${size} L 0 ${size * 0.45} L ${-size} ${size} Z`} className="fill-bronze stroke-ink" strokeWidth={size * 0.18} />
    </g>
  );
});

export const MallMap = forwardRef<SVGSVGElement, MallMapProps>(function MallMap(
  { viewBox, floor, route, selectedStoreId, onSelectStore, showLabels = true, className, labelSize = 2.6, title, children },
  ref,
) {
  const walkable = useMemo<Rect[]>(
    () => (floor === 0 ? Object.values(AREAS) : [...GALLERY_RING, ...WALKWAYS, ...(BRIDGES[floor] ?? []), AREAS.northCourt]),
    [floor],
  );
  const segments = useMemo(() => {
    if (!route) return [] as string[];
    const out: string[] = [];
    for (const leg of route.legs) {
      const pts = leg.points.filter((p) => p.floor === floor);
      if (leg.transit.type === "walk" && pts.length > 1) out.push(pts.map((p) => `${p.x},${p.z}`).join(" "));
    }
    return out;
  }, [route, floor]);
  const transfers = useMemo(() => {
    if (!route) return [];
    return route.legs
      .filter((l) => l.transit.type !== "walk")
      .flatMap((l) => {
        const start = l.points[0];
        const end = l.points[l.points.length - 1];
        return [start, end].filter((p) => p.floor === floor).map((p) => ({ x: p.x, z: p.z, up: end.floor > start.floor }));
      });
  }, [route, floor]);
  const end = route?.legs.at(-1)?.points.at(-1);

  return (
    <svg ref={ref} viewBox={viewBox} className={cn("block", className)} role="img" aria-label={title}>
      <title>{title}</title>
      <g className="fill-[#2b261f] stroke-[#4a4135]" strokeWidth={0.3}>
        {walkable.map((a, i) => (
          <R key={i} r={a} />
        ))}
      </g>
      {floor > 0 && (
        <g className="fill-[#14120e] stroke-[#5d5446]" strokeWidth={0.25} strokeDasharray="1 0.8">
          <R r={ATRIUM_VOID} />
          {WING_VOIDS.map((v, i) => (
            <R key={i} r={v} />
          ))}
        </g>
      )}
      <g className="fill-[#3a3329]">
        {floor === 0 && <R r={ATRIUM_CAFE} />}
        {(COURT_FIXTURES[floor] ?? []).map((r, i) => (
          <R key={i} r={r} />
        ))}
      </g>
      {floor === 0 && (
        <>
          <circle cx={FOUNTAIN.x} cy={FOUNTAIN.z} r={FOUNTAIN.planterRadius} className="fill-[#3d4a36]" />
          <circle cx={FOUNTAIN.x} cy={FOUNTAIN.z} r={FOUNTAIN.basinRadius} className="fill-[#5f8a96]" />
          <circle cx={INFO_DESK.x} cy={INFO_DESK.z} r={INFO_DESK.r} className="fill-[#6b5a44]" />
        </>
      )}
      {ATRIUM_COLUMNS.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.z} r={0.6} className="fill-[#8a7e6c]" />
      ))}
      {/* Escalators (drawn on both levels they connect) and the lift */}
      {ESCALATORS.filter((e) => e.fromFloor === floor || e.toFloor === floor).map((e) => (
        <g key={e.id}>
          <rect x={e.bottomX} y={-e.halfWidth} width={e.topX - e.bottomX} height={e.halfWidth * 2} className="fill-[#4b4031] stroke-[#8a7e6c]" strokeWidth={0.25} />
          <path d={`M ${e.bottomX + 2} 0 L ${e.topX - 2} 0 M ${e.topX - 3.4} -1 L ${e.topX - 2} 0 L ${e.topX - 3.4} 1`} className="fill-none stroke-ivory/60" strokeWidth={0.35} />
        </g>
      ))}
      <circle cx={ELEVATOR.x} cy={ELEVATOR.z} r={ELEVATOR.r} className="fill-[#2f3a44] stroke-[#9fb4cc]" strokeWidth={0.35} />
      <text x={ELEVATOR.x} y={ELEVATOR.z} textAnchor="middle" dominantBaseline="middle" fontSize={1.4} className="pointer-events-none fill-[#cfdbe6] font-semibold">
        LIFT
      </text>

      {/* Stores on this level */}
      {STORE_FOOTPRINTS.filter((f) => f.floor === floor).map((f) => {
        const store = STORES.find((s) => s.id === f.storeId)!;
        const selected = selectedStoreId === store.id;
        const door = localToWorld(store, 0, 0);
        const cx = (f.interior.minX + f.interior.maxX) / 2;
        const cz = (f.interior.minZ + f.interior.maxZ) / 2;
        const interactive = !!onSelectStore;
        return (
          <g
            key={store.id}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${store.name}, ${store.categoryLabel}` : undefined}
            aria-pressed={interactive ? selected : undefined}
            onClick={interactive ? () => onSelectStore(store.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectStore(store.id);
                    }
                  }
                : undefined
            }
            className={cn(interactive && "cursor-pointer outline-none [&:focus-visible>rect]:stroke-ivory")}
          >
            <rect
              x={f.interior.minX + 0.4}
              y={f.interior.minZ + 0.4}
              width={f.interior.maxX - f.interior.minX - 0.8}
              height={f.interior.maxZ - f.interior.minZ - 0.8}
              rx={0.8}
              fill={store.theme.accent}
              fillOpacity={selected ? 0.75 : 0.32}
              stroke={selected ? "#f3ece0" : store.theme.accent}
              strokeWidth={selected ? 0.6 : 0.3}
            />
            <circle cx={door.x} cy={door.z} r={0.9} fill="#f3ece0" fillOpacity={0.85} />
            {showLabels && (
              <text x={cx} y={cz} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize} className="pointer-events-none select-none fill-ivory font-medium">
                {store.name}
              </text>
            )}
          </g>
        );
      })}

      {segments.map((pts, i) => (
        <g key={i}>
          <polyline points={pts} fill="none" stroke="#15130f" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline
            points={pts}
            fill="none"
            stroke="#d8b47a"
            strokeWidth={1.1}
            strokeDasharray="2.4 1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="motion-safe:animate-[mv-dash_1.2s_linear_infinite]"
          />
        </g>
      ))}
      {transfers.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.z})`}>
          <circle r={1.7} className="fill-ink stroke-bronze" strokeWidth={0.35} />
          <path d={t.up ? "M -0.8 0.5 L 0 -0.6 L 0.8 0.5" : "M -0.8 -0.5 L 0 0.6 L 0.8 -0.5"} className="fill-none stroke-bronze" strokeWidth={0.4} />
        </g>
      ))}
      {end && end.floor === floor && <circle cx={end.x} cy={end.z} r={1.6} className="fill-bronze stroke-ink" strokeWidth={0.4} />}
      {children}
    </svg>
  );
});
