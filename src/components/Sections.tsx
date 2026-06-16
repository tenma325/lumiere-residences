import {
  Waves,
  Dumbbell,
  Wine,
  ConciergeBell,
  Trees,
  Car,
  MapPin,
  Train,
  Phone,
  Mail,
} from "lucide-react";
import Reveal from "./Reveal";

export function ConceptSection() {
  return (
    <section id="concept" className="relative overflow-hidden border-t border-white/5 py-28 md:py-36">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="mb-6 text-xs tracking-[0.5em] text-[#cdb088]">CONCEPT</p>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="font-mincho text-3xl leading-[1.5] text-white sm:text-4xl md:text-5xl md:leading-[1.5]">
            都心の喧騒を離れ、<br />
            空と一体になる暮らし。
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-8 max-w-2xl text-sm leading-loose text-white/55 sm:text-base">
            麻布の高台に佇む、地上34階のプライベートタワーレジデンス。
            すべての邸宅は南面に大きく開かれ、東京の空と夜景を独占します。
            選び抜かれた素材と職人の手仕事が、時を超えて愛される住空間を編み上げました。
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-8">
            {[
              ["2026", "竣工予定"],
              ["免震", "構造"],
              ["24h", "コンシェルジュ"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-mincho text-3xl text-[#e6d3b3] md:text-4xl">{n}</div>
                <div className="mt-2 text-[11px] tracking-[0.3em] text-white/45">{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const AMENITIES = [
  [Waves, "スカイインフィニティプール", "34階・天空のプールから望む大パノラマ。"],
  [Dumbbell, "プライベートフィットネス", "最新マシンを備えた会員専用ジム。"],
  [Wine, "ゲストラウンジ & バー", "上質な時間を分かち合う社交の場。"],
  [ConciergeBell, "24時間コンシェルジュ", "暮らしのあらゆる要望に応えるサービス。"],
  [Trees, "ランドスケープガーデン", "四季を映す、緑豊かな専用庭園。"],
  [Car, "ヴァレーパーキング", "来客にも安心のホテルライク駐車サービス。"],
] as const;

export function AmenitiesSection() {
  return (
    <section id="amenities" className="relative border-t border-white/5 py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <Reveal className="mb-14">
          <p className="mb-3 text-xs tracking-[0.5em] text-[#cdb088]">AMENITIES</p>
          <h2 className="font-mincho text-4xl text-white sm:text-5xl">共用施設</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITIES.map(([Icon, title, desc], i) => (
            <Reveal key={title} delay={(i % 3) * 80} className="bg-obsidian">
              <div className="group h-full p-8 transition-colors duration-500 hover:bg-white/[0.03]">
                <Icon size={26} className="text-[#cdb088] transition-transform duration-500 group-hover:scale-110" strokeWidth={1.4} />
                <h3 className="mt-5 font-mincho text-xl text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AccessSection() {
  return (
    <section id="access" className="relative border-t border-white/5 py-28 md:py-36">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mb-12 text-center">
          <p className="mb-3 text-xs tracking-[0.5em] text-[#cdb088]">ACCESS</p>
          <h2 className="font-mincho text-4xl text-white sm:text-5xl">アクセス</h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass-panel rounded-3xl p-8 sm:p-10">
            <div className="flex items-center gap-3 text-white">
              <MapPin size={20} className="text-[#cdb088]" />
              <span className="font-mincho text-lg">東京都港区麻布 X-X-X</span>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                ["東京メトロ日比谷線「広尾」駅", "徒歩6分"],
                ["東京メトロ南北線「麻布十番」駅", "徒歩9分"],
                ["都営大江戸線「六本木」駅", "徒歩11分"],
                ["羽田空港", "車で約30分"],
              ].map(([line, time]) => (
                <div key={line} className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="flex items-center gap-2 text-sm text-white/70">
                    <Train size={15} className="text-white/40" /> {line}
                  </span>
                  <span className="font-mincho text-[#e6d3b3]">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ContactFooter() {
  return (
    <footer id="contact" className="relative border-t border-white/5">
      <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 md:py-32">
        <Reveal>
          <p className="mb-4 text-xs tracking-[0.5em] text-[#cdb088]">CONTACT</p>
          <h2 className="font-mincho text-4xl leading-tight text-white sm:text-5xl">
            邸宅の全貌を、<br className="sm:hidden" />資料でご覧ください。
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/55">
            最新の販売状況・価格表・詳細な間取り図をご用意しております。
            お気軽にお問い合わせください。
          </p>
        </Reveal>
        <Reveal delay={150}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#"
              className="flex items-center gap-2 rounded-full bg-[#e6d3b3] px-8 py-3.5 text-sm font-medium text-black transition-colors hover:bg-white"
            >
              <Mail size={16} /> 資料請求（無料）
            </a>
            <a
              href="#"
              className="liquid-glass flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium text-white"
            >
              <Phone size={16} /> 0120-XXX-XXX
            </a>
          </div>
        </Reveal>
      </div>

      <div className="border-t border-white/5 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-white/35 sm:flex-row">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-base font-light tracking-[0.42em] text-white/70">
              LUMI<span className="text-[#e6d3b3]">È</span>RE
            </span>
            <span className="mt-1 tracking-[0.4em]">THE RESIDENCE 麻布</span>
          </div>
          <p>© 2026 LUMIÈRE RESIDENCE. この画面はイメージです。</p>
        </div>
      </div>
    </footer>
  );
}
