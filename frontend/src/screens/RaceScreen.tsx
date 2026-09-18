// RaceScreen.tsx —— 赛跑/结算屏（three.js 版）：
// 真实 3D 场景消费 raceSim 状态（积分确定性在 raceSim，不在此处），
// 第三人称跟随相机 + 第一人称马儿视角（V 键/按钮切换）、3-2-1-GO、名次结算、房主"再来一局"。
import { useEffect, useRef, useState } from "react";
import { createRace, ranking, updateRace, type RaceState } from "../game/raceSim";
import { RaceScene, type ViewMode } from "../three/raceScene";
import { useGame, playAgain } from "../state/game";

export function RaceScreen({ demo = false }: { demo?: boolean }) {
  const g = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; list: { name: string; time: string }[] } | null>(null);
  const [view, setView] = useState<ViewMode>("third");
  const viewRef = useRef(view);
  viewRef.current = view;
  const raceRef = useRef<RaceState | null>(null);

  const iAmHost = demo || (g.host != null && g.host === g.myId);
  const myPos = Math.max(0, g.horses?.findIndex(h => h.id === g.myId) ?? 0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const list = (g.horses ?? []).map((h, i) => ({
      name: h.name,
      model: h.model,
      color: ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"][i % 4],
    }));
    const scene = new RaceScene(canvas, list, myPos);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);

    const race = createRace(list.map(l => ({ id: l.name, name: l.name, model: l.model })));
    raceRef.current = race;

    let raf = 0;
    let last = 0;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const frame = (now: number) => {
      if (cancelled) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      raceRef.current = updateRace(raceRef.current!, dt);
      scene.render(raceRef.current, viewRef.current, dt);
      if (raceRef.current.over) {
        const rank = ranking(raceRef.current);
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

    const seq = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i < seq.length) {
        setCountdown(seq[i]);
        i++;
        timers.push(setTimeout(tick, i === seq.length ? 500 : 800));
      } else {
        setCountdown(null);
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    tick();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
