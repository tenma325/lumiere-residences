import { useCallback, useState } from "react";
import type { Unit, Theme } from "./types";
import { UNITS } from "./data/residences";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import { ConceptSection, AmenitiesSection, AccessSection, ContactFooter } from "./components/Sections";
import ResidencesSection from "./components/ResidencesSection";
import InteriorViewer from "./components/InteriorViewer";

export default function App() {
  const [selected, setSelected] = useState<Unit | null>(null);
  const [showInterior, setShowInterior] = useState(false);
  const [fade, setFade] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [theme, setTheme] = useState<Theme>("night");
  const toggleTheme = useCallback(() => setTheme((t) => (t === "night" ? "day" : "night")), []);

  const flyTarget = selected && !showInterior ? selected : null;
  const flying = !!flyTarget && !fade;

  const selectUnit = useCallback(
    (u: Unit) => {
      if (u.status !== "available" || selected) return;
      setSelected(u);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [selected],
  );

  const onArrived = useCallback(() => {
    setFade(true);
    window.setTimeout(() => setShowInterior(true), 700);
    window.setTimeout(() => setFade(false), 1450);
  }, []);

  const closeInterior = useCallback(() => {
    setFade(true);
    window.setTimeout(() => {
      setShowInterior(false);
      setSelected(null);
      setResetSignal((s) => s + 1);
    }, 550);
    window.setTimeout(() => setFade(false), 1300);
  }, []);

  return (
    <div className="relative">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <Hero
        units={UNITS}
        flyTarget={flyTarget}
        onSelect={selectUnit}
        onArrived={onArrived}
        resetSignal={resetSignal}
        theme={theme}
      />

      <main className="relative z-10 bg-obsidian">
        <ConceptSection />
        <ResidencesSection units={UNITS} onSelect={selectUnit} selectedUnit={selected} />
        <AmenitiesSection />
        <AccessSection />
        <ContactFooter />
      </main>

      {/* fly-in vignette + label */}
      <div
        className={`pointer-events-none fixed inset-0 z-[80] transition-opacity duration-700 ${
          flying ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.55) 100%)" }}
      >
        {selected && (
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
            <div className="text-[11px] tracking-[0.5em] text-[#cdb088]">APPROACHING</div>
            <div className="mt-2 font-mincho text-3xl text-white">Residence {selected.residenceNo}</div>
          </div>
        )}
      </div>

      {/* cinematic fade bridge */}
      <div className={`fade-bridge ${fade ? "active" : ""}`}>
        {selected && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="font-mincho text-2xl tracking-widest text-[#e6d3b3]">LUMIÈRE</div>
              <div className="mt-3 text-xs tracking-[0.4em] text-white/50">
                Residence {selected.residenceNo}
              </div>
            </div>
          </div>
        )}
      </div>

      {showInterior && selected && (
        <InteriorViewer
          unit={selected}
          theme={theme}
          onClose={closeInterior}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
