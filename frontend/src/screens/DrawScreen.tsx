// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并提交 done，进入等待屏。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, submitDrawing } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, PART_LABEL, useDrawCanvas, type Part } from "./useDrawCanvas";

const PART_HINTS: Record<Part, string> = {
  legs: "画出四条向下伸出的长线，中间带明显弯折（弯折处就是膝关节）。大腿:小腿≈1.05:1 跑得最快！",
  head: "画出马的头部和脖子（朝上前方）。大小和位置会成为小马的脑袋！",
  butt: "画出屁股和后腿上方/尾巴。尾巴会挂在躯干后端～",
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
    submitDrawing(strokes, model);
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
              {PART_LABEL[p]}{finished.includes(p) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <div className="countdown">
          <span className={g.partLeft <= 10 ? "urgent" : ""}>{g.partLeft}</span>s
        </div>
      </div>

      <canvas ref={d.canvasRef} width={LOGICAL_W} height={LOGICAL_H} className="draw-canvas" />

      <p className="draw-hint">{currentHint}</p>
      <div className="draw-tools">
        <button onClick={d.undo}>撤销</button>
        <button onClick={d.clear}>清空本部位</button>
        <label className="chk">
          <input type="checkbox" checked={preview} onChange={e => onPreview(e.target.checked)} />
          骨骼预览
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
