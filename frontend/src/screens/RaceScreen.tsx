// RaceScreen.tsx —— 赛跑/结算屏（Canvas 2D 复刻 race.js）：
// 伪 3D 赛道、确定性位移积分（raceSim）、第三人称旁观 + 第一人称马儿视角（V 键切换）、
// 3-2-1-GO 倒计时、名次结算横幅、房主"再来一局"。
import { useEffect, useRef, useState } from "react";
import { computePose } from "../game/gait";
import { drawHorse, shade } from "../game/horseDraw";
import { createRace, ranking, TRACK_LEN, updateRace, type RaceState } from "../game/raceSim";
import { useGame, playAgain } from "../state/game";

export function RaceScreen() {
  const g = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; list: { name: string; time: string }[] } | null>(null);
  const [view, setView] = useState<"third" | "first">("third");
  const viewRef = useRef(view);
  viewRef.current = view;
  const raceRef = useRef<RaceState | null>(null);

  const iAmHost = g.host != null && g.host === g.myId;
  const myPos = Math.max(0, g.horses?.findIndex(h => h.id === g.myId) ?? 0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const entries = (g.horses ?? []).map(h => ({ id: h.id, name: h.name, model: h.model }));
    const race = createRace(entries);
    raceRef.current = race;

    // 确定性背景云
    const clouds = Array.from({ length: 14 }, (_, i) => ({
      x: i * 430 + (i * 137) % 200, y: 40 + (i * 89) % 120, s: 0.7 + (i % 3) * 0.35,
    }));

    let raf = 0;
    let last = 0;
    let cameraX = 0;

    const groundY = (lane: number) => canvas.height * 0.62 + lane * (canvas.height * 0.075);

    const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
      ctx.arc(x + 24 * s, y + 4 * s, 18 * s, 0, Math.PI * 2);
      ctx.arc(x - 24 * s, y + 5 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    };

    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const renderThird = (ctx: CanvasRenderingContext2D, st: RaceState) => {
      const w = canvas.width, h = canvas.height;
      const leader = Math.max(...st.runners.map(r => Math.min(r.x, TRACK_LEN)));
      const target = Math.max(0, Math.min(leader - w * 0.38, TRACK_LEN - w * 0.6));
      cameraX += (target - cameraX) * 0.08;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#6ec1f5"); sky.addColorStop(0.6, "#bfe6ff"); sky.addColorStop(1, "#dff3ff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(w * 0.85, 70, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,233,163,.35)";
      ctx.beginPath(); ctx.arc(w * 0.85, 70, 62, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const c of clouds) {
        let sx = (c.x - cameraX * 0.25) % (w + 500);
        if (sx < -250) sx += w + 500;
        drawCloud(ctx, sx, c.y, c.s);
      }

      ctx.fillStyle = "#a9d29a";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      for (let sx = 0; sx <= w + 40; sx += 40) {
        const wx = sx + cameraX * 0.5;
        ctx.lineTo(sx, h * 0.55 - 40 - 35 * Math.sin(wx * 0.004) - 20 * Math.sin(wx * 0.011));
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h);
      ctx.closePath(); ctx.fill();

      const gr = ctx.createLinearGradient(0, h * 0.52, 0, h);
      gr.addColorStop(0, "#8fce6e"); gr.addColorStop(1, "#5da84a");
      ctx.fillStyle = gr; ctx.fillRect(0, h * 0.55, w, h * 0.45);

      ctx.strokeStyle = "#a5713f";
      ctx.lineWidth = 4;
      const spacing = 90;
      const start = -(cameraX % spacing);
      ctx.beginPath();
      for (let sx = start; sx < w + spacing; sx += spacing) {
        ctx.moveTo(sx, h * 0.55); ctx.lineTo(sx, h * 0.55 - 26);
      }
      ctx.moveTo(0, h * 0.55 - 18); ctx.lineTo(w, h * 0.55 - 18);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 3;
      const gstart = -(cameraX % 60);
      ctx.beginPath();
      for (let sx = gstart; sx < w; sx += 60) {
        ctx.moveTo(sx, h * 0.86); ctx.lineTo(sx - 14, h * 0.94);
      }
      ctx.stroke();

      const fx = TRACK_LEN - cameraX;
      if (fx > -80 && fx < w + 80) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(fx - 6, h * 0.18, 12, h * 0.78);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = i % 2 ? "#222" : "#fff";
          ctx.fillRect(fx - 6, h * 0.18 + i * h * 0.055, 12, h * 0.055);
        }
        ctx.fillStyle = "#e2703a";
        ctx.beginPath(); ctx.arc(fx, h * 0.16, 10, 0, Math.PI * 2); ctx.fill();
      }

      const rank = ranking(st);
      st.runners.forEach((r, lane) => {
        const sx = r.x - cameraX;
        if (sx < -200 || sx > w + 200) return;
        const gy = groundY(lane);
        const scale = (0.72 - lane * 0.05) * (h / 640);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.beginPath();
        ctx.ellipse(sx, gy + 6 * scale, 70 * scale * 2.2, 10 * scale * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        const pose = computePose(r.model, r.phase);
        drawHorse(ctx, r.model, pose, sx, gy, scale, r.color, { phase: r.phase, jointColor: "#fff" });
        const place = rank.indexOf(r) + 1;
        ctx.fillStyle = "rgba(255,255,255,.85)";
        roundRect(ctx, sx - 44, gy - 150 * scale - 34, 88, 22, 8);
        ctx.fill();
        ctx.fillStyle = "#33475b";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`#${place} ${r.name}`, sx, gy - 150 * scale - 18);
      });

      ctx.fillStyle = "rgba(255,255,255,.8)";
      roundRect(ctx, w * 0.12, 12, w * 0.76, 8, 4); ctx.fill();
      st.runners.forEach(r => {
        const px = w * 0.12 + (Math.min(r.x, TRACK_LEN) / TRACK_LEN) * w * 0.76;
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(px, 16, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.fillStyle = "#33475b";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🏁", w * 0.885, 24);
    };

    const renderFirst = (ctx: CanvasRenderingContext2D, st: RaceState) => {
      const w = canvas.width, h = canvas.height;
      const me = st.runners[myPos] ?? st.runners[0];
      const pose = computePose(me.model, me.phase);
      const bob = pose.bob * 2.2;
      const horizon = h * 0.40 + bob;
      const F = 320;
      const persp = (d: number) => F / (F + Math.max(d, 0));
      const gY = (d: number) => horizon + (h - horizon) * persp(d);

      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#5db4f0"); sky.addColorStop(1, "#cfeaff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 2);
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(w * 0.78, horizon * 0.35, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const c of clouds) {
        const sx = (((c.x - me.x * 0.3) % (w + 500)) + w + 500) % (w + 500) - 250;
        drawCloud(ctx, sx, c.y * 0.8, c.s * 0.8);
      }
      ctx.fillStyle = "#a9d29a";
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let sx = 0; sx <= w + 40; sx += 40) {
        ctx.lineTo(sx, horizon - 20 - 18 * Math.sin((sx + me.x * 0.5) * 0.004));
      }
      ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();

      const gr = ctx.createLinearGradient(0, horizon, 0, h);
      gr.addColorStop(0, "#9ad67c"); gr.addColorStop(1, "#4f9c3f");
      ctx.fillStyle = gr; ctx.fillRect(0, horizon, w, h - horizon);

      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 26; k++) {
        const d = ((k * 110 - (me.x % 110)) + 110 * 26) % (110 * 26);
        const y = gY(d), p = persp(d);
        const len = 30 * (1 - p) + 8;
        const x = (k * 197) % w;
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y + len * 0.25); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "#a5713f";
      ctx.lineWidth = 3;
      for (let k = 0; k < 12; k++) {
        const d = ((k * 160 - (me.x % 160)) + 160 * 12) % (160 * 12);
        const y = gY(d), p = persp(d);
        const px = w * 0.5 - 260 * p, px2 = w * 0.5 + 260 * p;
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.4);
        ctx.beginPath();
        ctx.moveTo(px, y); ctx.lineTo(px, y - 60 * p);
        ctx.moveTo(px2, y); ctx.lineTo(px2, y - 60 * p);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      st.runners.forEach((r, i) => {
        if (i === myPos) return;
        const d = r.x - me.x;
        if (d < -30 || d > 1400) return;
        const p = persp(Math.max(d, 0));
        const y = gY(Math.max(d, 0));
        const laneShift = (i - myPos) * 90 * p;
        const scale = 1.5 * p * (h / 640);
        if (scale < 0.05) return;
        const pose2 = computePose(r.model, r.phase);
        drawHorse(ctx, r.model, pose2, w * 0.5 + laneShift, y, scale, r.color, { phase: r.phase });
        if (d > 60) {
          ctx.fillStyle = "rgba(255,255,255,.8)";
          ctx.font = `${Math.max(10, 16 * p)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(r.name, w * 0.5 + laneShift, y - 150 * scale - 8);
        }
      });

      const df = TRACK_LEN - me.x;
      if (df > -50 && df < 1600) {
        const p = persp(Math.max(df, 0));
        const y = gY(Math.max(df, 0));
        const bw = 560 * p, bh = 190 * p;
        ctx.fillStyle = "#fff";
        ctx.fillRect(w / 2 - bw / 2, y - bh, bw, bh * 0.16);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = i % 2 ? "#222" : "#fff";
          ctx.fillRect(w / 2 - bw / 2 + (bw / 10) * i, y - bh, bw / 10, bh * 0.16);
        }
        ctx.fillStyle = "#e2703a";
        ctx.fillRect(w / 2 - bw / 2 - 8 * p, y - bh, 8 * p, bh);
        ctx.fillRect(w / 2 + bw / 2, y - bh, 8 * p, bh);
      }

      // 自己的马头轮廓
      const m = me.model;
      const hx = w * 0.5, hy = h * 0.88 + bob * 1.5;
      const hs = (h / 640) * 2.4;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(hs, hs);
      ctx.fillStyle = shade(me.color, 0.85);
      ctx.beginPath();
      ctx.moveTo(-m.head.size * 1.6, m.head.size * 2.4);
      ctx.quadraticCurveTo(-m.head.size * 0.6, m.head.size * 0.5, -m.head.size * 0.2, 0);
      ctx.lineTo(m.head.size * 0.9, 0);
      ctx.quadraticCurveTo(m.head.size * 1.2, m.head.size * 1.6, m.head.size * 1.8, m.head.size * 2.4);
      ctx.closePath(); ctx.fill();
      const earW = Math.sin(me.phase * 2 * Math.PI) * 0.12;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * m.head.size * 0.5, -m.head.size * 0.1);
        ctx.rotate(s * 0.25 + earW * s);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * m.head.size * 0.25, -m.head.size * 1.1);
        ctx.lineTo(s * m.head.size * 0.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = shade(me.color, 0.55);
      ctx.beginPath();
      ctx.moveTo(-m.head.size * 0.2, 0);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(-m.head.size * 0.2 + i * m.head.size * 0.2,
          -m.head.size * (0.15 + 0.2 * Math.abs(Math.sin(i * 2.1 + me.phase * 6))));
      }
      ctx.lineTo(m.head.size * 0.9, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // HUD
      const rank = ranking(st);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      roundRect(ctx, 14, 14, 240, 66, 10); ctx.fill();
      ctx.fillStyle = "#33475b";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`#${rank.indexOf(me) + 1} ${me.name}`, 26, 40);
      ctx.font = "14px sans-serif";
      ctx.fillText(`速度 ${(me.speed / 10).toFixed(1)} m/s   视角:马儿`, 26, 64);
      ctx.fillStyle = "rgba(255,255,255,.7)";
      roundRect(ctx, w * 0.3, 16, w * 0.4, 8, 4); ctx.fill();
      const px = w * 0.3 + (Math.min(me.x, TRACK_LEN) / TRACK_LEN) * w * 0.4;
      ctx.fillStyle = me.color;
      ctx.beginPath(); ctx.arc(px, 20, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    };

    const frame = (now: number) => {
      const ctx = canvas.getContext("2d")!;
      const st = raceRef.current!;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      raceRef.current = updateRace(st, dt);
      const cur = raceRef.current;
      if (viewRef.current === "first") renderFirst(ctx, cur);
      else renderThird(ctx, cur);
      if (cur.over) {
        const rank = ranking(cur);
        setResult({
          name: rank[0].name,
          list: rank.map(r => ({
            name: r.name,
            time: r.finishTime != null ? `（${r.finishTime.toFixed(1)} 秒）` : "（未完赛）",
          })),
        });
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    // 3-2-1-GO 倒计时后开赛
    const seq = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      if (i < seq.length) {
        setCountdown(seq[i]);
        i++;
        setTimeout(tick, i === seq.length ? 500 : 800);
      } else {
        setCountdown(null);
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    tick();

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // V 键切换视角
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") setView(v => v === "first" ? "third" : "first");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="race-wrap">
      <canvas ref={canvasRef} className="race-canvas" />
      {countdown && <div className="race-countdown">{countdown}</div>}
      <div className="race-view-btns">
        <button className={view === "third" ? "active" : ""} onClick={() => setView("third")}>旁观视角</button>
        <button className={view === "first" ? "active" : ""} onClick={() => setView("first")}>马儿视角 (V)</button>
      </div>
      {result && (
        <div className="race-banner">
          <h2>🏆 {result.name} 获胜！</h2>
          <ol>
            {result.list.map((r, i) => (
              <li key={i}>{["🥇", "🥈", "🥉", "4️⃣"][i]} {r.name} {r.time}</li>
            ))}
          </ol>
          {iAmHost && <button onClick={playAgain}>再来一局</button>}
        </div>
      )}
    </div>
  );
}
