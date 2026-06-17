import { useEffect, useRef, useState } from "react";
import { X, Move3d, Maximize2, Minimize2, Sun, Moon, Compass, MapPin } from "lucide-react";
import type { Unit, Theme } from "../types";
import { PLANS, PLAN_VIEWPOINTS, TOTAL_FLOORS } from "../data/residences";
import { FACING_JP, formatPrice } from "../lib/layout";
import FloorPlan from "./FloorPlan";
import PanoramaCanvas from "./PanoramaViewer";

export default function InteriorViewer({
  unit,
  theme,
  onClose,
  onToggleTheme,
}: {
  unit: Unit;
  theme: Theme;
  onClose: () => void;
  onToggleTheme: () => void;
}) {
  const plan = PLANS[unit.planId];
  const viewpoints = PLAN_VIEWPOINTS[unit.planId] ?? [];
  const [vpIndex, setVpIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const vp = viewpoints[vpIndex] ?? viewpoints[0];
  const src = vp ? (theme === "day" ? vp.day : vp.night) : "";

  useEffect(() => {
    document.body.classList.add("viewer-open");
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const tm = setTimeout(() => setHintGone(true), 5200);
    return () => {
      document.body.classList.remove("viewer-open");
      window.removeEventListener("keydown", onKey);
      clearTimeout(tm);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const jumpToRoom = (roomId: string) => {
    const i = viewpoints.findIndex((v) => v.roomId === roomId);
    if (i >= 0) setVpIndex(i);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Residence ${unit.residenceNo} 3D内覧`}
      className="fixed inset-0 z-[100] bg-black"
    >
      {/* photo-sphere — one persistent canvas; the texture swaps in place when
          the viewpoint / theme changes (avoids WebGL-context churn). */}
      <div className="absolute inset-0">
        {src ? <PanoramaCanvas src={src} /> : null}
      </div>

      {/* cinematic vignette + gradient overlays for depth and legibility */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* ---- overlay UI ---- */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6 md:p-8">
        {/* top bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="animate-blur-fade-up">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.4em] text-[#cdb088]">
              <Move3d size={14} /> 実写3Dビュー ・ {vp ? vp.label : ""}
            </div>
            <h2 className="mt-2.5 font-mincho text-2xl text-white sm:text-3xl">
              Residence&nbsp;{unit.residenceNo}
            </h2>
            <p className="mt-1.5 text-sm text-white/55">
              {unit.layout}・{plan.name}・{unit.areaM2}m²
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="liquid-glass pointer-events-auto flex h-11 items-center gap-2 rounded-full px-4 text-sm text-white"
              aria-label={theme === "night" ? "昼に切り替え" : "夜に切り替え"}
            >
              {theme === "night" ? <Sun size={17} className="text-[#e6d3b3]" /> : <Moon size={17} className="text-[#cdb088]" />}
              <span className="hidden sm:inline">{theme === "night" ? "DAY" : "NIGHT"}</span>
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="liquid-glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white"
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* viewpoint chips (jump between rooms) */}
        {viewpoints.length > 1 && (
          <div className="animate-blur-fade-up pointer-events-auto mx-auto flex gap-2.5">
            {viewpoints.map((v, i) => (
              <button
                key={v.room}
                type="button"
                onClick={() => setVpIndex(i)}
                className={`rounded-full px-6 py-2.5 text-sm tracking-wide transition-all duration-300 ${
                  i === vpIndex
                    ? "bg-[#e6d3b3] text-black shadow-[0_4px_24px_-6px_rgba(230,211,179,0.5)]"
                    : "liquid-glass text-white/85 hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* center hint */}
        <div
          className={`mx-auto mb-2 flex items-center gap-3 text-xs text-white/60 transition-opacity duration-1000 ${
            !hintGone ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="liquid-glass rounded-full px-4 py-2 tracking-wide">ドラッグで見回す</span>
          <span className="liquid-glass rounded-full px-4 py-2 tracking-wide">間取りの部屋をクリックで移動</span>
        </div>

        {/* bottom row: specs + interactive floor plan */}
        <div className="flex items-end justify-between gap-4">
          <div className="glass-panel animate-blur-fade-up rounded-2xl px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              {[
                ["間取り", unit.layout],
                ["専有面積", `${unit.areaM2} m²`],
                ["向き", FACING_JP[unit.facing]],
                ["所在階", `${unit.floor}F / ${TOTAL_FLOORS}F`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] tracking-[0.3em] text-white/40">{k}</div>
                  <div className="mt-1.5 font-mincho text-lg text-white">{v}</div>
                </div>
              ))}
              <div>
                <div className="text-[10px] tracking-[0.3em] text-[#cdb088]/70">価格</div>
                <div className="mt-1.5 font-mincho text-xl text-[#e6d3b3]">
                  {formatPrice(unit.priceOku)}
                </div>
              </div>
            </div>
          </div>

          {/* floor plan — expandable, rooms clickable */}
          <div
            className={`glass-panel animate-blur-fade-up pointer-events-auto shrink-0 rounded-2xl p-3 transition-all duration-500 ${
              expanded ? "w-[min(92vw,560px)]" : "w-[230px]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.25em] text-white/45">
              <span className="flex items-center gap-1">
                <MapPin size={11} /> 間取り｜{plan.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[#cdb088]">
                  <Compass size={11} /> {FACING_JP[unit.facing]}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={expanded ? "間取りを縮小" : "間取りを拡大"}
                >
                  {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </span>
            </div>
            <FloorPlan
              plan={plan}
              className={expanded ? "h-[380px] w-full" : "h-[150px] w-full"}
              marker={vp ? { x: vp.x, z: vp.z } : undefined}
              highlightRoom={vp?.roomId}
              clickableRooms={viewpoints.map((v) => v.roomId)}
              onRoomClick={jumpToRoom}
            />
            {expanded && (
              <p className="mt-2 text-center text-[11px] text-white/45">
                破線の部屋をクリックすると、その視点へ移動します
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
