// router.ts —— 极简路径路由（pushState + popstate），无第三方依赖。
// 路由表：/ 首页、/play 游戏、/about 关于、/privacy 隐私、/terms 条款；其余回落首页。
import { useSyncExternalStore } from "react";
import { unlockAudio } from "./audio/context";

export type Route = "landing" | "play" | "about" | "privacy" | "terms";

const ROUTES: Record<string, Route> = {
  "/": "landing",
  "/play": "play",
  "/about": "about",
  "/privacy": "privacy",
  "/terms": "terms",
};

export const PATHS: Record<Route, string> = {
  landing: "/",
  play: "/play",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
};

function current(): Route {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return ROUTES[path] ?? "landing";
}

const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => listeners.forEach(fn => fn()));
}

export function navigate(route: Route): void {
  const path = PATHS[route];
  if (location.pathname !== path) history.pushState(null, "", path);
  // 导航点击是用户手势：顺手解锁音频上下文，后续页面可直接播放背景音乐
  unlockAudio();
  window.scrollTo(0, 0);
  listeners.forEach(fn => fn());
}

export function useRoute(): Route {
  return useSyncExternalStore(
    fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    current,
  );
}
