import { useMemo, type ReactNode } from "react";
import type { FloorPlan as Plan, FurnitureItem, Wall } from "../types";
import { buildWalls, solidSpans, ROOM_FILL, WALL_T } from "../lib/layout";

interface Props {
  plan: Plan;
  showFurniture?: boolean;
  showLabels?: boolean;
  className?: string;
  /** Optional "you are here" camera marker (plan coords, metres). */
  marker?: { x: number; z: number };
  /** Optional room id to subtly highlight. */
  highlightRoom?: string;
  /** Room ids that can be clicked to jump to that viewpoint. */
  clickableRooms?: string[];
  onRoomClick?: (roomId: string) => void;
  /**
   * Unit-level selection (used by UnitCard). When provided, the entire plan
   * becomes a click target that calls this handler — triggering the same
   * selectUnit flow as clicking a 3D tower marker (camera fly + interior).
   */
  onSelect?: () => void;
  /** Whether this plan's unit is the currently selected one (highlight ring). */
  selected?: boolean;
}

const C_EXT = "#cdb088"; // exterior wall (champagne)
const C_INT = "#7f7869"; // interior partition
const C_GLASS = "#9fb9c4"; // glazing
const C_FURN = "rgba(230,211,179,0.45)";

function WallShape({ w }: { w: Wall }) {
  const t = w.exterior ? WALL_T * 1.5 : WALL_T;
  const color = w.kind === "glass" ? C_GLASS : w.exterior ? C_EXT : C_INT;

  if (w.kind === "glass" || w.kind === "rail") {
    // Double hairline for glazing / single dashed for rail.
    const lines =
      w.kind === "glass"
        ? [-0.05, 0.05]
        : [0];
    return (
      <g>
        {lines.map((off, i) =>
          w.dir === "z" ? (
            <line
              key={i}
              x1={w.coord + off}
              y1={w.a}
              x2={w.coord + off}
              y2={w.b}
              stroke={color}
              strokeWidth={0.045}
              strokeDasharray={w.kind === "rail" ? "0.18 0.16" : undefined}
              opacity={0.9}
            />
          ) : (
            <line
              key={i}
              x1={w.a}
              y1={w.coord + off}
              x2={w.b}
              y2={w.coord + off}
              stroke={color}
              strokeWidth={0.045}
              strokeDasharray={w.kind === "rail" ? "0.18 0.16" : undefined}
              opacity={0.9}
            />
          ),
        )}
      </g>
    );
  }

  return (
    <g>
      {solidSpans(w).map(([s, e], i) =>
        w.dir === "z" ? (
          <rect key={i} x={w.coord - t / 2} y={s} width={t} height={e - s} fill={color} />
        ) : (
          <rect key={i} x={s} y={w.coord - t / 2} width={e - s} height={t} fill={color} />
        ),
      )}
      {/* door swing arc */}
      {w.door &&
        (w.dir === "z" ? (
          <path
            d={`M ${w.coord} ${w.door.at - w.door.width / 2} a ${w.door.width} ${w.door.width} 0 0 1 ${w.door.width} ${w.door.width}`}
            fill="none"
            stroke={C_INT}
            strokeWidth={0.025}
            opacity={0.55}
          />
        ) : (
          <path
            d={`M ${w.door.at - w.door.width / 2} ${w.coord} a ${w.door.width} ${w.door.width} 0 0 0 ${w.door.width} ${w.door.width}`}
            fill="none"
            stroke={C_INT}
            strokeWidth={0.025}
            opacity={0.55}
          />
        ))}
    </g>
  );
}

function Furniture2D({ f }: { f: FurnitureItem }) {
  const s = f.scale ?? 1;
  const stroke = C_FURN;
  const sw = 0.04;
  const common = { fill: "none", stroke, strokeWidth: sw } as const;

  let shape: ReactNode = null;
  switch (f.kind) {
    case "sectional":
    case "sofa": {
      const w = (f.kind === "sectional" ? 2.7 : 2.1) * s;
      const d = 0.95 * s;
      shape = (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.12} {...common} />
          <rect x={-w / 2} y={-d / 2 - 0.18} width={w} height={0.22} rx={0.08} {...common} />
          {f.kind === "sectional" && (
            <rect x={-w / 2 - 0.18} y={-d / 2} width={0.22} height={d * 1.4} rx={0.08} {...common} />
          )}
        </g>
      );
      break;
    }
    case "coffeeTable":
      shape = <rect x={-0.55 * s} y={-0.32 * s} width={1.1 * s} height={0.64 * s} rx={0.08} {...common} />;
      break;
    case "rug":
      shape = (
        <rect
          x={-1.5 * s}
          y={-1.1 * s}
          width={3.0 * s}
          height={2.2 * s}
          rx={0.05}
          fill="none"
          stroke={stroke}
          strokeWidth={0.03}
          strokeDasharray="0.2 0.16"
        />
      );
      break;
    case "tv":
    case "tvBoard":
      shape = (
        <g>
          <rect x={-0.9 * s} y={-0.2} width={1.8 * s} height={0.4} rx={0.05} {...common} />
          <line x1={-0.5 * s} y1={-0.2} x2={0.5 * s} y2={-0.2} stroke={stroke} strokeWidth={0.06} />
        </g>
      );
      break;
    case "diningTable":
      shape = (
        <g>
          <rect x={-0.75 * s} y={-0.5 * s} width={1.5 * s} height={1.0 * s} rx={0.08} {...common} />
          {[-0.5, 0.5].map((cx) =>
            [-0.65, 0.65].map((cy) => (
              <circle key={`${cx}-${cy}`} cx={cx * s} cy={cy * s} r={0.18 * s} {...common} />
            )),
          )}
        </g>
      );
      break;
    case "island":
      shape = (
        <g>
          <rect x={-0.9 * s} y={-0.45 * s} width={1.8 * s} height={0.9 * s} rx={0.06} {...common} />
          <line x1={-0.9 * s} y1={0} x2={0.9 * s} y2={0} stroke={stroke} strokeWidth={0.025} opacity={0.6} />
        </g>
      );
      break;
    case "kitchen":
      shape = (
        <g>
          <rect x={-1.2 * s} y={-0.32} width={2.4 * s} height={0.62} rx={0.04} {...common} />
          <circle cx={-0.5 * s} cy={0} r={0.13} {...common} />
          <rect x={0.3 * s} y={-0.14} width={0.5} height={0.28} {...common} />
        </g>
      );
      break;
    case "bed":
    case "bedDouble": {
      const w = (f.kind === "bedDouble" ? 1.6 : 1.05) * s;
      const d = 2.0 * s;
      shape = (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.1} {...common} />
          {(f.kind === "bedDouble" ? [-0.36, 0.36] : [0]).map((px) => (
            <rect key={px} x={px * w - 0.28 * s} y={-d / 2 + 0.12} width={0.56 * s} height={0.4 * s} rx={0.08} {...common} />
          ))}
        </g>
      );
      break;
    }
    case "nightstand":
      shape = <rect x={-0.25} y={-0.25} width={0.5} height={0.5} rx={0.04} {...common} />;
      break;
    case "wardrobe":
      shape = <rect x={-0.9 * s} y={-0.3} width={1.8 * s} height={0.6} {...common} />;
      break;
    case "desk":
      shape = (
        <g>
          <rect x={-0.7 * s} y={-0.3} width={1.4 * s} height={0.6} rx={0.04} {...common} />
          <circle cx={0} cy={0.55} r={0.22} {...common} />
        </g>
      );
      break;
    case "shelf":
      shape = <rect x={-0.9 * s} y={-0.18} width={1.8 * s} height={0.36} {...common} />;
      break;
    case "plant":
      shape = (
        <g>
          <circle cx={0} cy={0} r={0.34 * s} {...common} />
          <circle cx={0} cy={0} r={0.16 * s} {...common} opacity={0.6} />
        </g>
      );
      break;
    case "lounge":
      shape = <rect x={-0.45 * s} y={-0.45 * s} width={0.9 * s} height={0.9 * s} rx={0.18} {...common} />;
      break;
    case "artwork":
      shape = <line x1={-0.6 * s} y1={0} x2={0.6 * s} y2={0} stroke={stroke} strokeWidth={0.08} />;
      break;
    case "pendant":
      shape = <circle cx={0} cy={0} r={0.12} fill={stroke} opacity={0.5} />;
      break;
    default:
      shape = null;
  }
  return <g transform={`translate(${f.x} ${f.z}) rotate(${f.rot ?? 0})`}>{shape}</g>;
}

export default function FloorPlan({
  plan,
  showFurniture = true,
  showLabels = true,
  className,
  marker,
  highlightRoom,
  clickableRooms,
  onRoomClick,
  onSelect,
  selected = false,
}: Props) {
  const walls = useMemo(() => buildWalls(plan), [plan]);
  const pad = 0.9;
  const vb = `${-pad} ${-pad} ${plan.widthM + pad * 2} ${plan.depthM + pad * 2}`;
  // Plan bounds (metres) used for the selection ring + click target overlay.
  const bx = -0.2;
  const by = -0.2;
  const bw = plan.widthM + 0.4;
  const bh = plan.depthM + 0.4;

  return (
    <svg viewBox={vb} className={className} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={`${plan.layout}の平面図`}>
      {/* room fills */}
      {plan.rooms.map((r) => (
        <rect key={r.id} x={r.x} y={r.z} width={r.w} height={r.d}
          fill={
            highlightRoom === r.id
              ? "rgba(205,176,136,0.22)"
              : ROOM_FILL[r.kind] ?? "rgba(255,255,255,0.02)"
          } />
      ))}
      {/* balcony hatch */}
      {plan.rooms
        .filter((r) => r.kind === "balcony")
        .map((r) => (
          <g key={`h-${r.id}`} opacity={0.4} clipPath={`url(#clip-${r.id})`}>
            <defs>
              <clipPath id={`clip-${r.id}`}>
                <rect x={r.x} y={r.z} width={r.w} height={r.d} />
              </clipPath>
            </defs>
            {Array.from({ length: Math.ceil((r.w + r.d) / 0.5) }).map((_, i) => {
              const x0 = r.x - r.d + i * 0.5;
              return (
                <line key={i} x1={x0} y1={r.z} x2={x0 + r.d} y2={r.z + r.d}
                  stroke={C_GLASS} strokeWidth={0.02} />
              );
            })}
          </g>
        ))}

      {showFurniture && plan.furniture.map((f, i) => <Furniture2D key={i} f={f} />)}

      {walls.map((w, i) => <WallShape key={i} w={w} />)}

      {/* labels */}
      {showLabels &&
        plan.rooms
          .filter((r) => r.label)
          .map((r) => (
            <g key={`l-${r.id}`} textAnchor="middle">
              <text
                x={r.x + r.w / 2}
                y={r.z + r.d / 2}
                fontSize={Math.min(0.42, r.w / (r.label.length * 0.62 + 1))}
                fill="rgba(255,255,255,0.82)"
                style={{ fontFamily: "Shippori Mincho, serif", letterSpacing: "0.02em" }}
              >
                {r.label}
              </text>
              {r.sub && (
                <text
                  x={r.x + r.w / 2}
                  y={r.z + r.d / 2 + 0.55}
                  fontSize={0.3}
                  fill="rgba(205,176,136,0.85)"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {r.sub}
                </text>
              )}
            </g>
          ))}

      {/* clickable room hotspots (jump to that viewpoint) */}
      {clickableRooms &&
        onRoomClick &&
        plan.rooms
          .filter((r) => clickableRooms.includes(r.id))
          .map((r) => (
            <rect
              key={`hot-${r.id}`}
              x={r.x}
              y={r.z}
              width={r.w}
              height={r.d}
              fill="rgba(205,176,136,0.001)"
              stroke="rgba(205,176,136,0.55)"
              strokeWidth={0.05}
              strokeDasharray="0.25 0.18"
              style={{ cursor: "pointer" }}
              onClick={() => onRoomClick(r.id)}
            >
              <title>{r.label || r.id}へ移動</title>
            </rect>
          ))}

      {/* camera "you are here" marker */}
      {marker && (
        <g transform={`translate(${marker.x} ${marker.z})`}>
          <circle r={0.55} fill="rgba(205,176,136,0.18)">
            <animate attributeName="r" values="0.4;0.7;0.4" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r={0.18} fill="#cdb088" />
        </g>
      )}

      {/* North arrow */}
      <g transform={`translate(${plan.widthM + pad - 0.5} ${-pad + 0.6})`} opacity={0.8}>
        <line x1={0} y1={0.45} x2={0} y2={-0.45} stroke={C_EXT} strokeWidth={0.05} />
        <path d="M 0 -0.55 L 0.18 -0.2 L -0.18 -0.2 Z" fill={C_EXT} />
        <text x={0} y={0.85} fontSize={0.32} fill={C_EXT} textAnchor="middle"
          style={{ fontFamily: "Inter, sans-serif" }}>N</text>
      </g>

      {/* selected-unit highlight ring (champagne glow) */}
      {selected && (
        <g pointerEvents="none">
          <rect
            x={bx - 0.06}
            y={by - 0.06}
            width={bw + 0.12}
            height={bh + 0.12}
            rx={0.12}
            fill="none"
            stroke="#e6d3b3"
            strokeWidth={0.22}
            opacity={0.22}
          />
          <rect
            x={bx}
            y={by}
            width={bw}
            height={bh}
            rx={0.1}
            fill="none"
            stroke="#cdb088"
            strokeWidth={0.09}
            opacity={0.95}
          />
        </g>
      )}

      {/* unit-level click target: makes the whole plan a button that triggers
          the same selectUnit flow as clicking a 3D tower marker. Rendered last
          so it sits above all other shapes and captures pointer events. */}
      {onSelect && (
        <rect
          x={-pad}
          y={-pad}
          width={plan.widthM + pad * 2}
          height={plan.depthM + pad * 2}
          fill="rgba(205,176,136,0.001)"
          style={{ cursor: "pointer" }}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${plan.name} を3Dで内覧する`}
        >
          <title>{plan.name} を3Dで内覧する</title>
        </rect>
      )}
    </svg>
  );
}
