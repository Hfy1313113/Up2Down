// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并提交 done，进入等待屏。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, prepareBirth } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, useDrawCanvas, type Part } from "./useDrawCanvas";

const PART_HINTS: Record<Part, string> = {
  legs: "腿部：自躯干向下画 4 条带弯折的长线（拐点识别为膝关节）。大腿:小腿≈1.05:1 速度最快，画成直棍或面条容易当场脱臼。",
  head: "头部：画出马头与脖颈线条。头部高度与前伸量将直接决定机体奔跑时的重心投影与俯仰姿态。",
  butt: "屁股：画出臀部轮廓与尾巴线条。后肢着力点与尾部空气阻尼将根据臀线自动张成。",
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

      {g.partLeft <= 8 && (
        <div className="urgent-hint">倒计时告急：未完成部位将由系统按 0.7 效率代偿补全！</div>
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
