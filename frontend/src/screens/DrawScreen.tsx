// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并进入具象化仪式。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, prepareBirth } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, useDrawCanvas, type Part, PART_LABEL } from "./useDrawCanvas";
import { playSfx } from "../audio/sfx";

const PART_LABELS: Record<Part, string> = {
  legs: "1. 象腿连杆",
  head: "2. 象头鼻耳",
  butt: "3. 象臀尾线",
};

const PART_HINT: Record<Part, string> = {
  legs: "在下方绿框画 4 条带膝弯的粗象腿：沿浅虚线描边，或放飞自我更抽象",
  head: "在右上方蓝框画脖子、象头、大扇耳与下垂象鼻：描虚线稳妥，乱画更抽象",
  butt: "在左侧橙框画出臀部轮廓与细尾巴：臀线贴躯干后端，尾巴沿虚线甩出",
};

export function DrawScreen() {
  const g = useGame();
  const d = useDrawCanvas();
  const [preview, setPreview] = useState(false);
  const finishedRef = useRef<Part[]>([]);
  const [finished, setFinished] = useState<Part[]>([]);

  // 状态层 partLeft 归零时推进部位
  useEffect(() => {
    if (g.phase !== "draw") return;
    if (g.partLeft <= 0) doFinishPart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.partLeft, g.phase]);

  const doFinishPart = () => {
    const cur = d.part;
    const next = d.finishPart();          // 画布归档 + 切换
    finishPartState();                     // 状态层同步 currentPart/计时
    if (!finishedRef.current.includes(cur)) {
      finishedRef.current = [...finishedRef.current, cur];
      setFinished(finishedRef.current);
    }
    if (!next) doSubmit();
  };

  const doSubmit = () => {
    const strokes = d.collectAll();
    const model = Recognize.analyzeParts(strokes);
    prepareBirth(strokes, model);   // 先本端具象化仪式，结束后发 done
  };

  const onPreview = (v: boolean) => { setPreview(v); d.setPreview(v); };
  const btn = "px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold text-white border-2 border-(--ui-ink) rounded-lg shadow-[2px_2px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 transition-all";

  return (
    <div className="w-full max-w-5xl mx-auto bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[5px_5px_0_var(--ui-ink)] p-2.5 sm:p-5 md:p-7 text-center my-auto flex flex-col gap-2 sm:gap-2.5 transition-all">
      {/* 顶部栏：部位标签与倒计时保持在单行自适应 */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="grid grid-cols-3 gap-1 sm:gap-2 flex-1">
          {PARTS.map(p => {
            const isActive = p === d.part;
            const isDone = finished.includes(p);
            let stateCls = "";
            if (isActive) {
              stateCls = "active bg-(--ui-accent) text-white border-(--ui-ink)";
            } else if (isDone) {
              stateCls = "finished bg-(--ui-go)/20 text-(--ui-ink) border-(--ui-go) shadow-[2px_2px_0_var(--ui-go)]";
            } else {
              stateCls = "bg-white/70 text-(--ui-ink) border-(--ui-ink)";
            }
            return (
              <button
                key={p}
                className={`part-tab py-1 px-1 sm:px-3 sm:py-2 rounded-lg border-2 text-xs sm:text-sm font-bold shadow-[2px_2px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center truncate ${stateCls}`}
                onClick={() => d.setPartTab(p)}
              >
                <span className="sm:hidden">{PART_LABEL[p]}{isDone ? " ✓" : ""}</span>
                <span className="hidden sm:inline">{PART_LABELS[p]}{isDone ? " ✓" : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="text-base sm:text-2xl font-black font-mono px-2.5 py-1 bg-white/70 border border-(--ui-ink)/40 rounded-lg shadow-inner shrink-0 min-w-[50px] text-center">
          <span className={g.partLeft <= 10 ? "text-red-600 animate-pulse" : "text-(--ui-ink)"}>{g.partLeft}</span>s
        </div>
      </div>

      {/* 紧凑型指引提示条 */}
      <div className="w-full px-2.5 py-1.5 sm:py-2 bg-(--ui-go)/10 border-2 border-(--ui-go) rounded-lg shadow-[2px_2px_0_var(--ui-go)] flex items-center justify-between gap-2 text-left text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 text-(--ui-ink) leading-snug">
          <span className="bg-(--ui-go) text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded shrink-0">
            免画躯干
          </span>
          <span className="truncate sm:whitespace-normal">{PART_HINT[d.part]}</span>
        </div>
        {g.partLeft <= 10 && (
          <span className="text-red-600 font-bold text-xs shrink-0 animate-pulse hidden sm:inline whitespace-nowrap">
            ⏳ 倒计时即将结束！
          </span>
        )}
      </div>

      {g.partLeft <= 10 && (
        <div className="sm:hidden text-red-600 font-bold text-[11px] animate-pulse">
          ⏳ 倒计时快结束了：差不多得了，再抽象也能跑！
        </div>
      )}

      {/* 画布容器 */}
      <div className="w-full rounded-lg overflow-hidden border-2 border-(--ui-ink) shadow-[3px_3px_0_var(--ui-ink)] bg-(--ui-canvas-paper)">
        <canvas
          ref={d.canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          className="draw-canvas w-full aspect-[960/640] max-h-[44vh] sm:max-h-[55vh] object-contain block touch-none cursor-crosshair"
        />
      </div>

      {/* 底部工具操作栏 */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 my-0.5 sm:my-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => { playSfx("uiTap"); d.undo(); }} className={`${btn} bg-slate-600 hover:bg-slate-700`}>撤销</button>
          <button onClick={() => { playSfx("uiTap"); d.clear(); }} className={`${btn} bg-slate-600 hover:bg-slate-700`}>清空</button>
          <label className="flex items-center gap-1 text-xs font-bold text-(--ui-ink) cursor-pointer select-none ml-1">
            <input type="checkbox" checked={preview} onChange={e => onPreview(e.target.checked)} className="rounded" />
            <span className="hidden sm:inline">连杆</span>骨骼预览
          </label>
        </div>
        <button
          onClick={() => { playSfx("uiTap"); doFinishPart(); }}
          className={`primary ${btn} px-3 sm:px-5 bg-(--ui-go) hover:bg-(--ui-go-hover) shadow-[3px_3px_0_var(--ui-ink)] shrink-0`}
        >
          {d.part === "butt" ? "完成本部位并提交" : "完成本部位"}
        </button>
      </div>
      {g.doneNames.length > 0 && (
        <p className="text-(--ui-go) font-bold text-xs sm:text-sm">已具象化：{g.doneNames.join("、")}</p>
      )}
    </div>
  );
}
