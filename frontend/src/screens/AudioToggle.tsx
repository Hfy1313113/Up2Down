// AudioToggle.tsx —— 静音开关 + 音乐音量条（偏好存本机），大厅与赛跑 HUD 共用。
import { audioSettings, useAudioSettings } from "../audio/settings";
import { unlockAudio } from "../audio/context";

export function AudioToggle({ compact = false }: { compact?: boolean }) {
  const s = useAudioSettings();
  return (
    <div className={`audio-toggle flex items-center gap-1.5 ${compact ? "" : "justify-center"}`}>
      <button
        type="button"
        aria-label={s.muted ? "取消静音" : "静音"}
        onClick={() => { unlockAudio(); audioSettings.toggleMute(); }}
        className="w-8 h-8 rounded-lg border-2 border-(--ui-ink) bg-(--ui-paper) text-base leading-none shadow-[2px_2px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
      >
        {s.muted ? "🔇" : "🔊"}
      </button>
      {!compact && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(s.bgmVolume * 100)}
          onChange={e => { unlockAudio(); audioSettings.set({ bgmVolume: Number(e.target.value) / 100, muted: false }); }}
          aria-label="音乐音量"
          className="w-20 accent-(--ui-accent)"
        />
      )}
    </div>
  );
}
