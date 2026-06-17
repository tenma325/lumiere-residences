import type { Unit } from "../types";
import UnitCard from "./UnitCard";
import Reveal from "./Reveal";

export default function ResidencesSection({
  units,
  onSelect,
  selectedUnit,
}: {
  units: Unit[];
  onSelect: (u: Unit) => void;
  selectedUnit: Unit | null;
}) {
  const availableCount = units.filter((u) => u.status === "available").length;

  return (
    <section id="residences" className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 md:px-10 md:py-32">
      <Reveal className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-xs tracking-[0.5em] text-[#cdb088]">RESIDENCES FOR SALE</p>
          <h2 className="font-mincho text-4xl leading-tight text-white sm:text-5xl">
            分譲住戸一覧
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/55">
            「空室」の住戸をクリックすると、その間取りに合わせて設えた室内へ。
            建物中央のタワーに吸い込まれるように、3Dの邸宅内部をご覧いただけます。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-white/55">
          <span className="flex h-2 w-2 items-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#cdb088]" />
          </span>
          現在 <span className="font-mincho text-2xl text-[#e6d3b3]">{availableCount}</span> 邸 ご紹介中
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((u, i) => (
          <Reveal key={u.id} delay={(i % 3) * 90}>
            <UnitCard unit={u} onSelect={onSelect} selectedUnit={selectedUnit} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
