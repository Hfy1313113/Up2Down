// useDrawCanvas.ts —— 分部位手绘画布 Hook：
// 腿部 / 头部 / 屁股 各自独立笔画、撤销与清空；躯干自动生成无需绘制。
import { useCallback, useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import type { HorseModel, PartStrokes, Stroke, Vec2 } from "../game/types";

export const LOGICAL_W = 960, LOGICAL_H = 640;
export const PARTS = ["legs", "head", "butt"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABEL: Record<Part, string> = { legs: "腿部", head: "头部", butt: "屁股" };

export function useDrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<Record<Part, Stroke[]>>({ legs: [], head: [], butt: [] });
  const strokesRef = useRef<Stroke[]>([]);       // 当前部位的笔画
  const currentRef = useRef<Stroke | null>(null); // 正在画的笔画
  const previewRef = useRef(false);
  const [part, setPart] = useState<Part>("legs");
  const [rev, setRev] = useState(0); // 触发重绘

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const parts = partsRef.current;
    const strokes = strokesRef.current;
    const current = currentRef.current;
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const drawStroke = (s: Stroke) => {
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
    };
    ctx.strokeStyle = "#9db4c6";
    ctx.lineWidth = 6;
    for (const s of [...parts.legs, ...parts.head, ...parts.butt]) drawStroke(s);
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 8;
    for (const s of strokes) drawStroke(s);
    if (current) drawStroke(current);

    // 参考躯干虚线与免绘高亮提示（加粗大号虚线与高对比度标贴）
    ctx.save();
    ctx.strokeStyle = "rgba(226, 112, 58, 0.9)";
    ctx.lineWidth = 14;
    ctx.setLineDash([20, 14]);
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W * 0.20, LOGICAL_H * 0.42);
    ctx.lineTo(LOGICAL_W * 0.80, LOGICAL_H * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);

    // 躯干免绘大号胶囊标贴
    const torsoTagW = 600, torsoTagH = 48;
    const torsoTagX = LOGICAL_W * 0.5 - torsoTagW / 2;
    const torsoTagY = LOGICAL_H * 0.42 - 60;
    ctx.fillStyle = "rgba(255, 247, 237, 0.98)";
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(torsoTagX, torsoTagY, torsoTagW, torsoTagH, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c2410c";
    ctx.font = "bold 23px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠️ 躯干由系统自动生成，玩家绝对无需绘制躯干！", LOGICAL_W * 0.5, torsoTagY + torsoTagH / 2);

    // 当前部位专属绘制指导范围框（大号高对比度徽章标贴 + 加粗清晰虚线框）
    if (part === "legs") {
      const zx = LOGICAL_W * 0.16, zy = LOGICAL_H * 0.45, zw = LOGICAL_W * 0.68, zh = LOGICAL_H * 0.48;
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      const pillW = 520, pillH = 46;
      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.roundRect(zx + 14, zy + 14, pillW, pillH, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("📍【第 1 步·腿部范围】：从躯干向下画 4 条长腿", zx + 24, zy + 14 + pillH / 2);
    } else if (part === "head") {
      const zx = LOGICAL_W * 0.54, zy = LOGICAL_H * 0.06, zw = LOGICAL_W * 0.40, zh = LOGICAL_H * 0.42;
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      const pillW = 420, pillH = 46;
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.roundRect(zx + 14, zy + 14, pillW, pillH, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("📍【第 2 步·头部范围】：画马脖子与头耳", zx + 24, zy + 14 + pillH / 2);
    } else if (part === "butt") {
      const zx = LOGICAL_W * 0.06, zy = LOGICAL_H * 0.18, zw = LOGICAL_W * 0.36, zh = LOGICAL_H * 0.50;
      ctx.fillStyle = "rgba(249, 115, 22, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      const pillW = 380, pillH = 46;
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.roundRect(zx + 14, zy + 14, pillW, pillH, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("📍【第 3 步·屁股范围】：画臀线与尾巴", zx + 24, zy + 14 + pillH / 2);
    }
    ctx.restore();

    // 部位骨骼预览
    if (previewRef.current) {
      const model: HorseModel = Recognize.analyzeParts(collectAll());
      ctx.save();
      const scale = 1.6, bx = LOGICAL_W / 2, by = LOGICAL_H * 0.78;
      ctx.translate(bx, by); ctx.scale(scale, -scale);
      ctx.translate(0, model.torso.cy);
      ctx.strokeStyle = "#e2703a";
      ctx.fillStyle = "#e2703a";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      const T = model.torso;
      ctx.beginPath(); ctx.moveTo(-T.len / 2, 0); ctx.lineTo(T.len / 2, 0); ctx.stroke();
      ctx.setLineDash([]);
      for (const leg of model.legs) {
        ctx.beginPath();
        ctx.moveTo(leg.hip[0], leg.hip[1]);
        ctx.lineTo(leg.knee[0], leg.knee[1]);
        ctx.lineTo(leg.foot[0], leg.foot[1]);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(leg.knee[0], leg.knee[1], 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(model.head.x, model.head.y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { render(); }, [render, rev, part]);

  // 指针事件绑定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = (e: PointerEvent): Vec2 => {
      const r = canvas.getBoundingClientRect();
      return [
        (e.clientX - r.left) * (LOGICAL_W / r.width),
        (e.clientY - r.top) * (LOGICAL_H / r.height),
      ];
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      currentRef.current = { points: [pos(e)] };
      setRev(v => v + 1);
    };
    const move = (e: PointerEvent) => {
      const cur = currentRef.current;
      if (!cur) return;
      const p = pos(e);
      const last = cur.points[cur.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 2.5) {
        cur.points.push(p);
        setRev(v => v + 1);
      }
    };
    const up = () => {
      const cur = currentRef.current;
      if (!cur) return;
      if (cur.points.length >= 2) strokesRef.current.push(cur);
      currentRef.current = null;
      setRev(v => v + 1);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  const setPartTab = useCallback((p: Part) => {
    // 暂存当前部位未提交笔画
    partsRef.current[part] = partsRef.current[part].concat(strokesRef.current);
    strokesRef.current = [];
    currentRef.current = null;
    setPart(p);
  }, [part]);

  // 计时结束/手动完成：归档当前笔画并切换；返回下一部位或 null
  const finishPart = useCallback((): Part | null => {
    partsRef.current[part] = partsRef.current[part].concat(strokesRef.current);
    strokesRef.current = [];
    currentRef.current = null;
    const idx = PARTS.indexOf(part);
    const next = PARTS[idx + 1] ?? null;
    if (next) setPart(next);
    else setRev(v => v + 1);
    return next;
  }, [part]);

  const reset = useCallback(() => {
    partsRef.current = { legs: [], head: [], butt: [] };
    strokesRef.current = [];
    currentRef.current = null;
    setPart("legs");
  }, []);

  const collectAll = useCallback((): PartStrokes => {
    const p: PartStrokes = {
      legs: partsRef.current.legs.slice(),
      head: partsRef.current.head.slice(),
      butt: partsRef.current.butt.slice(),
    };
    (p[part] as Stroke[]) = (p[part] as Stroke[]).concat(strokesRef.current);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part]);

  const undo = useCallback(() => { strokesRef.current.pop(); setRev(v => v + 1); }, []);
  const clear = useCallback(() => { strokesRef.current = []; setRev(v => v + 1); }, []);
  const setPreview = useCallback((v: boolean) => { previewRef.current = v; setRev(r => r + 1); }, []);

  return {
    canvasRef, part, setPartTab, finishPart, reset,
    collectAll, undo, clear, setPreview,
    currentStrokeCount: () => strokesRef.current.length,
  };
}
