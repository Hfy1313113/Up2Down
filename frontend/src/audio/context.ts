// audio/context.ts —— 全局唯一 AudioContext 与两条总线（BGM / SFX）。
// 浏览器对并发 AudioContext 数量有上限（Chrome 约 6 个），赛跑阶段每秒数次抽鞭
// 若每次都 new 一个会很快创建失败并泄漏，因此所有音乐与音效共用这一个实例。
import { audioSettings } from "./settings";

let ctx: AudioContext | null = null;
let bgmBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let masterBus: GainNode | null = null;

export function getAudioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx || ctx.state === "closed") {
      ctx = new Ctx();
      masterBus = ctx.createGain();
      bgmBus = ctx.createGain();
      sfxBus = ctx.createGain();
      bgmBus.connect(masterBus);
      sfxBus.connect(masterBus);
      masterBus.connect(ctx.destination);
      applyVolumes();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function getBus(kind: "bgm" | "sfx"): GainNode | null {
  if (!getAudioCtx()) return null;
  return kind === "bgm" ? bgmBus : sfxBus;
}

function applyVolumes(): void {
  if (!ctx || !masterBus || !bgmBus || !sfxBus) return;
  const s = audioSettings.get();
  const t = ctx.currentTime;
  masterBus.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.03);
  bgmBus.gain.setTargetAtTime(s.bgmVolume, t, 0.03);
  sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.03);
}
audioSettings.subscribe(applyVolumes);

/** 在任意用户手势里调用：创建/恢复上下文，满足浏览器自动播放策略 */
export function unlockAudio(): void {
  getAudioCtx();
}

// 兜底：若上下文在无手势时创建而处于 suspended，首个指针/键盘事件自动恢复
if (typeof window !== "undefined") {
  const resume = () => { if (ctx && ctx.state === "suspended") void ctx.resume(); };
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume);
}
