// BirthScreen.tsx —— 小马诞生仪式（复刻 birth.js）：
// 旋转放大登场（CSS 3D）、喷射彩带、WebAudio 合成音效、360° 拖拽观察、15s 倒计时后发 done。
import { useEffect, useRef, useState } from "react";
import { computePose } from "../game/gait";
import { drawHorse } from "../game/horseDraw";
import { useGame, sendDone } from "../state/game";
import { COLORS } from "../game/raceSim";

const OBSERVE_SECONDS = 15;

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

// ---------- 彩带 ----------
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

export function BirthScreen() {
  const g = useGame();
  const flipRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confRef = useRef<HTMLCanvasElement>(null);
  const [remain, setRemain] = useState(OBSERVE_SECONDS);
  const [canEnter, setCanEnter] = useState(false);
  const finishedRef = useRef(false);

  const myIndex = Math.max(0, g.players.findIndex(p => p.id === g.myId));
  const color = COLORS[myIndex % COLORS.length];
  const model = g.myModel!;

  // 马画到透明画布 + 登场动画 + 音效 + 彩带
  useEffect(() => {
    const cv = canvasRef.current!;
    const cctx = cv.getContext("2d")!;
    cctx.clearRect(0, 0, cv.width, cv.height);
    const pose = computePose(model, 0.18);
    drawHorse(cctx, model, pose, cv.width / 2, cv.height * 0.82, 1.15, color,
      { phase: 0.18, showJoints: true, jointColor: "#ffe27a" });

    fanfare();
    const confCv = confRef.current!;
    confCv.width = confCv.clientWidth;
    confCv.height = confCv.clientHeight;
    const stopConfetti = startConfetti(confCv);
    return stopConfetti;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 15s 倒计时
  useEffect(() => {
    const iv = setInterval(() => {
      setRemain(r => {
        if (r <= 1) { clearInterval(iv); setCanEnter(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // 拖拽 360° 观察（CSS 3D）
  useEffect(() => {
    const stage = document.getElementById("birth-stage");
    const flip = flipRef.current;
    if (!stage || !flip) return;
    let dragging = false, lx = 0, ly = 0, ry = 0, rx = 0;
    const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      ry += (e.clientX - lx) * 0.5;
      rx = Math.max(-30, Math.min(30, rx - (e.clientY - ly) * 0.3));
      lx = e.clientX; ly = e.clientY;
      flip.style.animation = "none";
      flip.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const up = () => { dragging = false; };
    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      stage.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    sendDone();
  };

  return (
    <div className="screen birth">
      <div id="birth-stage" className="birth-stage">
        <div ref={flipRef} className="birth-flip">
          <div className="birth-text">🎉 你的小马诞生了！</div>
          <canvas ref={canvasRef} width={560} height={460} className="birth-canvas" />
        </div>
      </div>
      <canvas ref={confRef} className="birth-confetti" />
      <p className="hint">拖拽可 360° 观察</p>
      <p className="birth-timer">{remain > 0 ? `${remain}s 后可进入比赛` : "可以进入比赛了！"}</p>
      <button className="primary" disabled={!canEnter} onClick={finish}>进入比赛 →</button>
    </div>
  );
}
