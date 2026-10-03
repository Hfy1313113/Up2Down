// useDrawCanvas.ts —— 分部位手绘画布 Hook：
// 象腿 / 象头 / 象臀 各自独立笔画、撤销与清空；躯干自动生成无需绘制。
// 每个部位提供浅虚线引导轮廓，玩家可描边也可自由发挥；识别层只看笔画，不看引导线。
import { useCallback, useEffect, useRef, useState } from "react";
import { Recognize } from "../game/recognize";
import type { ElephantModel, PartStrokes, Stroke, Vec2 } from "../game/types";

export const LOGICAL_W = 960, LOGICAL_H = 640;
export const PARTS = ["legs", "head", "butt"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABEL: Record<Part, string> = { legs: "象腿", head: "象头", butt: "象臀" };

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

    // 参考躯干虚线与免绘高亮提示（主题色从 CSS 变量读取，随风格包变化）
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue("--ui-accent").trim() || "#e2703a";
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 14;
    ctx.setLineDash([20, 14]);
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W * 0.20, LOGICAL_H * 0.42);
    ctx.lineTo(LOGICAL_W * 0.80, LOGICAL_H * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 躯干免绘大号胶囊标贴
    const torsoTagW = 600, torsoTagH = 48;
    const torsoTagX = LOGICAL_W * 0.5 - torsoTagW / 2;
    const torsoTagY = LOGICAL_H * 0.42 - 60;
    ctx.fillStyle = "rgba(255, 250, 240, 0.98)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(torsoTagX, torsoTagY, torsoTagW, torsoTagH, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "bold 23px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠️ 象身躯干由系统自动生成，不用画！专心抽象其他部位", LOGICAL_W * 0.5, torsoTagY + torsoTagH / 2);

    // 浅虚线引导轮廓：可描边、可无视。颜色随部位区域。
    const guide = (color: string, width = 3) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash([9, 9]);
      ctx.lineCap = "round";
    };
    const zoneTag = (x: number, y: number, w: number, fill: string, text: string) => {
      ctx.setLineDash([]);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 46, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + 10, y + 23);
    };
    const hint = (x: number, y: number, color: string, text: string) => {
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    };

    if (part === "legs") {
      const zx = LOGICAL_W * 0.16, zy = LOGICAL_H * 0.45, zw = LOGICAL_W * 0.68, zh = LOGICAL_H * 0.48;
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      zoneTag(zx + 14, zy + 14, 640, "#15803d", "📍【第 1 步·象腿】：画 4 条带膝弯的粗腿，沿浅虚线描边或自由发挥");

      // 四条粗腿的浅虚线轮廓：两条平行线 + 膝弯 + 圆足
      guide("rgba(22, 163, 74, 0.38)");
      const topY = LOGICAL_H * 0.42 + 12, kneeY = zy + zh * 0.52, footY = zy + zh * 0.90;
      const half = 20;
      for (const fx of [0.2, 0.38, 0.62, 0.8]) {
        const x = zx + zw * fx;
        const bend = fx < 0.5 ? -12 : 12;   // 后腿膝盖向前、前腿向后微弯
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + sgn * half, topY);
          ctx.lineTo(x + sgn * half + bend, kneeY);
          ctx.lineTo(x + sgn * (half + 3), footY);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(x, footY + 6, half + 6, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      hint(zx + zw * 0.5, zy + zh - 22, "rgba(21, 128, 61, 0.85)", "每条腿一笔画完：从躯干向下，经膝盖弯折到脚底；越抽象越好笑");
    } else if (part === "head") {
      const zx = LOGICAL_W * 0.54, zy = LOGICAL_H * 0.06, zw = LOGICAL_W * 0.40, zh = LOGICAL_H * 0.42;
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      zoneTag(zx + 14, zy + 14, 360, "#1d4ed8", "📍【第 2 步·象头】：脖子、象头、大扇耳、象鼻");

      const torsoFrontX = LOGICAL_W * 0.80, torsoY = LOGICAL_H * 0.42;
      const hx = zx + zw * 0.50, hy = zy + zh * 0.50, hr = 46;
      guide("rgba(37, 99, 235, 0.42)");
      // 脖子：从躯干前端接到头
      ctx.beginPath();
      ctx.moveTo(torsoFrontX, torsoY);
      ctx.quadraticCurveTo(torsoFrontX + 24, torsoY - 60, hx - hr * 0.6, hy + hr * 0.5);
      ctx.stroke();
      // 头
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.stroke();
      // 大扇耳：头后上方的大椭圆
      ctx.beginPath();
      ctx.ellipse(hx - hr * 0.95, hy - hr * 0.25, 34, 48, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      // 象鼻：从头前下方垂下并回卷
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.75, hy + hr * 0.35);
      ctx.bezierCurveTo(hx + hr * 1.5, hy + hr * 0.9, hx + hr * 1.6, hy + hr * 2.0, hx + hr * 1.15, hy + hr * 2.4);
      ctx.quadraticCurveTo(hx + hr * 0.95, hy + hr * 2.5, hx + hr * 0.9, hy + hr * 2.25);
      ctx.stroke();
      // 象牙小提示
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.55, hy + hr * 0.55);
      ctx.quadraticCurveTo(hx + hr * 0.95, hy + hr * 0.75, hx + hr * 1.1, hy + hr * 0.5);
      ctx.stroke();
      hint(hx, zy + zh - 16, "rgba(37, 99, 235, 0.85)", "脖子接躯干，圈画头，扇形画耳，长线垂鼻；想抽象就别管虚线");
    } else if (part === "butt") {
      const zx = LOGICAL_W * 0.06, zy = LOGICAL_H * 0.18, zw = LOGICAL_W * 0.36, zh = LOGICAL_H * 0.50;
      ctx.fillStyle = "rgba(249, 115, 22, 0.1)";
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(zx, zy, zw, zh);
      zoneTag(zx + 14, zy + 14, 330, "#c2410c", "📍【第 3 步·象臀】：臀线与细尾巴");

      const torsoRearX = LOGICAL_W * 0.20, torsoY = LOGICAL_H * 0.42;
      guide("rgba(194, 65, 12, 0.42)");
      // 臀线：从躯干后端上方绕到下方的大弧
      ctx.beginPath();
      ctx.moveTo(torsoRearX + 10, torsoY - 60);
      ctx.bezierCurveTo(torsoRearX - 70, torsoY - 50, torsoRearX - 80, torsoY + 60, torsoRearX + 6, torsoY + 78);
      ctx.stroke();
      // 细尾巴：从臀部中后方甩出，尾尖带穗
      const tx = torsoRearX - 36, ty = torsoY + 6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx - 60, ty + 30, tx - 70, ty + 110);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx - 70, ty + 110);
      ctx.lineTo(tx - 82, ty + 128);
      ctx.moveTo(tx - 70, ty + 110);
      ctx.lineTo(tx - 58, ty + 128);
      ctx.stroke();
      hint(zx + zw * 0.5, zy + zh - 16, "rgba(194, 65, 12, 0.85)", "臀线贴躯干后端画弧，细尾巴沿虚线甩出");
    }
    ctx.restore();

    // 连杆骨骼预览：把识别结果反算回画布坐标，直接叠在笔画上（躯干 / 四腿连杆 / 脖子 / 头与朝向 / 耳尖 / 象鼻 / 尾巴）
    if (previewRef.current) {
      const model: ElephantModel = Recognize.analyzeParts(collectAll());
      const cv = model.canvas;
      if (cv) {
        const toC = (p: Vec2): Vec2 => [cv.cx + p[0] / cv.scale, cv.feetY - p[1] / cv.scale];
        const len = (v: number) => v / cv.scale;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const ink = accent;
        const dot = (p: Vec2, r: number) => { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); };
        const poly = (pts: Vec2[]) => {
          if (pts.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        };

        // 躯干：自动生成的胶囊轮廓（半透明填充 + 虚线边）
        const T = model.torso;
        const tc = toC([T.cx, T.cy]);
        const tl = len(T.len), tt = len(T.thick);
        ctx.fillStyle = "rgba(226, 112, 58, 0.10)";
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.roundRect(tc[0] - tl / 2, tc[1] - tt / 2, tl, tt, tt / 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // 四条腿：髋 → 膝 → 足 连杆与关节点；合成腿用浅色虚线
        for (const leg of model.legs) {
          const hip = toC(leg.hip), knee = toC(leg.knee), foot = toC(leg.foot);
          ctx.strokeStyle = ink;
          ctx.fillStyle = ink;
          ctx.lineWidth = leg.synthesized ? 3 : 5;
          ctx.globalAlpha = leg.synthesized ? 0.45 : 0.9;
          ctx.setLineDash(leg.synthesized ? [6, 6] : []);
          poly([hip, knee, foot]);
          ctx.setLineDash([]);
          dot(hip, 7);
          dot(knee, 5.5);
          // 足底小横线
          ctx.beginPath(); ctx.moveTo(foot[0] - 10, foot[1]); ctx.lineTo(foot[0] + 10, foot[1]); ctx.stroke();
        }
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 4;
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;

        // 脖子：脖子根 → 头端
        const H = model.head;
        const neckBase = H.neckBaseX != null && H.neckBaseY != null
          ? toC([H.neckBaseX, H.neckBaseY])
          : toC([T.cx + T.len * 0.38, T.cy + T.thick * 0.28]);
        const neckEnd = toC([H.neckX, H.neckY]);
        poly([neckBase, neckEnd]);
        dot(neckBase, 6);

        // 头：头心圆 + 朝向箭头
        const hc = toC([H.x, H.y]);
        const hr = len(H.size) * 0.6;
        ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, 0, Math.PI * 2); ctx.stroke();
        dot(hc, 5);
        const dx = H.dirX ?? 0.7, dy = -(H.dirY ?? 0.7);   // 本地 y 向上 → 画布 y 向下
        const ax = hc[0] + dx * hr * 1.6, ay = hc[1] + dy * hr * 1.6;
        ctx.beginPath(); ctx.moveTo(hc[0], hc[1]); ctx.lineTo(ax, ay); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - dx * 12 + dy * 7, ay - dy * 12 - dx * 7);
        ctx.lineTo(ax - dx * 12 - dy * 7, ay - dy * 12 + dx * 7);
        ctx.closePath(); ctx.fill();

        // 耳尖：小三角；象鼻：曲线；尾巴：曲线
        for (const tip of H.earTips ?? []) {
          const t = toC(tip);
          ctx.beginPath();
          ctx.moveTo(t[0], t[1] - 9); ctx.lineTo(t[0] - 8, t[1] + 6); ctx.lineTo(t[0] + 8, t[1] + 6);
          ctx.closePath(); ctx.fill();
        }
        if (H.trunk?.length) {
          ctx.lineWidth = 5;
          poly(H.trunk.map(toC));
          dot(toC(H.trunk[H.trunk.length - 1]), 5);
        }
        if (model.tail?.curve?.length) {
          ctx.lineWidth = 3;
          poly(model.tail.curve.map(toC));
          dot(toC(model.tail.curve[0]), 5);
        }

        // 图例
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255, 250, 240, 0.95)";
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(14, LOGICAL_H - 46, 470, 32, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const synthN = model.legs.filter(l => l.synthesized).length;
        ctx.fillText(
          `连杆骨骼预览 · 腿 ${model.legs.length - synthN}/4 手绘${synthN ? `（${synthN} 条系统代偿）` : ""} · 头${H.found ? "✓" : "缺省"} · 鼻${H.trunk?.length ? "✓" : "程序化"} · 尾${model.tail?.curve?.length ? "✓" : "缺省"}`,
          26, LOGICAL_H - 30,
        );
        ctx.restore();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part]);

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
