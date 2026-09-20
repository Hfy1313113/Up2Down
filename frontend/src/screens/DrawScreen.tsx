// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并提交 done，进入等待屏。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, prepareBirth } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, useDrawCanvas, type Part } from "./useDrawCanvas";

const PART_HINTS: Record<Part, string> = {
  legs: "【第 1 步·腿部】：⚠️躯干会自动生成，请勿绘制躯干！仅在下方绿色框画 4 条带弯折的腿（拐点识别为膝关节）。大腿:小腿≈1.05:1 跑得最快，切勿在此画头或尾巴！",
  head: "【第 2 步·头部】：⚠️仅在右上方蓝色框画出马脖子、头与耳朵！头部高度与前伸量决定重心与俯仰，切勿在此画腿或尾巴！",
  butt: "【第 3 步·屁股】：⚠️仅在左侧橙色框画出臀部轮廓与尾巴！尾线决定后肢发力与阻尼，切勿在此画头或腿！",
};

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
  const currentHint = PART_HINTS[d.part];

  return (
    <div className="w-full max-w-5xl mx-auto bg-white border-2 border-[#233140] rounded-xl shadow-[5px_5px_0_rgba(35,49,64,0.9)] p-3 sm:p-5 md:p-7 text-center my-auto flex flex-col gap-2 sm:gap-3 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PARTS.map(p => {
            const isActive = p === d.part;
            const isDone = finished.includes(p);
            let cls = "bg-slate-200 text-[#233140]";
            if (isActive) cls = "bg-[#e2703a] text-white";
            else if (isDone) cls = "bg-emerald-200 text-emerald-900";
            return (
              <button
                key={p}
                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border-2 border-[#233140] text-xs sm:text-sm font-bold shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all ${cls}`}
                onClick={() => d.setPartTab(p)}
              >
                {PART_LABELS[p]}{isDone ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <div className="text-lg sm:text-2xl font-black font-mono px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg shadow-inner shrink-0">
          <span className={g.partLeft <= 10 ? "text-red-600 animate-pulse" : "text-[#233140]"}>{g.partLeft}</span>s
        </div>
      </div>

      <div className="w-full p-2.5 sm:p-3 bg-emerald-50 border-2 border-emerald-500 rounded-lg shadow-[2px_2px_0_#15803d] flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-left text-xs sm:text-sm leading-relaxed">
        <span className="bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded shrink-0">
          重要提示
        </span>
        <div className="text-slate-800">
          <b>马儿躯干为系统自动生成，玩家绝对无需绘制躯干！</b>
          请仅在当前部位的虚线框内绘制：
          {d.part === "legs" && <span className="block font-bold text-emerald-800 mt-0.5">【腿部】：从虚线躯干下方画 4 条带膝关节的长腿，切勿画头或尾巴！</span>}
          {d.part === "head" && <span className="block font-bold text-emerald-800 mt-0.5">【头部】：在右上方画出向右伸展的脖子与马头，切勿画腿或尾巴！</span>}
          {d.part === "butt" && <span className="block font-bold text-emerald-800 mt-0.5">【屁股】：在左侧画出臀线与尾巴线条，切勿画头或腿！</span>}
        </div>
      </div>

      {g.partLeft <= 10 && (
        <div className="text-red-600 font-bold text-xs sm:text-sm animate-pulse">
          ⏳ 倒计时快结束了：差不多得了，凑合凑合也能跑！
        </div>
      )}

      <div className="w-full rounded-lg overflow-hidden border-2 border-[#233140] shadow-[3px_3px_0_#233140] bg-[#fcfbf7]">
        <canvas ref={d.canvasRef} width={LOGICAL_W} height={LOGICAL_H} className="draw-canvas w-full aspect-[960/640] max-h-[46vh] sm:max-h-[56vh] object-contain block touch-none cursor-crosshair" />
      </div>

      <p className="text-slate-600 text-xs sm:text-sm font-medium px-1 text-center">{currentHint}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 my-1">
        <button
          onClick={d.undo}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 border-2 border-[#233140] rounded-lg shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          撤销
        </button>
        <button
          onClick={d.clear}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 border-2 border-[#233140] rounded-lg shadow-[2px_2px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          清空本部位
        </button>
        <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={preview} onChange={e => onPreview(e.target.checked)} className="rounded" />
          连杆骨骼预览
        </label>
        <button
          onClick={doFinishPart}
          className="px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-[#2ea043] hover:bg-[#278839] border-2 border-[#233140] rounded-lg shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          完成本部位{d.part === "butt" ? "并提交" : ""}
        </button>
      </div>
      {g.doneNames.length > 0 && (
        <p className="text-emerald-700 font-bold text-xs sm:text-sm">已提交：{g.doneNames.join("、")}</p>
      )}
    </div>
  );
}
