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
    ctx.lineWidth = 4;
    for (const s of [...parts.legs, ...parts.head, ...parts.butt]) drawStroke(s);
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 5;
    for (const s of strokes) drawStroke(s);
    if (current) drawStroke(current);

    // 参考躯干虚线
    ctx.save();
    ctx.strokeStyle = "rgba(226,112,58,.55)";
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W * 0.24, LOGICAL_H * 0.42);
    ctx.lineTo(LOGICAL_W * 0.76, LOGICAL_H * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(226,112,58,.8)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("躯干（自动生成）", LOGICAL_W * 0.5, LOGICAL_H * 0.42 - 14);
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
