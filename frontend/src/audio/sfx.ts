// audio/sfx.ts —— 音效机制：风格包只写「某个事件用哪个合成预设或哪个文件」，
// 预设音色在此实现；未指定的事件用默认预设。所有音效走 SFX 总线。
import { getAudioCtx, getBus } from "./context";
import type { SfxId, SfxSpec, StylePack, SynthPreset } from "../style/types";

type Preset = (ctx: AudioContext, dest: AudioNode, gain: number) => void;

function noise(ctx: AudioContext, seconds: number, decay = 0): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(22050 * seconds), 22050);
  const d = buf.getChannelData(0);
  for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (decay ? Math.exp(-j / decay) : 1 - j / d.length);
  return buf;
}

const presets: Record<SynthPreset, Preset> = {
  whipCrack(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx, 0.06, 180);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    n.connect(g).connect(dest);
    n.start(t0);
  },
  dholHit(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.25);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx, 0.08, 120);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25 * gain, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    n.connect(f).connect(ng).connect(dest);
    n.start(t0);
  },
  tablaTak(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(560, t0);
    o.frequency.exponentialRampToValueAtTime(430, t0 + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.2);
  },
  thud(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(32, t0 + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.16);
  },
  brassFanfare(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = t0 + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22 * gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.9 : 0.22));
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 1);
    });
    for (let i = 0; i < 5; i++) {
      const t = t0 + 0.15 + i * 0.28;
      const n = ctx.createBufferSource();
      n.buffer = noise(ctx, 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25 * gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      n.connect(g).connect(dest);
      n.start(t);
    }
  },
  shehnaiFanfare(ctx, dest, gain) {
    // 舍纳伊（印度唢呐）式号角：方波 + 颤音 + 带通，上行乐句落在主音
    const t0 = ctx.currentTime;
    const notes = [440, 466.2, 554.4, 587.3, 659.3, 698.5, 880, 880];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.14;
      const last = i === notes.length - 1;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(f, t);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6.5;
      const lg = ctx.createGain(); lg.gain.value = f * 0.015;
      lfo.connect(lg).connect(o.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = f * 2.2; bp.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2 * gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + (last ? 1.1 : 0.2));
      o.connect(bp).connect(g).connect(dest);
      o.start(t); lfo.start(t);
      o.stop(t + 1.2); lfo.stop(t + 1.2);
    });
    for (let i = 0; i < 6; i++) presetsDelayed(ctx, dest, "dholHit", t0 + 0.1 + i * 0.26, gain * 0.8);
  },
  boom(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(170, t0);
    o.frequency.exponentialRampToValueAtTime(26, t0 + 0.45);
    g.gain.setValueAtTime(0.4 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.52);
  },
  slideWhistle(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(450, t0);
    o.frequency.linearRampToValueAtTime(820, t0 + 0.12);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.55);
    g.gain.setValueAtTime(0.35 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.62);
  },
  trumpetTrunk(ctx, dest, gain) {
    // 象鸣：锯齿 + 快速上滑 + 颤音
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(620, t0 + 0.18);
    o.frequency.exponentialRampToValueAtTime(380, t0 + 0.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.42 * gain, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    o.connect(f).connect(g).connect(dest);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 0.75); lfo.stop(t0 + 0.75);
  },
  tick(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 0.1);
  },
  goBlast(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    for (const [f, d] of [[660, 0], [880, 0.08], [1320, 0.16]] as const) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.linearRampToValueAtTime(0.2 * gain, t0 + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.45);
      o.connect(g).connect(dest);
      o.start(t0 + d); o.stop(t0 + d + 0.5);
    }
  },
  click(ctx, dest, gain) {
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx, 0.02, 60);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
    n.connect(g).connect(dest);
    n.start(t0);
  },
  hornHonk(ctx, dest, gain) {
    // 汽车双音喇叭：两只方波 + 低通。单按短促一声；连按间隔过近（上一声尚未收尾）则不重触发，
    // 而是把当前这声一直按住——连点越密，鸣笛越长，松手后才收尾。
    const now = ctx.currentTime;
    const level = 0.16 * gain;
    const h = horn;
    if (h && h.ctx === ctx && now < h.until + HORN_LINK_SEC) {
      // 持续鸣笛：取消已排好的收尾，按住当前音量，再往后延一段
      const g = h.gain.gain;
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(level, now); }
      g.setValueAtTime(level, now + 0.001);
      h.until = now + HORN_HOLD_SEC;
      scheduleHornRelease(h);
      return;
    }
    if (h) stopHorn(h);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.015);
    g.connect(dest);
    const oscs: OscillatorNode[] = [];
    for (const f of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(f, now);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1400;
      o.connect(lp).connect(g);
      o.start(now);
      oscs.push(o);
    }
    horn = { ctx, gain: g, oscs, level, until: now + HORN_HOLD_SEC, timer: 0 };
    scheduleHornRelease(horn);
  },
  engineRev(ctx, dest, gain) {
    // 地板油起步：锯齿波转速上扬 + 低通打开，顺带一声轮胎打滑
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(55, t0);
    o.frequency.exponentialRampToValueAtTime(240, t0 + 0.5);
    o.frequency.exponentialRampToValueAtTime(160, t0 + 0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t0);
    lp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.32 * gain, t0 + 0.08);
    g.gain.setValueAtTime(0.32 * gain, t0 + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
    o.connect(lp).connect(g).connect(dest);
    o.start(t0); o.stop(t0 + 1.05);
    presetsDelayed(ctx, dest, "tireScreech", t0 + 0.05, gain * 0.5);
  },
  tireScreech(ctx, dest, gain) {
    // 轮胎尖啸：高 Q 带通噪声，中心频率先扬后落
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx, 0.7);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 9;
    bp.frequency.setValueAtTime(1500, t0);
    bp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.25);
    bp.frequency.exponentialRampToValueAtTime(1100, t0 + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5 * gain, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    n.connect(bp).connect(g).connect(dest);
    n.start(t0);
  },
  squeak(ctx, dest, gain) {
    // 玩具捏响：高音正弦快速上滑再回落，带一点三角波泛音
    const t0 = ctx.currentTime;
    for (const [type, mul, lv] of [["sine", 1, 0.3], ["triangle", 2.01, 0.08]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(900 * mul, t0);
      o.frequency.exponentialRampToValueAtTime(1900 * mul, t0 + 0.06);
      o.frequency.exponentialRampToValueAtTime(1100 * mul, t0 + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(lv * gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      o.connect(g).connect(dest);
      o.start(t0); o.stop(t0 + 0.2);
    }
  },
  giggle(ctx, dest, gain) {
    // 奶声咯咯笑：五段短促的「哈」——锯齿波过共振峰带通，每段音高略降、整体先快后慢
    const t0 = ctx.currentTime;
    const bursts = [0, 0.11, 0.22, 0.35, 0.5];
    bursts.forEach((d, i) => {
      const t = t0 + d;
      const f0 = 420 - i * 22;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f0 * 1.15, t);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2.2;
      const bp2 = ctx.createBiquadFilter();
      bp2.type = "peaking"; bp2.frequency.value = 2600; bp2.Q.value = 3; bp2.gain.value = 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5 * gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(bp).connect(bp2).connect(g).connect(dest);
      o.start(t); o.stop(t + 0.12);
    });
  },
  boing(ctx, dest, gain) {
    // 弹簧「嘣～」：三角波先下探再弹上，带 18Hz 颤动渐止
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t0);
    o.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
    o.frequency.exponentialRampToValueAtTime(260, t0 + 0.4);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(60, t0);
    lg.gain.exponentialRampToValueAtTime(1, t0 + 0.6);
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.35 * gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
    o.connect(g).connect(dest);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 0.7); lfo.stop(t0 + 0.7);
  },
  crash(ctx, dest, gain) {
    // 追尾：低频闷响 + 高频金属碎响
    const t0 = ctx.currentTime;
    presets.thud(ctx, dest, gain * 1.2);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx, 0.3, 2200);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35 * gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    n.connect(hp).connect(g).connect(dest);
    n.start(t0);
  },
};

// ---- 可持续的喇叭：同一时刻只有一只在响 ----
interface HornState { ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[]; level: number; until: number; timer: number }
let horn: HornState | null = null;
/** 单按时按住的时长（之后 80ms 收尾） */
const HORN_HOLD_SEC = 0.16;
/** 上一声收尾后多久内再按视为「间隔过近」→ 续响而不重触发 */
const HORN_LINK_SEC = 0.12;
function scheduleHornRelease(h: HornState): void {
  const g = h.gain.gain;
  g.setValueAtTime(h.level, h.until);
  g.exponentialRampToValueAtTime(0.001, h.until + 0.08);
  clearTimeout(h.timer);
  h.timer = window.setTimeout(() => { if (horn === h) stopHorn(h); }, (h.until + 0.1 - h.ctx.currentTime) * 1000);
}
function stopHorn(h: HornState): void {
  clearTimeout(h.timer);
  for (const o of h.oscs) { try { o.stop(); } catch { /* 已停止 */ } }
  h.gain.disconnect();
  if (horn === h) horn = null;
}

function presetsDelayed(ctx: AudioContext, dest: AudioNode, id: SynthPreset, at: number, gain: number): void {
  const delay = Math.max(0, (at - ctx.currentTime) * 1000);
  setTimeout(() => presets[id](ctx, dest, gain), delay);
}

const DEFAULTS: Record<SfxId, SynthPreset> = {
  whip: "whipCrack",
  trumpet: "trumpetTrunk",
  impact: "thud",
  fanfare: "brassFanfare",
  blast: "boom",
  buckedOff: "slideWhistle",
  countdown: "tick",
  go: "goBlast",
  uiTap: "click",
};

let currentPack: StylePack | null = null;
export function setSfxPack(pack: StylePack): void { currentPack = pack; }

const fileCache = new Map<string, Promise<AudioBuffer | null>>();
/** 预载风格包的音效文件（无文件或失败时静默） */
export function preloadSfxFiles(pack: StylePack): void {
  for (const s of Object.values(pack.sfx)) if (s?.file) void loadFile(s.file);
}
async function loadFile(url: string): Promise<AudioBuffer | null> {
  const hit = fileCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
      const ctx = getAudioCtx();
      return ctx ? await ctx.decodeAudioData(await res.arrayBuffer()) : null;
    } catch { return null; }
  })();
  fileCache.set(url, p);
  return p;
}

export function playSfx(id: SfxId, gainScale = 1): void {
  try {
    const ctx = getAudioCtx();
    const bus = getBus("sfx");
    if (!ctx || !bus) return;
    const spec: SfxSpec | undefined = currentPack?.sfx[id];
    const gain = (spec?.gain ?? 1) * gainScale;
    if (spec?.file) {
      void loadFile(spec.file).then(buf => {
        if (buf) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = gain;
          src.connect(g).connect(bus);
          src.start();
        } else {
          presets[spec.synth ?? DEFAULTS[id]](ctx, bus, gain);
        }
      });
      return;
    }
    presets[spec?.synth ?? DEFAULTS[id]](ctx, bus, gain);
  } catch { /* 音频不可用时静默 */ }
}

/** 直接按预设 id 播放（如象鼻扬起的象鸣，不属于风格包事件表） */
export function playPreset(id: SynthPreset, gain = 1): void {
  try {
    const ctx = getAudioCtx();
    const bus = getBus("sfx");
    if (ctx && bus) presets[id](ctx, bus, gain);
  } catch { /* ignore */ }
}
