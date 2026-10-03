// style/registry.ts —— 风格包自动发现：src/style/packs/*/index.ts 的默认导出即一套风格。
// 新增风格 = 新建目录，不改任何现有文件；注册时做结构校验，坏包在开发态直接抛错。
import type { StylePack } from "./types";
import { validatePack } from "./validate";

const modules = import.meta.glob<{ default: StylePack }>("./packs/*/index.ts", { eager: true });

const packs = new Map<string, StylePack>();
for (const [path, mod] of Object.entries(modules)) {
  const pack = mod.default;
  const errs = validatePack(pack);
  if (errs.length) {
    const msg = `风格包 ${path} 不合法：\n- ${errs.join("\n- ")}`;
    if (import.meta.env.DEV) throw new Error(msg);
    console.error(msg);
    continue;
  }
  if (packs.has(pack.id)) throw new Error(`风格包 id 重复：${pack.id}`);
  packs.set(pack.id, pack);
}

/** 默认风格：优先宝莱坞，否则取注册表第一项 */
export const DEFAULT_STYLE_ID = packs.has("bollywood") ? "bollywood" : (packs.keys().next().value as string);

export function listPacks(): StylePack[] {
  // 默认风格排最前，其余按 id 排序，保证选择器顺序稳定
  return [...packs.values()].sort((a, b) =>
    a.id === DEFAULT_STYLE_ID ? -1 : b.id === DEFAULT_STYLE_ID ? 1 : a.id.localeCompare(b.id));
}

export function getPack(id: string | null | undefined): StylePack {
  return (id && packs.get(id)) || packs.get(DEFAULT_STYLE_ID)!;
}

export function hasPack(id: string): boolean {
  return packs.has(id);
}
