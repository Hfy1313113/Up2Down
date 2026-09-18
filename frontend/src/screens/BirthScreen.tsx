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
    <div className="screen birth">
      <div ref={stageRef} className="birth-stage3d">
        <canvas ref={canvasRef} className="birth-canvas3d" />
        <canvas ref={confRef} className="birth-confetti" />
        <div className="birth-text">机体装配完成 · 运动学检阅</div>
      </div>
      <p className="hint">按住左键拖拽旋转机体，滚轮缩放查看关节点</p>

      {appraisal && (
        <div className="appraisal-card">
          <div className="appraisal-header">
            <span className="appraisal-title">生物力学检定报告：{appraisal.title}</span>
            <span className="appraisal-grade">{appraisal.grade}</span>
          </div>
          <div className="appraisal-row"><b>解剖特征：</b>{appraisal.trait}</div>
          <div className="appraisal-row"><b>临床会诊：</b>{appraisal.docComment}</div>
        </div>
      )}

      <p className="birth-timer">{remain > 0 ? `出栏检阅中… ${remain}s 后允许起跑` : "所有关节已就绪，随时可放行出栏"}</p>
      <button className="primary" disabled={!canEnter} onClick={finish}>确认出栏起跑</button>
    </div>
  );
}
