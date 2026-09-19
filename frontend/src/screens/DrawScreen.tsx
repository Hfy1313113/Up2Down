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
    <div className="screen draw">
      <div className="draw-top">
        <div className="part-tabs">
          {PARTS.map(p => (
            <button key={p}
              className={`part-tab ${p === d.part ? "active" : ""} ${finished.includes(p) ? "finished" : ""}`}
              onClick={() => d.setPartTab(p)}>
              {PART_LABELS[p]}{finished.includes(p) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <div className="countdown">
          <span className={g.partLeft <= 10 ? "urgent" : ""}>{g.partLeft}</span>s
        </div>
      </div>

      <div className="draw-guide-notice">
        <span className="guide-badge">重要提示</span>
        <div className="guide-content">
          <b>马儿躯干为系统自动生成，玩家绝对无需绘制躯干！</b>
          请仅在当前部位的虚线框内绘制：
          {d.part === "legs" && <span className="guide-step-tip">【腿部】：从虚线躯干下方画 4 条带膝关节的长腿，切勿画头或尾巴！</span>}
          {d.part === "head" && <span className="guide-step-tip">【头部】：在右上方画出向右伸展的脖子与马头，切勿画腿或尾巴！</span>}
          {d.part === "butt" && <span className="guide-step-tip">【屁股】：在左侧画出臀线与尾巴线条，切勿画头或腿！</span>}
        </div>
      </div>

      {g.partLeft <= 10 && (
        <div className="urgent-hint">
          ⏳ 倒计时快结束了：差不多得了，凑合凑合也能跑！
        </div>
      )}

      <canvas ref={d.canvasRef} width={LOGICAL_W} height={LOGICAL_H} className="draw-canvas" />

      <p className="draw-hint">{currentHint}</p>
      <div className="draw-tools">
        <button onClick={d.undo}>撤销</button>
        <button onClick={d.clear}>清空本部位</button>
        <label className="chk">
          <input type="checkbox" checked={preview} onChange={e => onPreview(e.target.checked)} />
          连杆骨骼预览
        </label>
        <button className="primary" onClick={doFinishPart}>
          完成本部位{d.part === "butt" ? "并提交" : ""}
        </button>
      </div>
      {g.doneNames.length > 0 && (
        <p className="draw-status">已提交:{g.doneNames.join("、")}</p>
      )}
    </div>
  );
}
