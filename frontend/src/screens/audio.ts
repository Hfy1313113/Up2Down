// audio.ts —— 全局唯一的 AudioContext。
// 浏览器对同时存在的 AudioContext 数量有上限（Chrome 约 6 个），赛跑阶段每秒数次抽鞭
// 若每次都 new 一个会很快创建失败并泄漏，因此所有合成音效共用这一个实例。
let ctx: AudioContext | null = null;

export function getAudioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx || ctx.state === "closed") ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}
