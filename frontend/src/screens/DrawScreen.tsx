// DrawScreen.tsx —— 分部位绘制屏：legs → head → butt 各 50s，tab 切换、撤销/清空/预览，
// 三部位完成后本地 Recognize.analyzeParts 并提交 done，进入等待屏。
import { useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import { useGame, finishCurrentPart as finishPartState, prepareBirth } from "../state/game";
import { LOGICAL_W, LOGICAL_H, PARTS, useDrawCanvas, type Part } from "./useDrawCanvas";

const PART_HINTS: Record<Part, string> = {
  legs: "🦵 腿部：自躯干向下画4条带弯折的长线（折点即膝盖）。大腿:小腿≈1.05:1 速度最快，画成面条当场脱臼！",
  head: "🐴 头部：画出昂首挺胸的马头与长脖子。脑袋画得越抽象，冲线表情越安详！",
  butt: "🍑 屁股：画出饱满的马屁股与飘逸马尾巴。尾巴是赛博马儿唯一的空气动力学尾翼！",
};

const PART_EMOJI_LABEL: Record<Part, string> = {
  legs: "🦵 承重四腿",
  head: "🐴 智慧马头",
  butt: "🍑 灵魂马尾",
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
              {PART_EMOJI_LABEL[p]}{finished.includes(p) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <div className="countdown">
          <span className={g.partLeft <= 10 ? "urgent" : ""}>{g.partLeft}</span>s
        </div>
      </div>

      {g.partLeft <= 8 && (
        <div className="urgent-hint">🚨 倒计时告急！别扣细节了，瞎画两笔也能跑！</div>
      )}

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
