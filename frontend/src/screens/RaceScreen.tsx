// RaceScreen.tsx —— 赛跑/结算屏（three.js 版）：
// 真实 3D 场景消费 raceSim 状态（积分确定性在 raceSim，不在此处），
// 第三人称跟随相机 + 第一人称马儿视角（V 键/按钮切换）、3-2-1-GO、全屏连点加速抽鞭、名次结算、房主"再来一局"。
import { useEffect, useRef, useState, useCallback } from "react";
import { createRace, ranking, updateRace, applyTapBoost, setRunnerBoost, MAX_BOOST, type RaceState } from "../game/raceSim";
import { RaceScene, type ViewMode } from "../three/raceScene";
import { useGame, playAgain } from "../state/game";
import { transport } from "../net/transport";

interface WhipPop {
  id: number;
  x: number;
  y: number;
  text: string;
}

export function RaceScreen({ demo = false }: { demo?: boolean }) {
  const g = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; list: { name: string; time: string }[] } | null>(null);
  const [view, setView] = useState<ViewMode>("third");
  const viewRef = useRef(view);
  viewRef.current = view;
  const raceRef = useRef<RaceState | null>(null);
  const [boostRatio, setBoostRatio] = useState(0); // [0, 1]
  const [whipPops, setWhipPops] = useState<WhipPop[]>([]);
  const popSeq = useRef(0);

  const iAmHost = demo || (g.host != null && g.host === g.myId);
  const myIndex = Math.max(0, g.horses?.findIndex(h => h.id === g.myId) ?? 0);
  const myRunnerId = (g.horses && g.horses[myIndex]?.id) || (g.horses && g.horses[0]?.id) || "default";

  // 连点加速与挥鞭逻辑
  const handleBoostTap = useCallback((clientX?: number, clientY?: number) => {
    if (countdown !== null || result !== null || !raceRef.current || raceRef.current.over) return;
    raceRef.current = applyTapBoost(raceRef.current, myRunnerId);

    const me = raceRef.current.runners.find(r => r.id === myRunnerId);
    if (me) {
      setBoostRatio((me.boost - 1.0) / (MAX_BOOST - 1.0));
      transport.send({
        t: "horse_boost",
        id: myRunnerId,
        boost: me.boost,
        whip: me.whipIntensity,
      });
    }

    if (clientX !== undefined && clientY !== undefined) {
      const id = ++popSeq.current;
      const texts = ["啪！抽鞭！💨", "加速！⚡", "飙起来！🔥", "驾！🐎"];
      const text = texts[id % texts.length];
      setWhipPops(p => [...p.slice(-4), { id, x: clientX, y: clientY, text }]);
      setTimeout(() => {
        setWhipPops(p => p.filter(item => item.id !== id));
      }, 500);
    }
  }, [countdown, result, myRunnerId]);

  useEffect(() => {
    const unsub = transport.on((msg) => {
      if (msg.t === "horse_boost" && raceRef.current) {
        raceRef.current = setRunnerBoost(
          raceRef.current,
          msg.id as string,
          msg.boost as number,
          msg.whip as number
        );
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const list = (g.horses ?? []).map((h, i) => ({
      id: h.id,
      name: h.name,
      model: h.model,
      color: ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"][i % 4],
    }));
    const scene = new RaceScene(canvas, list, myIndex);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);

    const race = createRace(list.map(l => ({ id: l.id, name: l.name, model: l.model })));
    raceRef.current = race;

    let raf = 0;
    let last = 0;
    let cancelled = false;
    let demoAiTimer = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const frame = (now: number) => {
      if (cancelled) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      // 开发态 demo 模式下给 AI 马注入微加速，呈现动态对抗
      if (demo && raceRef.current && !raceRef.current.over) {
        demoAiTimer += dt;
        if (demoAiTimer > 0.25) {
          demoAiTimer = 0;
          raceRef.current.runners.forEach((r, idx) => {
            if (idx !== myIndex && Math.random() < 0.45) {
              raceRef.current = applyTapBoost(raceRef.current!, r.id);
            }
          });
        }
      }

      raceRef.current = updateRace(raceRef.current!, dt);
      scene.render(raceRef.current, viewRef.current, dt);

      // 同步自身马匹当前 boost
      const me = raceRef.current.runners.find(r => r.id === myRunnerId);
      if (me) {
        setBoostRatio((me.boost - 1.0) / (MAX_BOOST - 1.0));
      }

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

    const seq = ["3", "2", "1", "开跑！"];
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i < seq.length) {
        setCountdown(seq[i]);
        i++;
        timers.push(setTimeout(tick, i === seq.length ? 650 : 800));
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
      if (e.key === "v" || e.key === "V") {
        setView(v => v === "first" ? "third" : "first");
      } else if (e.code === "Space") {
        e.preventDefault();
        handleBoostTap(window.innerWidth / 2, window.innerHeight / 2);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleBoostTap]);

  const onPointerDown = (e: React.PointerEvent) => {
    // 忽略点击右上角视角切换按钮时的加速
    if ((e.target as HTMLElement).closest(".race-view-btns")) return;
    handleBoostTap(e.clientX, e.clientY);
  };

  const rankTitles = ["冠军【极限拟合】", "亚军【虽瘫犹荣】", "季军【医学奇迹】", "殿军【跑道太滑】"];
  const boostPercent = Math.round(boostRatio * 60);

  return (
    <div className="race-wrap" onPointerDown={onPointerDown}>
      <canvas ref={canvasRef} className="race-canvas" />
      {countdown && <div className="race-countdown">{countdown}</div>}

      <div className="race-view-btns">
        <button className={view === "third" ? "active" : ""} onClick={() => setView("third")}>俯瞰旁观视角</button>
        <button className={view === "first" ? "active" : ""} onClick={() => setView("first")}>第一人称视角 (V)</button>
      </div>

      {!countdown && !result && (
        <>
          <div className="race-tap-prompt">
            👆 快速疯狂连点屏幕 / 按空格 抽打马鞭加速！
          </div>
          <div className="race-boost-panel">
            <div className="race-boost-title">
              <span>🔥 挥鞭加速增益: +{boostPercent}%</span>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>(上限 +60%)</span>
            </div>
            <div className="race-boost-bar-wrap">
              <div className="race-boost-bar" style={{ width: `${Math.max(4, boostRatio * 100)}%` }} />
            </div>
            <div className="race-boost-stats">
              {boostRatio > 0.8 ? "⚡ 狂暴冲刺！" : boostRatio > 0.4 ? "💨 抽打加速中！" : "点击越快，抽得越狠，跑得越快！"}
            </div>
          </div>
        </>
      )}

      {whipPops.map(p => (
        <div key={p.id} className="race-whip-pop" style={{ left: p.x, top: p.y }}>
          {p.text}
        </div>
      ))}

      {result && (
        <div className="race-banner">
          <h2>竞速结算</h2>
          <p style={{ color: "#64748b", margin: "4px 0 14px", fontSize: "14px" }}>
            <b>{result.name}</b> 率先撞线，物理连杆动力学决胜！
          </p>
          <ol>
            {result.list.map((r, i) => (
              <li key={i}>{rankTitles[i] ?? `第 ${i + 1} 名`} {r.name} {r.time}</li>
            ))}
          </ol>
          {iAmHost && <button className="primary" onClick={playAgain}>重回大厅 (再来一局)</button>}
        </div>
      )}
    </div>
  );
}

