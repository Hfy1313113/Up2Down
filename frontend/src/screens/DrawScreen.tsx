// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并提交 done，进入等待屏。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, prepareBirth } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, useDrawCanvas, type Part, PART_LABEL } from "./useDrawCanvas";

const PART_LABELS: Record<Part, string> = {
  legs: "1. 腿部连杆",
  head: "2. 头部颈廓",
  butt: "3. 尾部臀线",
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
    prepareBirth(strokes, model);   // 先本端诞生仪式，结束后发 done
  };

  const onPreview = (v: boolean) => { setPreview(v); d.setPreview(v); };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white border-2 border-[#233140] rounded-xl shadow-[5px_5px_0_rgba(35,49,64,0.9)] p-2.5 sm:p-5 md:p-7 text-center my-auto flex flex-col gap-2 sm:gap-2.5 transition-all">
      {/* 顶部栏：部位标签与倒计时保持在单行自适应，坚决不折行挤压 */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="grid grid-cols-3 gap-1 sm:gap-2 flex-1">
          {PARTS.map(p => {
            const isActive = p === d.part;
            const isDone = finished.includes(p);
            let stateCls = "";
            if (isActive) {
              stateCls = "active bg-[#e2703a] text-white border-[#233140]";
            } else if (isDone) {
              stateCls = "finished bg-[#86efac] text-[#14532d] border-[#16a34a] shadow-[2px_2px_0_#15803d]";
            } else {
              stateCls = "bg-slate-200 text-[#233140] border-[#233140]";
            }
            return (
              <button
                key={p}
                className={`part-tab py-1 px-1 sm:px-3 sm:py-2 rounded-lg border-2 text-xs sm:text-sm font-bold shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center truncate ${stateCls}`}
                onClick={() => d.setPartTab(p)}
              >
                <span className="sm:hidden">{PART_LABEL[p]}{isDone ? " ✓" : ""}</span>
                <span className="hidden sm:inline">{PART_LABELS[p]}{isDone ? " ✓" : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="text-base sm:text-2xl font-black font-mono px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg shadow-inner shrink-0 min-w-[50px] text-center">
          <span className={g.partLeft <= 10 ? "text-red-600 animate-pulse" : "text-[#233140]"}>{g.partLeft}</span>s
        </div>
      </div>

      {/* 紧凑型指引提示条，消除长文本双重重复堆叠 */}
      <div className="w-full px-2.5 py-1.5 sm:py-2 bg-emerald-50 border-2 border-emerald-500 rounded-lg shadow-[2px_2px_0_#15803d] flex items-center justify-between gap-2 text-left text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 text-slate-800 leading-snug">
          <span className="bg-emerald-600 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded shrink-0">
            免画躯干
          </span>
          <span className="truncate sm:whitespace-normal">
            {d.part === "legs" && "在下方绿框画 4 条带膝弯的长腿（躯干系统自动生成）"}
            {d.part === "head" && "在右上方蓝框画脖子、马头与耳朵（斜向右上伸展）"}
            {d.part === "butt" && "在左侧橙框画出臀部轮廓与尾巴线条（无需画腿与头）"}
          </span>
        </div>
        {g.partLeft <= 10 && (
          <span className="text-red-600 font-bold text-xs shrink-0 animate-pulse hidden sm:inline whitespace-nowrap">
            ⏳ 倒计时即将结束！
          </span>
        )}
      </div>

      {g.partLeft <= 10 && (
        <div className="sm:hidden text-red-600 font-bold text-[11px] animate-pulse">
          ⏳ 倒计时快结束了：差不多得了，凑合凑合也能跑！
        </div>
      )}

      {/* 画布容器 */}
      <div className="w-full rounded-lg overflow-hidden border-2 border-[#233140] shadow-[3px_3px_0_#233140] bg-[#fcfbf7]">
        <canvas
          ref={d.canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          className="draw-canvas w-full aspect-[960/640] max-h-[44vh] sm:max-h-[55vh] object-contain block touch-none cursor-crosshair"
        />
      </div>

      {/* 底部工具操作栏：撤销、清空、骨骼预览与完成按钮两端对齐排版 */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 my-0.5 sm:my-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={d.undo}
            className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 border-2 border-[#233140] rounded-lg shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            撤销
          </button>
          <button
            onClick={d.clear}
            className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 border-2 border-[#233140] rounded-lg shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            清空
          </button>
          <label className="flex items-center gap-1 text-xs font-bold text-slate-700 cursor-pointer select-none ml-1">
            <input type="checkbox" checked={preview} onChange={e => onPreview(e.target.checked)} className="rounded" />
            <span className="hidden sm:inline">连杆</span>骨骼预览
          </label>
        </div>
        <button
          onClick={doFinishPart}
          className="primary px-3 py-1 sm:px-5 sm:py-1.5 text-xs sm:text-sm font-bold text-white bg-[#2ea043] hover:bg-[#278839] border-2 border-[#233140] rounded-lg shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0"
        >
          {d.part === "butt" ? "完成本部位并提交" : "完成本部位"}
        </button>
      </div>
      {g.doneNames.length > 0 && (
        <p className="text-emerald-700 font-bold text-xs sm:text-sm">已提交：{g.doneNames.join("、")}</p>
      )}
    </div>
  );
}
