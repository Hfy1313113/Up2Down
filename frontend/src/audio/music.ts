// audio/music.ts —— 背景音乐播放机制（与内容解耦）：
// TrackSpec 可指向音频文件或程序化乐谱；文件缺失/解码失败（含 SPA 回落返回的 HTML）自动改用程序化乐谱。
// 同一时刻只有一条曲目在 BGM 总线上；切换带淡入淡出；duck() 用于出局/观战时压低音量。
import { getAudioCtx, getBus } from "./context";
import { Sequencer } from "./sequencer";
import type { TrackSpec } from "../style/types";

const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const hit = bufferCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("text/html")) return null;   // 单页应用回落页，不是音频
      const ctx = getAudioCtx();
      if (!ctx) return null;
      const data = await res.arrayBuffer();
      return await ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  })();
  bufferCache.set(url, p);
  return p;
}

/** 预载文件曲目（无文件或失败时静默） */
export async function preloadTrack(track: TrackSpec): Promise<void> {
  if (track.file) await loadBuffer(track.file);
}

interface Playing {
  key: string;
  gain: GainNode;
  volume: number;
  stop(): void;
}

class MusicPlayer {
  private current: Playing | null = null;
  private seq = 0;
  private duckLevel = 1;

  /** 播放曲目；key 相同则不重启（例如阶段切换但曲目相同） */
  async play(track: TrackSpec, key: string): Promise<void> {
    if (this.current?.key === key) return;
    const mySeq = ++this.seq;
    const ctx = getAudioCtx();
    const bus = getBus("bgm");
    if (!ctx || !bus) return;

    const buffer = track.file ? await loadBuffer(track.file) : null;
    if (mySeq !== this.seq) return;   // 加载期间已被更换
    this.stop(0.5);

    const gain = ctx.createGain();
    const volume = track.volume ?? 0.8;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * this.duckLevel, ctx.currentTime + 0.8);
    gain.connect(bus);

    let stop: () => void;
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start();
      stop = () => { try { src.stop(); } catch { /* 已停止 */ } src.disconnect(); };
    } else if (track.procedural) {
      const seq = new Sequencer(ctx, gain, track.procedural);
      seq.start();
      stop = () => seq.stop();
    } else {
      gain.disconnect();
      return;
    }
    this.current = { key, gain, volume, stop };
  }

  stop(fadeSec = 0.6): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    const ctx = getAudioCtx();
    if (!ctx) { cur.stop(); return; }
    cur.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeSec / 3);
    setTimeout(() => { cur.stop(); cur.gain.disconnect(); }, fadeSec * 1000 + 100);
  }

  /** 压低到 level（0~1）；1 恢复 */
  duck(level: number, sec = 0.4): void {
    this.duckLevel = level;
    const cur = this.current;
    const ctx = getAudioCtx();
    if (!cur || !ctx) return;
    cur.gain.gain.setTargetAtTime(cur.volume * level, ctx.currentTime, sec / 3);
  }

  get playingKey(): string | null { return this.current?.key ?? null; }
}

export const music = new MusicPlayer();
