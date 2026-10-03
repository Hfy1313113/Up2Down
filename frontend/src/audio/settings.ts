// audio/settings.ts —— 玩家本机音频偏好（静音 / 音乐音量 / 音效音量），localStorage 持久化。
import { useSyncExternalStore } from "react";

export interface AudioSettings {
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

const KEY = "up2down.audio";
const DEFAULTS: AudioSettings = { muted: false, bgmVolume: 0.35, sfxVolume: 0.8 };

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: !!v.muted,
      bgmVolume: clamp(v.bgmVolume ?? DEFAULTS.bgmVolume),
      sfxVolume: clamp(v.sfxVolume ?? DEFAULTS.sfxVolume),
    };
  } catch { return DEFAULTS; }
}
const clamp = (x: number) => Math.max(0, Math.min(1, Number(x) || 0));

let state = load();
const listeners = new Set<() => void>();

export const audioSettings = {
  get: () => state,
  set(patch: Partial<AudioSettings>) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    listeners.forEach(fn => fn());
  },
  toggleMute() { audioSettings.set({ muted: !state.muted }); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(audioSettings.subscribe, audioSettings.get);
}
