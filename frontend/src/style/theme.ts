// style/theme.ts —— 2D 界面主题：把风格包的 ui 配色写入 :root 的 CSS 变量。
// 所有屏幕的 Tailwind 工具类只引用这些变量（如 bg-(--ui-accent)），风格切换即时生效。
import type { StylePack, UiTheme } from "./types";

const VARS: Record<keyof UiTheme, string> = {
  accent: "--ui-accent",
  accentHover: "--ui-accent-hover",
  ink: "--ui-ink",
  paper: "--ui-paper",
  bg: "--ui-bg",
  bgPattern: "--ui-bg-pattern",
  go: "--ui-go",
  goHover: "--ui-go-hover",
  canvasPaper: "--ui-canvas-paper",
  canvasGrid: "--ui-canvas-grid",
};

let applied: string | null = null;

export function applyUiTheme(pack: StylePack): void {
  if (applied === pack.id) return;
  applied = pack.id;
  const root = document.documentElement;
  for (const k of Object.keys(VARS) as (keyof UiTheme)[]) {
    root.style.setProperty(VARS[k], pack.ui[k]);
  }
  root.dataset.style = pack.id;
}

const STORAGE_KEY = "up2down.style";

export function loadPreferredStyle(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
export function savePreferredStyle(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* 隐私模式等不可用时忽略 */ }
}
