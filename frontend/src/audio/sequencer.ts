// audio/sequencer.ts —— 程序化音乐机制：把风格包里的 ProceduralTrack（纯数据）按前瞻调度
// 变成 WebAudio 事件。乐器音色在此实现，风格包只写 bpm / 音阶 / 鼓谱 / 旋律 / 低音。
// compileTrack 是纯函数（可单测）：把一段乐谱展开为「节拍 → 事件」列表。
import type { Instrument, ProceduralTrack } from "../style/types";

export interface NoteEvent {
  /** 事件起点（拍） */
  beat: number;
  kind: "drum" | "melody" | "bass";
  /** 鼓：K/S/H/T/t；音符：频率 Hz */
  drum?: string;
  freq?: number;
  /** 时值（拍） */
  dur: number;
}

export function degreeToFreq(root: number, scale: number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root * Math.pow(2, (scale[idx] + 12 * oct) / 12);
}

/** 一个循环的拍数 = 以旋律长度（八分音符）为准 */
export function loopBeats(track: ProceduralTrack): number {
  return track.melody.length / 2;
}

export function compileTrack(track: ProceduralTrack): NoteEvent[] {
  const out: NoteEvent[] = [];
  const beats = loopBeats(track);
  const swing = track.swing ?? 0;
  // 鼓：十六分音符网格，循环铺满
  const drumLen = track.drums.length;
  for (let i = 0; i < beats * 4; i++) {
    const ch = track.drums[i % drumLen];
    if (ch === "." || ch === " ") continue;
    const sw = i % 2 === 1 ? swing * 0.25 : 0;
    out.push({ beat: i / 4 + sw, kind: "drum", drum: ch, dur: 0.25 });
  }
  // 旋律：八分音符
  track.melody.forEach((deg, i) => {
    if (deg <= -100) return;
    const sw = i % 2 === 1 ? swing * 0.5 : 0;
    // 连续同音不连音：时值取到下一个非休止前
    let len = 1;
    while (i + len < track.melody.length && track.melody[i + len] <= -100) len++;
    out.push({ beat: i / 2 + sw, kind: "melody", freq: degreeToFreq(root(track) * 2, track.scale, deg), dur: Math.min(len, 4) / 2 });
  });
  // 低音：每项一拍，循环铺满
  for (let i = 0; i < beats; i++) {
    const deg = track.bass[i % track.bass.length];
    if (deg <= -100) continue;
    out.push({ beat: i, kind: "bass", freq: degreeToFreq(root(track) / 2, track.scale, deg), dur: 0.9 });
  }
  return out.sort((a, b) => a.beat - b.beat);
}
const root = (t: ProceduralTrack) => t.root;

// ---------- 音色 ----------
function envGain(ctx: AudioContext, dest: AudioNode, t: number, a: number, d: number, s: number, r: number, peak: number, hold: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * s), t + a + d + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  g.connect(dest);
  return g;
}

function playNote(ctx: AudioContext, dest: AudioNode, inst: Instrument, freq: number, t: number, dur: number, gain: number): void {
  switch (inst) {
    case "pluck": {
      // 西塔琴感：锯齿 + 快速衰减 + 轻微失谐双振荡
      const g = envGain(ctx, dest, t, 0.005, 0.25, 0.25, 0.3, gain * 0.5, Math.max(0, dur * 0.5 - 0.25));
      for (const det of [0, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(det, t);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(freq * 6, t);
        f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.3);
        o.connect(f).connect(g);
        o.start(t); o.stop(t + dur + 0.6);
      }
      break;
    }
    case "lead": {
      // 唢呐/舍纳伊式：方波 + 颤音 + 带通
      const g = envGain(ctx, dest, t, 0.02, 0.1, 0.7, 0.12, gain * 0.35, Math.max(0, dur - 0.14));
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(freq, t);
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(6, t);
      const lfoG = ctx.createGain();
      lfoG.gain.setValueAtTime(freq * 0.012, t);
      lfo.connect(lfoG).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(freq * 2.2, t);
      f.Q.setValueAtTime(1.6, t);
      o.connect(f).connect(g);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
      break;
    }
    case "square": {
      const g = envGain(ctx, dest, t, 0.005, 0.05, 0.6, 0.08, gain * 0.25, Math.max(0, dur - 0.1));
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.15);
      break;
    }
    case "bell": {
      const g = envGain(ctx, dest, t, 0.003, 0.4, 0.2, 0.5, gain * 0.4, 0);
      for (const [mult, amp] of [[1, 1], [2.76, 0.4], [5.4, 0.2]] as const) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq * mult, t);
        const og = ctx.createGain();
        og.gain.setValueAtTime(amp, t);
        o.connect(og).connect(g);
        o.start(t); o.stop(t + 1.2);
      }
      break;
    }
    case "bass": {
      const g = envGain(ctx, dest, t, 0.005, 0.12, 0.5, 0.1, gain * 0.55, Math.max(0, dur - 0.15));
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.setValueAtTime(freq / 2, t);
      o.connect(g); o2.connect(g);
      o.start(t); o2.start(t);
      o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
      break;
    }
    case "drone": {
      const g = envGain(ctx, dest, t, 0.15, 0.2, 0.8, 0.4, gain * 0.3, Math.max(0, dur - 0.3));
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(det, t);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(freq * 3, t);
        o.connect(f).connect(g);
        o.start(t); o.stop(t + dur + 0.6);
      }
      break;
    }
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playDrum(ctx: AudioContext, dest: AudioNode, ch: string, t: number, gain: number, noise: AudioBuffer): void {
  const g = ctx.createGain();
  g.connect(dest);
  switch (ch) {
    case "K": {   // 底鼓 / 多尔鼓低音
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(gain * 0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); o.start(t); o.stop(t + 0.3);
      break;
    }
    case "S": {   // 军鼓 / 多尔鼓高音皮
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(1800, t);
      f.Q.setValueAtTime(0.8, t);
      g.gain.setValueAtTime(gain * 0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      n.connect(f).connect(g); n.start(t); n.stop(t + 0.2);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      const og = ctx.createGain();
      og.gain.setValueAtTime(gain * 0.4, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og).connect(dest); o.start(t); o.stop(t + 0.12);
      break;
    }
    case "h": case "H": {   // 踩镲 / 响铃
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.setValueAtTime(7000, t);
      const len = ch === "H" ? 0.18 : 0.05;
      g.gain.setValueAtTime(gain * 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      n.connect(f).connect(g); n.start(t); n.stop(t + len + 0.02);
      break;
    }
    case "T": case "t": {   // 塔布拉 "ta"/"ge"
      const o = ctx.createOscillator();
      o.type = "sine";
      const f0 = ch === "T" ? 520 : 180;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (ch === "T" ? 0.85 : 0.5), t + 0.12);
      g.gain.setValueAtTime(gain * 0.55, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (ch === "T" ? 0.14 : 0.3));
      o.connect(g); o.start(t); o.stop(t + 0.35);
      break;
    }
  }
}

/** 前瞻调度器：每 100ms 把未来 300ms 内的事件排进 WebAudio 时间线，循环播放 */
export class Sequencer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private loopIndex = 0;
  private nextLoopStart = 0;
  private events: NoteEvent[];
  private cursor = 0;
  private noise: AudioBuffer;
  private droneNodes: AudioNode[] = [];
  private out: GainNode;
  private ctx: AudioContext;
  private track: ProceduralTrack;

  constructor(ctx: AudioContext, dest: AudioNode, track: ProceduralTrack) {
    this.ctx = ctx;
    this.track = track;
    this.events = compileTrack(track);
    this.noise = noiseBuffer(ctx, 1);
    this.out = ctx.createGain();
    this.out.gain.value = track.gain ?? 0.8;
    this.out.connect(dest);
  }

  get output(): GainNode { return this.out; }

  start(): void {
    const secPerBeat = 60 / this.track.bpm;
    this.nextLoopStart = this.ctx.currentTime + 0.05;
    this.cursor = 0;
    if (this.track.drone) this.startDrone();
    const tick = () => {
      const horizon = this.ctx.currentTime + 0.35;
      for (;;) {
        if (this.cursor >= this.events.length) {
          this.cursor = 0;
          this.loopIndex++;
          this.nextLoopStart += loopBeats(this.track) * secPerBeat;
        }
        const ev = this.events[this.cursor];
        const t = this.nextLoopStart + ev.beat * secPerBeat;
        if (t > horizon) break;
        this.cursor++;
        if (t < this.ctx.currentTime - 0.05) continue;
        const dur = ev.dur * secPerBeat;
        if (ev.kind === "drum") playDrum(this.ctx, this.out, ev.drum!, t, 0.8, this.noise);
        else if (ev.kind === "melody") playNote(this.ctx, this.out, this.track.melodyInstrument, ev.freq!, t, dur, 0.9);
        else playNote(this.ctx, this.out, this.track.bassInstrument, ev.freq!, t, dur, 0.9);
      }
    };
    tick();
    this.timer = setInterval(tick, 100);
  }

  private startDrone(): void {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 1.5);
    g.connect(this.out);
    for (const [mult, det] of [[0.5, -4], [0.5, 4], [0.75, 0]] as const) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(this.track.root * mult, t);
      o.detune.setValueAtTime(det, t);
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(600, t);
      o.connect(f).connect(g);
      o.start(t);
      this.droneNodes.push(o);
    }
    this.droneNodes.push(g);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0.0001, t, 0.15);
    const nodes = this.droneNodes;
    this.droneNodes = [];
    setTimeout(() => {
      nodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* 已停止 */ } n.disconnect(); });
      this.out.disconnect();
    }, 800);
  }
}
