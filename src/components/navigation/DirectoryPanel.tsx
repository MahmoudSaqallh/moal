"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Footprints, Route as RouteIcon, Search, ShoppingBag, X, Clock, MapPin, Zap, ArrowUpDown } from "lucide-react";
import { STORES, getStore } from "@/data/stores";
import { DESTINATIONS, getDestination } from "@/data/navigation";
import { FLOORS } from "@/data/floors";
import { MAP_BOUNDS } from "@/data/layout";
import type { StoreCategory } from "@/types";
import { player } from "@/lib/runtime";
import { planRoute } from "@/lib/pathfinding";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { fastTravel, navigateTo } from "@/features/exploration/actions";
import { Button, IconButton, cn, useFocusTrap } from "../ui/primitives";
import { MallMap, PlayerMarker } from "./MallMap";

const CATEGORIES: { id: StoreCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fashion", label: "Fashion" },
  { id: "accessories", label: "Accessories" },
  { id: "footwear", label: "Sneakers" },
  { id: "home", label: "Home" },
  { id: "technology", label: "Electronics" },
  { id: "gaming", label: "Gaming" },
  { id: "food", label: "Food & coffee" },
];

function walkTime(meters: number) {
  const min = Math.max(1, Math.round(meters / 1.3 / 60));
  return `${Math.round(meters)} m · ${min} min`;
}

/** Full-screen mall directory: search, categories, three-level map, cross-floor wayfinding. */
export function DirectoryPanel() {
  const open = useExperienceStore((s) => s.panel === "directory");
  const close = () => useExperienceStore.getState().openPanel(null);
  const ref = useFocusTrap(open, close);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoreCategory | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const currentFloor = useExperienceStore((s) => s.floor);
  const [viewFloor, setViewFloor] = useState<number | null>(null);
  const zoneId = useExperienceStore((s) => s.zoneId);
  const phase = useExperienceStore((s) => s.phase);
  const marker = useRef<SVGGElement>(null);
  const canMove = phase === "explore";
  const floor = viewFloor ?? currentFloor;

  useEffect(() => {
    if (!open) return;
    marker.current?.setAttribute("transform", `translate(${player.x} ${player.z}) rotate(${(-player.yaw * 180) / Math.PI})`);
  }, [open, floor]);

  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STORES.filter(
      (s) =>
        (category === "all" || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || s.categoryLabel.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q)),
    );
  }, [query, category]);
  const landmarks = useMemo(
    () => DESTINATIONS.filter((d) => d.kind !== "store" && (!query || d.label.toLowerCase().includes(query.trim().toLowerCase()))),
    [query],
  );

  const preview = useMemo(() => {
    if (!open || !selected) return null;
    const dest = getDestination(selected);
    if (!dest) return null;
    return planRoute({ x: player.x, z: player.z, floor: currentFloor }, dest.nodeId, dest.label);
  }, [open, selected, currentFloor]);

  if (!open) return null;

  const store = selected ? getStore(selected) : undefined;
  const dest = selected ? getDestination(selected) : undefined;
  const here = zoneId === `store:${selected}`;
  const b = MAP_BOUNDS;
  const select = (id: string) => {
    setSelected(id);
    const d = getDestination(id);
    if (d) setViewFloor(d.floor);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/55 p-0 anim-fade sm:p-6" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-title"
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden border-line bg-ink shadow-[var(--shadow-panel)] anim-rise sm:rounded-[var(--radius-panel)] sm:border lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-col border-line lg:w-[380px] lg:border-r">
          <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Three levels · {STORES.length} stores</p>
              <h2 id="directory-title" className="font-display text-3xl leading-tight text-ivory">
                Mall directory
              </h2>
            </div>
            <IconButton label="Close directory" shortcut="Esc" onClick={close}>
              <X size={18} aria-hidden />
            </IconButton>
          </header>
          <div className="px-5">
            <label htmlFor="store-search" className="mb-1.5 block text-xs font-medium text-muted">
              Search stores
            </label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input
                id="store-search"
                data-autofocus
                value={query}
                dir="auto"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. sneakers, ramen"
                className="h-10 w-full rounded-[10px] border border-line-strong bg-ink-2 pl-9 pr-3 text-sm text-ivory placeholder:text-faint focus:border-bronze/70 focus:outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                    category === c.id ? "border-bronze/60 bg-bronze/15 text-ivory" : "border-line text-muted hover:border-line-strong hover:text-ivory",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mv-scroll mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {FLOORS.map((f) => {
              const list = stores.filter((s) => s.floor === f.index);
              if (!list.length) return null;
              return (
                <section key={f.index} aria-label={`${f.name}, ${f.theme}`} className="mb-2">
                  <h3 className="flex items-center gap-2 px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
                    <span className="rounded bg-ink-3 px-1.5 py-0.5 text-ivory">{f.label}</span> {f.theme}
                  </h3>
                  <ul className="space-y-1">
                    {list.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => select(s.id)}
                          aria-current={selected === s.id}
                          className={cn("flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors", selected === s.id ? "bg-ink-3" : "hover:bg-ink-2")}
                        >
                          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: s.theme.accent }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ivory">{s.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {s.categoryLabel} · {s.tagline}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {stores.length === 0 && (
              <div className="px-2 py-6 text-sm text-muted">
                <p>No stores match “{query}”.</p>
                <Button
                  variant="ghost"
                  className="-ml-2 mt-2"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                >
                  Clear search and filters
                </Button>
              </div>
            )}
            {landmarks.length > 0 && (
              <>
                <h3 className="mt-4 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Landmarks & transport</h3>
                <ul className="mt-1 space-y-1" aria-label="Landmarks">
                  {landmarks.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => select(d.id)}
                        aria-current={selected === d.id}
                        className={cn("flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left text-sm transition-colors", selected === d.id ? "bg-ink-3 text-ivory" : "text-muted hover:bg-ink-2 hover:text-ivory")}
                      >
                        {d.kind === "transport" ? <ArrowUpDown size={15} aria-hidden className="text-bronze" /> : <MapPin size={15} aria-hidden className="text-bronze" />}
                        <span className="flex-1">{d.label}</span>
                        <span className="text-[11px] text-faint">L{d.floor + 1}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col bg-[#181510]">
          <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5" role="tablist" aria-label="Level">
            {FLOORS.map((f) => (
              <button
                key={f.index}
                type="button"
                role="tab"
                aria-selected={floor === f.index}
                onClick={() => setViewFloor(f.index)}
                className={cn("h-8 rounded-full px-3 text-xs font-medium transition-colors", floor === f.index ? "bg-ivory text-ink" : "text-muted hover:bg-ink-3 hover:text-ivory")}
              >
                {f.label} · {f.theme}
              </button>
            ))}
          </div>
          <div className="relative min-h-[220px] flex-1">
            <MallMap
              viewBox={`${b.minX} ${b.minZ} ${b.maxX - b.minX} ${b.maxZ - b.minZ}`}
              floor={floor}
              route={preview}
              selectedStoreId={store?.id ?? null}
              onSelectStore={select}
              title={`Plan of level ${floor + 1}`}
              className="absolute inset-0 h-full w-full p-4"
            >
              {floor === currentFloor && <PlayerMarker ref={marker} size={1.7} />}
            </MallMap>
            <p className="pointer-events-none absolute left-4 top-3 text-xs text-faint">
              {floor === currentFloor ? "You are here: bronze arrow · North is up" : `You are on level ${currentFloor + 1}`}
            </p>
          </div>
          {dest && (
            <div className="border-t border-line bg-ink px-5 py-4 anim-rise" aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-2xl text-ivory">
                    {dest.label} <span className="align-middle text-xs font-sans text-faint">Level {dest.floor + 1}</span>
                  </h3>
                  {store && <p className="mt-0.5 text-sm text-muted">{store.description}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                    {store && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} aria-hidden /> Open {store.hours}
                      </span>
                    )}
                    {preview && !here && (
                      <span className="inline-flex items-center gap-1">
                        <Footprints size={13} aria-hidden /> {walkTime(preview.length)}
                      </span>
                    )}
                    {here && <span className="text-sage">You are inside this store</span>}
                  </p>
                  {preview && !here && preview.legs.length > 1 && (
                    <ol className="mt-2 space-y-0.5 text-xs text-muted">
                      {preview.legs.map((l, i) => (
                        <li key={i}>
                          {i + 1}. {l.instruction}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {store && (
                    <Button onClick={() => useExperienceStore.getState().browseStore(store.id)}>
                      <ShoppingBag size={16} aria-hidden /> Browse
                    </Button>
                  )}
                  <Button disabled={!canMove || here || !preview} onClick={() => navigateTo(dest.id, false) && close()}>
                    <RouteIcon size={16} aria-hidden /> Show route
                  </Button>
                  <Button disabled={!canMove || here} onClick={() => fastTravel(dest.id)}>
                    <Zap size={16} aria-hidden /> Fast travel
                  </Button>
                  <Button variant="primary" disabled={!canMove || here || !preview} onClick={() => navigateTo(dest.id, true)}>
                    <Footprints size={16} aria-hidden /> Walk me there
                  </Button>
                </div>
              </div>
              {!canMove && <p className="mt-2 text-xs text-faint">Enter the mall to get directions.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
