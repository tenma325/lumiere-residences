import { useEffect, useState } from "react";
import { Menu, X, FileText, Sun, Moon } from "lucide-react";
import type { Theme } from "../types";

const LINKS = [
  ["コンセプト", "#concept"],
  ["邸宅一覧", "#residences"],
  ["共用施設", "#amenities"],
  ["アクセス", "#access"],
];

export default function Navbar({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDay = theme === "day";
  const themeLabel = isDay ? "夜に切り替え" : "昼に切り替え";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-obsidian/70 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-10 md:py-5">
        <a
          href="#top"
          className="animate-blur-fade-up flex flex-col leading-none"
          style={{ animationDelay: "0ms" }}
          aria-label="LUMIÈRE — home"
        >
          <span className="text-lg font-light tracking-[0.42em] md:text-xl">
            LUMI<span className="font-semibold text-[#e6d3b3]">È</span>RE
          </span>
          <span className="mt-1 text-[9px] tracking-[0.5em] text-white/45">
            THE RESIDENCE 麻布
          </span>
        </a>

        <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary">
          {LINKS.map(([label, href], i) => (
            <a
              key={href}
              href={href}
              className="animate-blur-fade-up text-sm text-white/80 transition-colors hover:text-[#e6d3b3]"
              style={{ animationDelay: `${120 + i * 50}ms` }}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="liquid-glass animate-blur-fade-up flex h-10 items-center gap-2 rounded-full px-4 text-sm text-white"
            style={{ animationDelay: "320ms" }}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === "night" ? <Sun size={16} className="text-[#e6d3b3]" /> : <Moon size={16} className="text-[#cdb088]" />}
            <span className="hidden sm:inline">{theme === "night" ? "DAY" : "NIGHT"}</span>
          </button>
          <a
            href="#contact"
            className="liquid-glass animate-blur-fade-up hidden items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white sm:flex"
            style={{ animationDelay: "360ms" }}
          >
            <FileText size={16} />
            資料請求
          </a>
          <button
            type="button"
            className="liquid-glass animate-blur-fade-up relative flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
            style={{ animationDelay: "360ms" }}
            aria-label={open ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Menu
              size={18}
              className={`absolute transition-all duration-500 ${open ? "rotate-180 scale-50 opacity-0" : "opacity-100"}`}
            />
            <X
              size={18}
              className={`absolute transition-all duration-500 ${open ? "opacity-100" : "-rotate-180 scale-50 opacity-0"}`}
            />
          </button>
        </div>
      </div>

      {/* mobile menu */}
      <div
        className={`overflow-hidden border-white/5 bg-obsidian/95 backdrop-blur-xl transition-all duration-500 lg:hidden ${
          open ? "max-h-96 border-b opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-3 sm:px-6">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm text-white/85 transition-colors hover:bg-white/5"
            >
              {label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-lg px-3 py-3 text-sm text-[#e6d3b3]"
          >
            資料請求 →
          </a>
        </nav>
      </div>
    </header>
  );
}
