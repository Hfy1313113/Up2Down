// style/preload.ts —— 风格资源预载：收到 draw_phase 时就开始拉取该风格的图片贴图与音乐文件，
// 绘制阶段有 150s 窗口，开赛时零等待。全部失败也不阻塞（各自有纯色/程序化回落）。
import type { StylePack, MaterialSpec } from "./types";
import { preloadTrack } from "../audio/music";
import { preloadSfxFiles } from "../audio/sfx";

function collectImageUrls(pack: StylePack): string[] {
  const urls = new Set<string>();
  const visit = (m?: MaterialSpec) => { if (m?.texture?.kind === "image") urls.add(m.texture.url); };
  Object.values(pack.elephant).forEach(visit);
  pack.elephantAccessories?.forEach(a => Object.values(a.materials ?? {}).forEach(visit));
  Object.values(pack.rider.materials).forEach(visit);
  if (pack.rider.face) [pack.rider.face.calm, pack.rider.face.tense, pack.rider.face.furious].forEach(visit);
  const env = pack.environment;
  [env.ground, env.lane, env.fence, env.gate.pole, env.gate.cannon, pack.birth.disc].forEach(visit);
  env.props.forEach(p => Object.values(p.materials ?? {}).forEach(visit));
  return [...urls];
}

const started = new Set<string>();

export function preloadStyle(pack: StylePack): void {
  if (started.has(pack.id)) return;
  started.add(pack.id);
  for (const url of collectImageUrls(pack)) {
    const img = new Image();
    img.src = url;
  }
  for (const t of [pack.music.race, pack.music.menu, pack.music.birth]) {
    if (t) void preloadTrack(t);
  }
  preloadSfxFiles(pack);
}
