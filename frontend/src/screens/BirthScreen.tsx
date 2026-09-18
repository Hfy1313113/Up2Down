// BirthScreen.tsx —— 小马诞生仪式（three.js 版）：
// 3D 旋转放大登场、Pointer 拖拽 360°、彩带 canvas 叠加、WebAudio 合成音效、15s 倒计时后发 done。
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

  let title = "大连手搓纯种马";
  let trait = "四肢健在但各走各的，散发迷之自信";
  let grade = "SSS 逆天物种";
  let docComment = "物理引擎看了沉默三秒，骨科医生连夜挂号";

  if (model.quality < 0.8) {
    title = "赛博合成拼装兽";
    trait = "疑似少画了腿，系统自动打折补全假肢";
    grade = "SR 抽象残缺美";
    docComment = "主治诊断：建议配一副拐杖再上跑道";
  } else if (ratioAvg > 1.45) {
    title = "高抬腿跨栏战神";
    trait = "大腿过于修长，跑步如跳秧歌";
    grade = "SSR 奇行异兽";
    docComment = "步幅突破天际，但极易当场闪到腰";
  } else if (ratioAvg < 0.75) {
    title = "超高频短腿缝纫机";
    trait = "小腿疯狂倒腾，动能转化率成谜";
    grade = "SSR 抽搐旋风";
    docComment = "步频高达八百，位移可能完全靠震动";
  } else if (lenAvg > 175) {
    title = "踩高跷超进化体";
    trait = "顶天立地，视野开阔但风阻巨大";
    grade = "SSR 巨型牛马";
    docComment = "重心过高，冲线时容易刹不住车";
  } else {
    title = "1.05:1 黄金比例马";
    trait = "疑似画画前偷偷翻阅了生物力学论文";
    grade = "UR 跑道刺客";
    docComment = "在一众抽象神金生物中显得过于端庄";
  }

  return { title, trait, grade, docComment };
}

// ---------- 音效（WebAudio 合成，无需音频文件） ----------
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
    const scene = new BirthScene(canvas, model, color);
    scene.attachDrag(stageRef.current!);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);

    fanfare();
    const confCv = confRef.current!;
    confCv.width = confCv.clientWidth;
    confCv.height = confCv.clientHeight;
    const stopConfetti = startConfetti(confCv);

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
        <div className="birth-text">⚡ 你的抽象小马降生了！⚡</div>
      </div>
      <p className="hint">🖱️ 拖拽舞台可 360° 全方位品鉴抽象工艺</p>

      {appraisal && (
        <div className="appraisal-card">
          <div className="appraisal-header">
            <span className="appraisal-title">📋 赛博物种鉴定：{appraisal.title}</span>
            <span className="appraisal-grade">{appraisal.grade}</span>
          </div>
          <div className="appraisal-row"><b>体态特质：</b>{appraisal.trait}</div>
          <div className="appraisal-row"><b>物理鉴定：</b>{appraisal.docComment}</div>
        </div>
      )}

      <p className="birth-timer">{remain > 0 ? `战马检阅中… ${remain}s 后可起跑` : "随时可以进入跑道发癫！"}</p>
      <button className="primary" disabled={!canEnter} onClick={finish}>放马开跑 🚀</button>
    </div>
  );
}
