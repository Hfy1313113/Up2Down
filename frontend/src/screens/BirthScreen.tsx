// BirthScreen.tsx —— 具象化仪式（three.js 版）：
// 落地冲击、双足踉跄物理反馈、恢复平衡、庆祝彩带与号角、自由 360° 检阅与生物力学检定报告。
// 展台外观与音效来自当前风格包。
import { useEffect, useRef, useState } from "react";
import { BirthScene } from "../three/birthScene";
import { useGame, sendDone } from "../state/game";
import type { ElephantModel } from "../game/types";
import { getPack } from "../style/registry";
import { playSfx } from "../audio/sfx";

const OBSERVE_SECONDS = 5;

function getAppraisal(model: ElephantModel | null) {
  if (!model) return null;
  const nLegs = model.legs.length;
  let ratioAvg = 0;
  let lenAvg = 0;
  for (const l of model.legs) {
    ratioAvg += l.L1 / (l.L2 || 1);
    lenAvg += l.L1 + l.L2;
  }
  ratioAvg = nLegs > 0 ? ratioAvg / nLegs : 1;
  lenAvg = nLegs > 0 ? lenAvg / nLegs : 120;

  let title = "非对称手搓抽象象";
  let trait = "四肢独立驱动，各足相位各自为政";
  let grade = "Class-C 神经协调存疑";
  let docComment = "物理引擎会诊意见：极易在奔跑中出现左前足踩右后足，鼻子还可能绊到自己";

  if (model.quality < 0.8) {
    title = "代偿性拼装象";
    trait = "有效腿数不足，已由系统加装 0.7 效率代偿假肢";
    grade = "Class-D 严重肢体缺损";
    docComment = "出厂质检警告：建议赛道两侧备齐千斤顶与起重机，这头象很抽象";
  } else if (ratioAvg > 1.45) {
    title = "高抬腿长杠杆象";
    trait = "股骨过长，膝关节折角接近机械干涉极限";
    grade = "Class-B 连杆干涉超标";
    docComment = "力学诊断：单步跨幅极大，但单摆惯量易导致迎面扑街";
  } else if (ratioAvg < 0.75) {
    title = "超高频短力臂象";
    trait = "小腿力臂极短，步态阻尼与惯性几乎为零";
    grade = "Class-B 谐振震颤体";
    docComment = "运动学诊断：步频突破极限，有效位移主要依赖地面共振";
  } else if (lenAvg > 175) {
    title = "超高重心悬挂象";
    trait = "四肢纵向尺寸超标，重心高耸，迎风面积巨大";
    grade = "Class-B 倾覆高危";
    docComment = "稳定性判定：横风阻力与转弯力矩过大，冲线需防侧翻";
  } else {
    title = "1.05:1 黄金拟合象";
    trait = "大腿与小腿比例高度贴合理论最优传动阻抗";
    grade = "Class-S 动力学特优";
    docComment = "检定结论：力学结构严密，在一众抽象象体中格格不入，反而最抽象";
  }

  return { title, trait, grade, docComment };
}

// ---------- 彩带（2D canvas 叠加在 3D 舞台上） ----------
interface ConfettiPart {
  x: number; y: number; vx: number; vy: number; g: number;
  w: number; h: number; rot: number; vr: number; color: string;
}

function startConfetti(canvas: HTMLCanvasElement, colors: string[]): () => void {
  const ctx = canvas.getContext("2d")!;
  const parts: ConfettiPart[] = [];
  for (let i = 0; i < 160; i++) {
    const fromLeft = i % 2 === 0;
    parts.push({
      x: fromLeft ? -10 : canvas.width + 10,
      y: canvas.height * (0.25 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7),
      vy: -(4 + Math.random() * 6),
      g: 0.18,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
    });
  }
  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      p.vx *= 0.99;
      if (p.y > canvas.height + 20) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.sin(p.rot * 2)));
      ctx.restore();
    }
    if (alive > 0) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  tick();
  return () => cancelAnimationFrame(raf);
}

export function BirthScreen({ demo = false }: { demo?: boolean }) {
  const g = useGame();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confRef = useRef<HTMLCanvasElement>(null);
  const [remain, setRemain] = useState(OBSERVE_SECONDS);
  const [canEnter, setCanEnter] = useState(false);
  const finishedRef = useRef(false);

  const myIndex = Math.max(0, g.players.findIndex(p => p.id === g.myId));
  const pack = getPack(g.styleId);
  const model = g.myModel!;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const confCv = confRef.current!;
    confCv.width = confCv.clientWidth;
    confCv.height = confCv.clientHeight;
    let stopConfetti = () => {};

    const scene = new BirthScene(canvas, model, pack, myIndex, {
      onImpact: () => playSfx("impact"),
      onRecover: () => {
        playSfx("fanfare");
        stopConfetti = startConfetti(confCv, pack.environment.confettiColors);
      },
    });
    scene.attachDrag(stageRef.current!);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      stopConfetti();
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setRemain(r => {
        if (r <= 1) { clearInterval(iv); setCanEnter(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    playSfx("uiTap");
    if (!demo) sendDone();
  };

  const appraisal = getAppraisal(model);

  return (
    <div className="screen birth w-full max-w-4xl mx-auto bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[5px_5px_0_var(--ui-ink)] p-3 sm:p-5 md:p-7 text-center my-auto flex flex-col gap-2 sm:gap-2.5 transition-all">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm sm:text-lg md:text-xl font-black text-(--ui-ink) tracking-tight">
          具象化完成 · 运动学检阅
        </h2>
        <span className="text-[11px] sm:text-xs text-(--ui-ink) opacity-60 font-medium">
          可手指/鼠标拖拽 360° 旋转
        </span>
      </div>

      <div
        ref={stageRef}
        className="birth-stage3d relative w-full h-[220px] sm:h-[300px] md:h-[380px] rounded-lg border-2 border-(--ui-ink) shadow-[3px_3px_0_var(--ui-ink)] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
        style={{ background: pack.birth.backdrop }}
      >
        <canvas ref={canvasRef} className="birth-canvas3d w-full h-full block" />
        <canvas ref={confRef} className="birth-confetti absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      {appraisal && (
        <div className="w-full max-w-lg mx-auto bg-white/70 border-2 border-dashed border-(--ui-ink) rounded-lg p-2 sm:p-3 text-left shadow-[2px_2px_0_var(--ui-ink)] flex flex-col gap-1 text-xs sm:text-sm">
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-(--ui-ink)/20">
            <span className="font-extrabold text-(--ui-ink) font-mono text-xs sm:text-sm truncate">
              力学体检：{appraisal.title}
            </span>
            <span className="bg-(--ui-ink) text-(--ui-paper) text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded shrink-0">
              {appraisal.grade}
            </span>
          </div>
          <div className="text-(--ui-ink) text-[11px] sm:text-xs leading-snug"><b>解剖特征：</b>{appraisal.trait}</div>
          <div className="text-(--ui-ink) text-[11px] sm:text-xs leading-snug"><b>会诊结论：</b>{appraisal.docComment}</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 mt-0.5">
        <p className="text-(--ui-ink) opacity-70 text-[11px] sm:text-xs font-medium m-0">
          {remain > 0 ? `出圈准备中… ${remain}s 后放行` : "关节点校准就绪，随时出圈！"}
        </p>
        <button
          disabled={!canEnter}
          onClick={finish}
          className="primary px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-(--ui-go) hover:bg-(--ui-go-hover) border-2 border-(--ui-ink) rounded-lg shadow-[3px_3px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 disabled:shadow-[2px_2px_0_#94a3b8] disabled:cursor-not-allowed transition-all"
        >
          {canEnter ? "确认出圈起跑 🏁" : `检阅中 (${remain}s)`}
        </button>
      </div>
    </div>
  );
}
