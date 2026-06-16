import { ArrowUpRight, Compass, Maximize, Box } from "lucide-react";
import type { Unit } from "../types";
import { PLANS } from "../data/residences";
import { FACING_JP, formatPrice } from "../lib/layout";
import FloorPlan from "./FloorPlan";

const STATUS: Record<
  Unit["status"],
  { label: string; cls: string; dot: string }
> = {
  available: { label: "空室", cls: "text-[#e6d3b3] border-[#cdb088]/50", dot: "bg-[#cdb088]" },
  negotiating: { label: "商談中", cls: "text-amber-200/80 border-amber-200/30", dot: "bg-amber-300/70" },
  sold: { label: "ご成約", cls: "text-white/40 border-white/15", dot: "bg-white/30" },
};

export default function UnitCard({
  unit,
  onSelect,
}: {
  unit: Unit;
  onSelect: (u: Unit) => void;
}) {
  const plan = PLANS[unit.planId];
  const st = STATUS[unit.status];
  const available = unit.status === "available";

  return (
    <div
      className={`glass-panel group relative flex flex-col rounded-3xl p-5 transition-all duration-500 sm:p-6 ${
        available ? "hover:-translate-y-1.5 hover:border-[#cdb088]/40" : "opacity-80"
      }`}
    >
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-white/40">RESIDENCE</div>
          <div className="mt-1 font-mincho text-3xl text-white">{unit.residenceNo}</div>
          <div className="mt-1 text-xs text-white/50">
            {unit.floor}F ・ {unit.layout}
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${st.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${available ? "animate-pulse" : ""}`} />
          {st.label}
        </span>
      </div>

      {/* floor plan */}
      <button
        type="button"
        disabled={!available}
        onClick={() => available && onSelect(unit)}
        className={`relative mt-5 overflow-hidden rounded-2xl border border-white/5 bg-black/30 p-2 ${
          available ? "cursor-pointer" : "cursor-default"
        }`}
        aria-label={`${unit.residenceNo} の間取りを3Dで内覧`}
      >
        <FloorPlan plan={plan} className="h-44 w-full sm:h-52" />
        {available && (
          <div className="absolute inset-0 flex items-center justify-center bg-obsidian/55 opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full border border-[#cdb088]/60 bg-black/60 px-4 py-2 text-sm text-[#e6d3b3]">
              <Box size={15} /> 3Dで内覧する
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] tracking-[0.25em] text-white/55">
          {plan.name}
        </span>
        {available && (
          <span className="absolute right-3 top-3 rounded-full border border-[#cdb088]/50 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.2em] text-[#e6d3b3]">
            実写3D
          </span>
        )}
      </button>

      {/* specs */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/5 pt-5 text-sm">
        <div>
          <div className="flex items-center gap-1 text-[10px] tracking-[0.2em] text-white/40">
            <Maximize size={11} /> 面積
          </div>
          <div className="mt-1 font-mincho text-white">{unit.areaM2}m²</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] tracking-[0.2em] text-white/40">
            <Compass size={11} /> 向き
          </div>
          <div className="mt-1 font-mincho text-white">{FACING_JP[unit.facing]}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] text-[#cdb088]/70">価格</div>
          <div className="mt-1 font-mincho text-[#e6d3b3]">{formatPrice(unit.priceOku)}</div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/55">{unit.tagline}</p>

      {/* CTA */}
      <button
        type="button"
        disabled={!available}
        onClick={() => available && onSelect(unit)}
        className={`mt-5 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-all ${
          available
            ? "bg-[#e6d3b3] text-black hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_40px_-12px_rgba(230,211,179,0.6)]"
            : "cursor-not-allowed border border-white/10 text-white/35"
        }`}
      >
        {available ? (
          <>
            3Dで内覧する <ArrowUpRight size={16} />
          </>
        ) : (
          STATUS[unit.status].label
        )}
      </button>
    </div>
  );
}
