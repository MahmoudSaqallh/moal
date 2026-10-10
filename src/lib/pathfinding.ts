import type { FloorPoint, NavEdge, NavNode, Route, RouteLeg, RoutePoint, Transit, Vec2 } from "@/types";
import { NAV_EDGES, NAV_NODES, getNavNode } from "@/data/navigation";
import { getEscalator } from "@/data/layout";
import { floorY } from "@/data/floors";
import { segmentClear } from "./collision";
import { distance } from "./space";
import { laneFor, liftLegPoints } from "./transit";

interface Arc {
  to: string;
  transit: Transit;
  cost: number;
}

function edgeCost(a: NavNode, b: NavNode, transit: Transit): number {
  switch (transit.type) {
    case "walk":
      return distance(a.position, b.position);
    case "escalator":
      return 14;
    case "elevator":
      // Waiting plus travel; slightly dearer than an escalator for one level.
      return 16 + 5 * Math.abs(b.floor - a.floor);
  }
}

function buildGraph(nodes: readonly NavNode[], edges: readonly NavEdge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const graph = new Map<string, Arc[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) throw new Error(`Nav edge references unknown node: ${e.from} -> ${e.to}`);
    graph.get(e.from)!.push({ to: e.to, transit: e.transit, cost: edgeCost(a, b, e.transit) });
    if (e.bidirectional) graph.get(e.to)!.push({ to: e.from, transit: e.transit, cost: edgeCost(b, a, e.transit) });
  }
  return graph;
}

const GRAPH = buildGraph(NAV_NODES, NAV_EDGES);

export interface PathResult {
  ids: string[];
  /** transits[i] is how ids[i] → ids[i+1] is travelled. */
  transits: Transit[];
}

/** Dijkstra over the directed nav graph. */
export function shortestPath(startId: string, goalId: string): PathResult | null {
  if (!GRAPH.has(startId) || !GRAPH.has(goalId)) return null;
  const dist = new Map<string, number>([[startId, 0]]);
  const prev = new Map<string, { id: string; transit: Transit }>();
  const open = new Set<string>([startId]);
  while (open.size) {
    let current = "";
    let best = Infinity;
    for (const id of open) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    open.delete(current);
    if (current === goalId) break;
    for (const arc of GRAPH.get(current) ?? []) {
      const nd = best + arc.cost;
      if (nd < (dist.get(arc.to) ?? Infinity)) {
        dist.set(arc.to, nd);
        prev.set(arc.to, { id: current, transit: arc.transit });
        open.add(arc.to);
      }
    }
  }
  if (!dist.has(goalId)) return null;
  const ids = [goalId];
  const transits: Transit[] = [];
  while (ids[0] !== startId) {
    const p = prev.get(ids[0])!;
    ids.unshift(p.id);
    transits.unshift(p.transit);
  }
  return { ids, transits };
}

/** Closest nav node on the same floor that the visitor can reach in a straight line. */
export function nearestReachableNode(pos: FloorPoint): NavNode | null {
  let best: NavNode | null = null;
  let bestD = Infinity;
  for (const node of NAV_NODES) {
    if (node.floor !== pos.floor) continue;
    const d = distance(pos, node.position);
    if (d < bestD && segmentClear(pos.floor, pos, node.position)) {
      best = node;
      bestD = d;
    }
  }
  return best;
}

function simplify(floor: number, points: Vec2[]): Vec2[] {
  if (points.length <= 2) return points;
  const out = [points[0]];
  let anchor = 0;
  for (let i = 2; i < points.length; i++) {
    if (!segmentClear(floor, points[anchor], points[i])) {
      out.push(points[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const lift3 = (p: Vec2, floor: number): RoutePoint => ({ x: p.x, z: p.z, floor, y: floorY(floor) });

function transitInstruction(t: Transit, toFloor: number): string {
  if (t.type === "escalator") {
    const e = getEscalator(t.escalatorId);
    return `Ride ${e?.label ?? "the escalator"} ${t.direction} to Level ${toFloor + 1}`;
  }
  if (t.type === "elevator") return `Take the lift to Level ${t.toFloor + 1}`;
  return "";
}

/**
 * Full route from an arbitrary position to a destination node, split into legs.
 * Walking legs are shortcut wherever a straight line is clear so the route hugs reality.
 */
export function planRoute(from: FloorPoint, goalNodeId: string, label = "destination"): Route | null {
  const goal = getNavNode(goalNodeId);
  if (!goal) return null;

  if (goal.floor === from.floor && segmentClear(from.floor, from, goal.position)) {
    const points = [lift3(from, from.floor), lift3(goal.position, goal.floor)];
    return { destinationId: goalNodeId, label, length: distance(from, goal.position), legs: [{ transit: { type: "walk" }, points, instruction: `Walk to ${label}` }] };
  }

  const start = nearestReachableNode(from);
  if (!start) return null;
  const path = shortestPath(start.id, goalNodeId);
  if (!path) return null;

  const legs: RouteLeg[] = [];
  let walk: Vec2[] = [from];
  let walkFloor = from.floor;
  const flushWalk = (instruction: string) => {
    if (walk.length >= 2) {
      const pts = simplify(walkFloor, walk).map((p) => lift3(p, walkFloor));
      legs.push({ transit: { type: "walk" }, points: pts, instruction });
    }
  };

  for (let i = 0; i < path.ids.length; i++) {
    const node = getNavNode(path.ids[i])!;
    const transit = path.transits[i]; // edge leaving this node, if any
    walk.push(node.position);
    if (!transit || transit.type === "walk") continue;

    const next = getNavNode(path.ids[i + 1])!;
    if (transit.type === "escalator") {
      const lane = laneFor(transit.escalatorId, transit.direction)!;
      walk.push(lane.entry);
      flushWalk(`Walk to ${getEscalator(transit.escalatorId)?.label ?? "the escalator"}`);
      legs.push({ transit, points: [lane.entry, lane.start, lane.end, lane.exit], instruction: transitInstruction(transit, next.floor) });
      walk = [lane.exit];
    } else {
      flushWalk("Walk to the lift");
      legs.push({ transit, points: liftLegPoints(node.floor, next.floor), instruction: transitInstruction(transit, next.floor) });
      walk = []; // the next node (the lift on the arrival floor) starts the walk
    }
    walkFloor = next.floor;
  }
  flushWalk(`Walk to ${label}`);

  return { destinationId: goalNodeId, label, legs, length: routeLength(legs) };
}

export function routeLength(legs: RouteLeg[]): number {
  let total = 0;
  for (const leg of legs) {
    for (let i = 1; i < leg.points.length; i++) {
      const a = leg.points[i - 1];
      const b = leg.points[i];
      total += Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y);
    }
  }
  return total;
}

/** All route vertices flattened (for drawing). */
export function routePoints(route: Route): RoutePoint[] {
  return route.legs.flatMap((l) => l.points);
}
