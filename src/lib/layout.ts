import type { FloorPlan, RoomRect, Wall, Facing } from "../types";

const EPS = 0.02;
export const WALL_T = 0.11;
export const DOOR_W = 0.92;

const near = (a: number, b: number) => Math.abs(a - b) < EPS;

interface Edge {
  coord: number;
  a: number;
  b: number;
}

// Merge a set of 1-D intervals into their disjoint union.
function mergeIntervals(edges: Edge[]): Array<{ a: number; b: number }> {
  const sorted = [...edges].sort((p, q) => p.a - q.a);
  const out: Array<{ a: number; b: number }> = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (last && e.a <= last.b + EPS) {
      last.b = Math.max(last.b, e.b);
    } else {
      out.push({ a: e.a, b: e.b });
    }
  }
  return out;
}

function groupBy(edges: Edge[]): Map<number, Edge[]> {
  const map = new Map<number, Edge[]>();
  for (const e of edges) {
    let key = -1;
    for (const k of map.keys()) {
      if (near(k, e.coord)) {
        key = k;
        break;
      }
    }
    if (key === -1) key = e.coord;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}

function balconyOf(plan: FloorPlan): RoomRect | undefined {
  return plan.rooms.find((r) => r.kind === "balcony");
}

function withinBalconyX(plan: FloorPlan, a: number, b: number): boolean {
  const bal = balconyOf(plan);
  if (!bal) return false;
  return a >= bal.x - EPS && b <= bal.x + bal.w + EPS;
}

/**
 * Derive every wall (and its door opening) from the room rectangles.
 * Exterior glazed sides → glass. The boundary with a balcony → glass
 * sliding doors. The balcony's outer edge → glass rail. Interior
 * partitions → solid walls with a centred doorway.
 */
export function buildWalls(plan: FloorPlan): Wall[] {
  const { rooms, widthM, depthM } = plan;
  const bal = balconyOf(plan);
  const walls: Wall[] = [];

  // --- Vertical walls (constant x, extend along z) ---
  const vEdges: Edge[] = [];
  for (const r of rooms) {
    vEdges.push({ coord: r.x, a: r.z, b: r.z + r.d });
    vEdges.push({ coord: r.x + r.w, a: r.z, b: r.z + r.d });
  }
  for (const [x, edges] of groupBy(vEdges)) {
    const exterior = near(x, 0) || near(x, widthM);
    for (const run of mergeIntervals(edges)) {
      const len = run.b - run.a;
      // A vertical run sitting fully inside the balcony depth = glass rail.
      const inBalcony =
        bal && run.a >= bal.z - EPS && run.b <= bal.z + bal.d + EPS;
      if (inBalcony) {
        walls.push({ dir: "z", coord: x, a: run.a, b: run.b, kind: "rail", exterior });
        continue;
      }
      if (plan.glazedSides.includes(near(x, 0) ? "left" : "right") && exterior) {
        walls.push({ dir: "z", coord: x, a: run.a, b: run.b, kind: "glass", exterior });
        continue;
      }
      const door =
        !exterior && len >= 1.8
          ? { at: (run.a + run.b) / 2, width: DOOR_W }
          : undefined;
      walls.push({ dir: "z", coord: x, a: run.a, b: run.b, kind: "solid", exterior, door });
    }
  }

  // --- Horizontal walls (constant z, extend along x) ---
  const hEdges: Edge[] = [];
  for (const r of rooms) {
    hEdges.push({ coord: r.z, a: r.x, b: r.x + r.w });
    hEdges.push({ coord: r.z + r.d, a: r.x, b: r.x + r.w });
  }
  for (const [z, edges] of groupBy(hEdges)) {
    const exterior = near(z, 0) || near(z, depthM);
    for (const run of mergeIntervals(edges)) {
      const len = run.b - run.a;
      // Boundary with the balcony interior edge → full-height glazing.
      if (bal && near(z, bal.z) && withinBalconyX(plan, run.a, run.b)) {
        walls.push({ dir: "x", coord: z, a: run.a, b: run.b, kind: "glass", exterior: false });
        continue;
      }
      // Balcony outer edge → glass rail.
      if (bal && near(z, bal.z + bal.d)) {
        walls.push({ dir: "x", coord: z, a: run.a, b: run.b, kind: "rail", exterior: true });
        continue;
      }
      if (exterior && plan.glazedSides.includes(near(z, 0) ? "top" : "bottom")) {
        walls.push({ dir: "x", coord: z, a: run.a, b: run.b, kind: "glass", exterior: true });
        continue;
      }
      const door =
        !exterior && len >= 1.8
          ? { at: (run.a + run.b) / 2, width: DOOR_W }
          : undefined;
      walls.push({ dir: "x", coord: z, a: run.a, b: run.b, kind: "solid", exterior, door });
    }
  }

  return walls;
}

/** Split a wall span into its solid runs around the door opening. */
export function solidSpans(w: Wall): Array<[number, number]> {
  if (!w.door) return [[w.a, w.b]];
  const { at, width } = w.door;
  return (
    [
      [w.a, at - width / 2],
      [at + width / 2, w.b],
    ] as Array<[number, number]>
  ).filter(([s, e]) => e - s > 0.02);
}

// ------------------------------------------------------------------
// Presentation helpers
// ------------------------------------------------------------------
export const FACING_JP: Record<Facing, string> = {
  S: "南向き",
  SE: "南東向き",
  SW: "南西向き",
  E: "東向き",
  W: "西向き",
  N: "北向き",
};

export const FLOOR_HEX: Record<string, string> = {
  oak: "#9a7650",
  marble: "#d8d4cc",
  carpet: "#5c5750",
  tile: "#cfcabf",
  deck: "#7c6a52",
};

/** Soft top-down fill colour per room kind for the SVG plan. */
export const ROOM_FILL: Record<string, string> = {
  ldk: "rgba(205,176,136,0.10)",
  master: "rgba(205,176,136,0.07)",
  bedroom: "rgba(205,176,136,0.05)",
  bath: "rgba(120,160,180,0.10)",
  powder: "rgba(120,160,180,0.08)",
  toilet: "rgba(120,160,180,0.08)",
  entry: "rgba(255,255,255,0.03)",
  corridor: "rgba(255,255,255,0.02)",
  wic: "rgba(255,255,255,0.03)",
  balcony: "rgba(120,140,160,0.05)",
};

export function formatPrice(oku: number): string {
  const total = Math.round(oku * 10000); // 万円
  const okuPart = Math.floor(total / 10000);
  const manPart = total % 10000;
  if (okuPart > 0 && manPart > 0)
    return `${okuPart}億${manPart.toLocaleString()}万円`;
  if (okuPart > 0) return `${okuPart}億円`;
  return `${manPart.toLocaleString()}万円`;
}
