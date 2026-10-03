// style/validate.ts —— 风格包结构校验（纯函数，可单测）：
// 新风格包有缺槽、错 id、颜色数不对时在注册阶段直接报错，而不是等到赛跑时黑屏。
import {
  ELEPHANT_SLOTS, RIDER_SLOTS, RIDER_ACCESSORIES, PROP_KINDS, SFX_IDS, SYNTH_PRESETS,
  type StylePack, type MaterialSpec,
} from "./types";

export function validatePack(pack: unknown): string[] {
  const errs: string[] = [];
  const p = pack as Partial<StylePack>;
  if (!p || typeof p !== "object") return ["风格包不是对象"];
  if (!p.id || !/^[a-z][a-z0-9-]*$/.test(p.id)) errs.push("id 必须是小写字母开头的 kebab-case");
  if (!p.name) errs.push("缺少 name");
  if (!Array.isArray(p.swatch) || p.swatch.length < 3) errs.push("swatch 至少 3 色");
  if (!Array.isArray(p.playerColors) || p.playerColors.length !== 4) errs.push("playerColors 必须正好 4 色");

  const checkMat = (m: MaterialSpec | undefined, where: string) => {
    if (!m) { errs.push(`${where} 缺少材质`); return; }
    if (m.color == null && !m.texture) errs.push(`${where} 既无 color 也无 texture`);
    if (m.texture?.kind === "image" && !m.texture.url) errs.push(`${where} 图片纹理缺少 url`);
  };
  for (const s of ELEPHANT_SLOTS) checkMat(p.elephant?.[s], `elephant.${s}`);
  for (const s of RIDER_SLOTS) checkMat(p.rider?.materials?.[s], `rider.${s}`);
  for (const a of p.rider?.accessories ?? []) {
    if (!(RIDER_ACCESSORIES as readonly string[]).includes(a)) errs.push(`未知驭象师附件 ${a}`);
  }
  const env = p.environment;
  if (!env) errs.push("缺少 environment");
  else {
    checkMat(env.ground, "environment.ground");
    checkMat(env.lane, "environment.lane");
    checkMat(env.fence, "environment.fence");
    checkMat(env.gate?.pole, "environment.gate.pole");
    checkMat(env.gate?.cannon, "environment.gate.cannon");
    if (!env.gate?.bannerColors || env.gate.bannerColors.length !== 2) errs.push("gate.bannerColors 需要 2 色");
    if (!env.confettiColors?.length) errs.push("confettiColors 为空");
    if (!env.lights || !env.fog || env.sky == null) errs.push("environment 缺少 lights/fog/sky");
    for (const pr of env.props ?? []) {
      if (!(PROP_KINDS as readonly string[]).includes(pr.kind)) errs.push(`未知装饰物 ${pr.kind}`);
      if (!(pr.count > 0)) errs.push(`装饰物 ${pr.kind} 的 count 必须 > 0`);
    }
  }
  if (!p.birth) errs.push("缺少 birth");
  else { checkMat(p.birth.disc, "birth.disc"); if (!p.birth.backdrop) errs.push("birth.backdrop 为空"); }
  const ui = p.ui;
  if (!ui) errs.push("缺少 ui");
  else {
    for (const k of ["accent", "accentHover", "ink", "paper", "bg", "bgPattern", "go", "goHover", "canvasPaper", "canvasGrid"] as const) {
      if (!ui[k]) errs.push(`ui.${k} 为空`);
    }
  }
  if (!p.music?.race) errs.push("music.race 必填");
  else {
    for (const [k, t] of Object.entries(p.music)) {
      if (!t) continue;
      if (!t.file && !t.procedural) errs.push(`music.${k} 既无 file 也无 procedural`);
      const pt = t.procedural;
      if (pt) {
        if (!(pt.bpm > 0)) errs.push(`music.${k}.procedural.bpm 无效`);
        if (!pt.scale?.length) errs.push(`music.${k}.procedural.scale 为空`);
        if (!pt.drums || pt.drums.length % 16 !== 0) errs.push(`music.${k}.procedural.drums 长度必须是 16 的倍数`);
        if (!pt.melody?.length || !pt.bass?.length) errs.push(`music.${k}.procedural 旋律/低音为空`);
      }
    }
  }
  for (const [id, s] of Object.entries(p.sfx ?? {})) {
    if (!(SFX_IDS as readonly string[]).includes(id)) errs.push(`未知音效 id ${id}`);
    if (s && !s.file && !s.synth) errs.push(`sfx.${id} 既无 file 也无 synth`);
    if (s?.synth && !(SYNTH_PRESETS as readonly string[]).includes(s.synth)) errs.push(`sfx.${id} 未知合成预设 ${s.synth}`);
  }
  return errs;
}
