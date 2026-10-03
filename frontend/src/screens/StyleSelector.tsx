// StyleSelector.tsx —— 大厅风格选择：可左右滑动的悬浮芯片行 + 实时 3D 预览（展台上原地奔跑的样板象）。
// 房主可切换并同步全员；非房主只能看当前风格。
import { useEffect, useRef } from "react";
import { listPacks, getPack } from "../style/registry";
import { setStyle } from "../state/game";
import { BirthScene } from "../three/birthScene";
import { Recognize } from "../game/recognize";
import { synthParts } from "../game/synth";
import { playSfx } from "../audio/sfx";

const SAMPLE_MODEL = Recognize.analyzeParts(synthParts());

export function StylePreview({ styleId, playerIndex }: { styleId: string; playerIndex: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pack = getPack(styleId);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const scene = new BirthScene(canvas, SAMPLE_MODEL, pack, playerIndex, undefined, { preview: true });
    scene.attachDrag(stageRef.current!);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); scene.dispose(); };
  }, [pack, playerIndex]);
  return (
    <div
      ref={stageRef}
      className="style-preview relative w-full h-[150px] sm:h-[190px] rounded-lg border-2 border-(--ui-ink) shadow-[3px_3px_0_var(--ui-ink)] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ background: pack.birth.backdrop }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-(--ui-ink) bg-(--ui-paper)/80 border border-(--ui-ink) rounded-full px-2 py-0.5 pointer-events-none">
        {pack.name} · {pack.tagline}
      </div>
    </div>
  );
}

export function StyleSelector({ styleId, canEdit, playerIndex }: { styleId: string; canEdit: boolean; playerIndex: number }) {
  const packs = listPacks();
  const stripRef = useRef<HTMLDivElement>(null);

  // 选中项滚到可视中央
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-style="${styleId}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [styleId]);

  return (
    <div className="style-selector w-full flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs sm:text-sm font-bold text-(--ui-ink)">🎨 风格包{canEdit ? "（左右滑动切换，全员同步）" : "（由房主选择）"}</span>
        <span className="text-[10px] text-(--ui-ink) opacity-60">{packs.length} 套</span>
      </div>
      <div ref={stripRef} className="style-strip flex gap-2 overflow-x-auto px-6 py-1 -mx-1">
        {packs.map(p => {
          const active = p.id === styleId;
          return (
            <button
              key={p.id}
              type="button"
              data-style={p.id}
              disabled={!canEdit && !active}
              onClick={() => { if (canEdit) { playSfx("uiTap"); setStyle(p.id); } }}
              className={`style-chip shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs sm:text-sm font-bold transition-all ${
                active
                  ? "bg-(--ui-accent) text-white border-(--ui-ink) shadow-[2px_2px_0_var(--ui-ink)] scale-105"
                  : "bg-(--ui-paper) text-(--ui-ink) border-(--ui-ink) opacity-80"
              } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="flex gap-0.5">
                {p.swatch.slice(0, 5).map((c, i) => <span key={i} className="w-2.5 h-2.5 rounded-sm border border-black/25" style={{ background: c }} />)}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
      <StylePreview styleId={styleId} playerIndex={playerIndex} />
    </div>
  );
}
