// Shell.tsx —— 非游戏页面的统一骨架：顶部标题栏（导航）+ 内容 + 页脚（署名与许可证）。
import type { ReactNode } from "react";
import { navigate, useRoute, type Route } from "../router";

const NAV: { route: Route; label: string }[] = [
  { route: "landing", label: "首页" },
  { route: "play", label: "开玩" },
  { route: "about", label: "关于" },
  { route: "privacy", label: "隐私" },
  { route: "terms", label: "条款" },
];

export const GITHUB_REPO = "https://github.com/Hfy1313113/Up2Down";
export const AUTHORS = [
  { role: "作品一作", name: "Hfy1313113", url: "https://github.com/Hfy1313113" },
  { role: "共创", name: "PlutoKeating", url: "https://github.com/PlutoKeating" },
];

export function NavLink({ route, children, className = "" }: { route: Route; children: ReactNode; className?: string }) {
  const cur = useRoute();
  const active = cur === route;
  return (
    <a
      href={route === "landing" ? "/" : `/${route}`}
      onClick={e => { e.preventDefault(); navigate(route); }}
      className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-bold transition-colors ${
        active ? "bg-(--ui-accent) text-white" : "text-(--ui-ink) hover:bg-(--ui-accent)/15"
      } ${className}`}
    >
      {children}
    </a>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center">
      <header className="w-full max-w-5xl mx-auto px-3 sm:px-4 pt-2 sm:pt-4">
        <div className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[4px_4px_0_var(--ui-ink)] px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
          <a
            href="/"
            onClick={e => { e.preventDefault(); navigate("landing"); }}
            className="flex items-baseline gap-2 no-underline"
          >
            <span className="text-xl sm:text-2xl font-black text-(--ui-accent) tracking-tight">抽象</span>
            <span className="text-xs sm:text-sm font-extrabold text-(--ui-ink) opacity-80">· Up2Down</span>
          </a>
          <nav className="flex flex-wrap items-center gap-0.5 sm:gap-1">
            {NAV.map(n => <NavLink key={n.route} route={n.route}>{n.label}</NavLink>)}
          </nav>
        </div>
      </header>

      <main className={`w-full ${wide ? "max-w-5xl" : "max-w-3xl"} mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1`}>
        {children}
      </main>

      <footer className="w-full max-w-5xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6">
        <div className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[4px_4px_0_var(--ui-ink)] px-3 sm:px-5 py-3 text-[11px] sm:text-xs text-(--ui-ink) flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-center sm:text-left">
            © 2026 Up2Down Authors & Contributors · 以{" "}
            <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="font-bold underline text-(--ui-accent)">AGPL-3.0</a>
            {" "}开源 · 非盈利派对游戏
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {AUTHORS.map(a => (
              <span key={a.name}>
                {a.role}：<a href={a.url} target="_blank" rel="noreferrer" className="font-bold underline text-(--ui-accent)">{a.name}</a>
              </span>
            ))}
            <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="font-bold underline text-(--ui-accent)">GitHub 仓库</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** 法务/介绍页通用卡片 */
export function PageCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <article className="prose-page bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[5px_5px_0_var(--ui-ink)] p-4 sm:p-7 text-left">
      <h1 className="text-2xl sm:text-3xl font-black text-(--ui-accent) tracking-tight m-0">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm opacity-70 mt-1 mb-2">{subtitle}</p>}
      {children}
    </article>
  );
}
