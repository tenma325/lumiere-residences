import { ChevronDown } from "lucide-react";
import type { Unit, Theme } from "../types";
import TowerScene from "./TowerScene";

export default function Hero({
  units,
  flyTarget,
  onSelect,
  onArrived,
  resetSignal,
  theme,
}: {
  units: Unit[];
  flyTarget: Unit | null;
  onSelect: (u: Unit) => void;
  onArrived: () => void;
  resetSignal: number;
  theme: Theme;
}) {
  return (
    <section id="top" className="relative h-dvh w-full overflow-hidden">
      {/* 3D tower — dead centre of the page */}
      <div className="absolute inset-0 z-0">
        <TowerScene
          units={units}
          flyTarget={flyTarget}
          onSelect={onSelect}
          onArrived={onArrived}
          resetSignal={resetSignal}
          theme={theme}
        />
      </div>

      {/* legibility scrims (lighter in day so the sky reads) */}
      <div
        className={`pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b to-obsidian ${
          theme === "day" ? "from-transparent via-transparent" : "from-obsidian/70 via-transparent"
        }`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-obsidian to-transparent" />

      {/* now-selling badge */}
      <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2 md:top-28">
        <div
          className="liquid-glass animate-blur-fade-up flex items-center gap-3 rounded-full px-5 py-2 text-xs tracking-[0.3em] text-[#e6d3b3]"
          style={{ animationDelay: "500ms" }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#cdb088]" />
          分譲中 ｜ NOW SELLING
        </div>
      </div>

      {/* bottom content */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-10 sm:px-6 md:px-12 md:pb-14">
        <div className="flex flex-col items-end justify-between gap-8 md:flex-row md:items-end">
          <div className="w-full max-w-2xl">
            <p
              className="animate-blur-fade-up mb-3 text-xs tracking-[0.5em] text-white/55"
              style={{ animationDelay: "550ms" }}
            >
              AZABU · TOKYO
            </p>
            <h1
              className="animate-blur-fade-up font-mincho text-5xl leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl"
              style={{ animationDelay: "650ms" }}
            >
              空に、住まう。
            </h1>
            <p
              className="animate-blur-fade-up mt-5 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base"
              style={{ animationDelay: "780ms" }}
            >
              地上34階、選ばれし邸宅。タワーに浮かぶ空室をクリックすれば、
              平面図と寸分違わぬ室内を、3Dで歩くように体感できます。
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
              <a
                href="#residences"
                className="animate-blur-fade-up flex items-center gap-2 rounded-full bg-[#e6d3b3] px-7 py-3 text-sm font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_40px_-12px_rgba(230,211,179,0.6)]"
                style={{ animationDelay: "900ms" }}
              >
                分譲住戸を見る
                <ChevronDown size={16} />
              </a>
              <a
                href="#concept"
                className="liquid-glass animate-blur-fade-up rounded-full px-7 py-3 text-sm font-medium text-white"
                style={{ animationDelay: "1000ms" }}
              >
                コンセプト
              </a>
            </div>
          </div>

          {/* stats */}
          <div
            className="animate-blur-fade-up flex gap-7 text-right md:flex-col md:gap-5"
            style={{ animationDelay: "1050ms" }}
          >
            {[
              ["34", "STORIES"],
              ["113", "RESIDENCES"],
              ["52–108", "m² TYPE"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-mincho text-2xl text-[#e6d3b3] md:text-3xl">{n}</div>
                <div className="text-[10px] tracking-[0.3em] text-white/40">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* scroll cue */}
        <div className="mt-8 flex justify-center">
          <div className="animate-float flex flex-col items-center gap-1 text-white/40">
            <span className="text-[10px] tracking-[0.4em]">SCROLL</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>
    </section>
  );
}
