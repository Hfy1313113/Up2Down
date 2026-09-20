// BirthScreen.tsx —— 小马检阅仪式（three.js 版）：
// 落地冲击、双足踉跄物理反馈、恢复平衡、庆祝彩带与号角、自由 360° 检阅与生物力学检定报告。
import { useEffect, useRef, useState } from "react";
import { BirthScene } from "../three/birthScene";
import { useGame, sendDone } from "../state/game";
import { COLORS } from "../game/raceSim";
import type { HorseModel } from "../game/types";

const OBSERVE_SECONDS = 15;

function getAppraisal(model: HorseModel | null) {
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

  let title = "非对称手搓纯种";
  let trait = "四肢独立驱动，各足相位各自为政";
  let grade = "Class-C 神经协调存疑";
  let docComment = "物理引擎会诊意见：极易在奔跑中出现左前蹄踩右后蹄";

  if (model.quality < 0.8) {
    title = "代偿性拼装体";
    trait = "有效腿数不足，已由系统加装 0.7 效率代偿假肢";
    grade = "Class-D 严重肢体缺损";
    docComment = "出厂质检警告：建议赛道两侧备齐千斤顶与起重机";
  } else if (ratioAvg > 1.45) {
    title = "高抬腿长杠杆体";
    trait = "股骨过长，膝关节折角接近机械干涉极限";
    grade = "Class-B 连杆干涉超标";
    docComment = "力学诊断：单步跨幅极大，但单摆惯量易导致迎面扑街";
  } else if (ratioAvg < 0.75) {
    title = "超高频短力臂机体";
    trait = "小腿力臂极短，步态阻尼与惯性几乎为零";
    grade = "Class-B 谐振震颤体";
    docComment = "运动学诊断：步频突破极限，有效位移主要依赖地面共振";
  } else if (lenAvg > 175) {
    title = "超高重心悬挂体";
    trait = "四肢纵向尺寸超标，重心高耸，迎风面积巨大";
    grade = "Class-B 倾覆高危";
    docComment = "稳定性判定：横风阻力与转弯力矩过大，冲线需防侧翻";
  } else {
    title = "1.05:1 黄金拟合型";
    trait = "大腿与小腿比例高度贴合理论最优传动阻抗";
    grade = "Class-S 动力学特优";
    docComment = "检定结论：力学结构严密，在一众抽象机体中格格不入";
  }

  return { title, trait, grade, docComment };
}

// ---------- 物理触地撞击音效 ----------
function playImpact() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.12);
    gain.gain.setValueAtTime(0.35, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  } catch { /* 音频不可用时静默 */ }
}

// ---------- 胜利号角音效（WebAudio 合成） ----------
function fanfare() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const t = t0 + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.9 : 0.22));
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
    for (let i = 0; i < 5; i++) {
      const t = t0 + 0.15 + i * 0.28;
      const noise = audioCtx.createBufferSource();
      const buf = audioCtx.createBuffer(1, 2205, 22050);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
      noise.buffer = buf;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      noise.connect(g).connect(audioCtx.destination);
      noise.start(t);
    }
  } catch { /* 音频不可用时静默 */ }
}

// ---------- 彩带（2D canvas 叠加在 3D 舞台上） ----------
interface ConfettiPart {
  x: number; y: number; vx: number; vy: number; g: number;
  w: number; h: number; rot: number; vr: number; color: string;
}

function startConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d")!;
  const colors = ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c", "#b06ad4", "#ffe27a"];
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
  const color = COLORS[myIndex % COLORS.length];
  const model = g.myModel!;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const confCv = confRef.current!;
    confCv.width = confCv.clientWidth;
    confCv.height = confCv.clientHeight;
    let stopConfetti = () => {};

    const scene = new BirthScene(canvas, model, color, {
      onImpact: () => {
        playImpact();
      },
      onRecover: () => {
        fanfare();
        stopConfetti = startConfetti(confCv);
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
    if (!demo) sendDone();
  };

  const appraisal = getAppraisal(model);

  return (
    <div className="screen birth w-full max-w-4xl mx-auto bg-white border-2 border-[#233140] rounded-xl shadow-[5px_5px_0_rgba(35,49,64,0.9)] p-3 sm:p-6 md:p-8 text-center my-auto flex flex-col gap-2 sm:gap-3.5 transition-all">
      <div
        ref={stageRef}
        className="birth-stage3d relative w-full h-[260px] sm:h-[340px] md:h-[420px] rounded-lg border-2 border-[#233140] shadow-[3px_3px_0_#233140] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing bg-gradient-to-b from-[#dae7f2] to-[#edf4f9]"
      >
        <canvas ref={canvasRef} className="birth-canvas3d w-full h-full block" />
        <canvas ref={confRef} className="birth-confetti absolute inset-0 w-full h-full pointer-events-none" />
        <div className="birth-text absolute top-2.5 sm:top-3 left-1/2 -translate-x-1/2 bg-white/90 border-2 border-[#233140] px-3 py-1 rounded-md text-xs sm:text-base font-extrabold shadow-[2px_2px_0_#233140] pointer-events-none whitespace-nowrap">
          机体装配完成 · 运动学检阅
        </div>
      </div>
      <p className="text-slate-500 text-xs sm:text-sm font-medium">按住左键/手指拖拽旋转机体，滚轮缩放查看关节点</p>

      {appraisal && (
        <div className="w-full max-w-lg mx-auto bg-[#fdfcf9] border-2 border-dashed border-slate-600 rounded-lg p-3 sm:p-4 text-left shadow-[3px_3px_0_rgba(71,85,105,0.25)] flex flex-col gap-1.5 text-xs sm:text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="font-extrabold text-slate-800 font-mono">
              生物力学检定报告：{appraisal.title}
            </span>
            <span className="bg-slate-900 text-slate-100 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded">
              {appraisal.grade}
            </span>
          </div>
          <div className="text-slate-700"><b>解剖特征：</b>{appraisal.trait}</div>
          <div className="text-slate-700"><b>临床会诊：</b>{appraisal.docComment}</div>
        </div>
      )}

      <p className="text-slate-500 text-xs sm:text-sm font-medium">
        {remain > 0 ? `出栏检阅中… ${remain}s 后允许起跑` : "所有关节已就绪，随时可放行出栏"}
      </p>
      <button
        disabled={!canEnter}
        onClick={finish}
        className="primary w-full sm:w-auto px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white bg-[#2ea043] hover:bg-[#278839] border-2 border-[#233140] rounded-lg shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 disabled:bg-slate-300 disabled:border-slate-400 disabled:cursor-not-allowed mx-auto transition-all"
      >
        确认出栏起跑
      </button>
    </div>
  );
}
