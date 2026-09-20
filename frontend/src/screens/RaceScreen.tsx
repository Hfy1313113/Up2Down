// RaceScreen.tsx —— 赛跑/结算屏（three.js 版）：
// 真实 3D 场景消费 raceSim 状态（积分确定性在 raceSim，不在此处），
// 第三人称跟随相机 + 第一人称马儿视角（V 键/按钮切换）、3-2-1-GO、全屏连点加速抽鞭、名次结算、房主"再来一局"。
// 支持加速上限过载检测：若持续接近或达到加速上限，发出全屏快闪红色呼吸氛围灯警告并提醒“差不多得了，别太颠了！”；
// 超过连续 3 秒仍在上限时，小人颠飞下马出局，游戏失败。
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createRace,
  ranking,
  updateRace,
  applyTapBoost,
  setRunnerBoost,
  setRunnerBuckedOff,
  MAX_BOOST,
  DANGER_BOOST_THRESHOLD,
  type RaceState,
} from "../game/raceSim";
import { RaceScene, type ViewMode } from "../three/raceScene";
import { useGame, playAgain } from "../state/game";
import { transport } from "../net/transport";

interface WhipPop {
  id: number;
  x: number;
  y: number;
  text: string;
}

function playBuckedOffSound() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(450, t0);
    osc.frequency.linearRampToValueAtTime(820, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.55);
    gain.gain.setValueAtTime(0.35, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.62);
  } catch {}
}

export function RaceScreen({ demo = false }: { demo?: boolean }) {
  const g = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [result, setResult] = useState<{
    name: string;
    list: { name: string; time: string; failed?: boolean }[];
  } | null>(null);
  const [view, setView] = useState<ViewMode>("third");
  const viewRef = useRef(view);
  viewRef.current = view;
  const raceRef = useRef<RaceState | null>(null);
  const [boostRatio, setBoostRatio] = useState(0); // [0, 1]
  const [dangerSec, setDangerSec] = useState(0);
  const [buckedOff, setBuckedOff] = useState(false);
  const buckedOffSoundPlayed = useRef(false);
  const [whipPops, setWhipPops] = useState<WhipPop[]>([]);
  const popSeq = useRef(0);

  const iAmHost = demo || (g.host != null && g.host === g.myId);
  const myIndex = Math.max(0, g.horses?.findIndex(h => h.id === g.myId) ?? 0);
  const myRunnerId = (g.horses && g.horses[myIndex]?.id) || (g.horses && g.horses[0]?.id) || "default";

  // 连点加速与挥鞭逻辑
  const handleBoostTap = useCallback((clientX?: number, clientY?: number) => {
    if (countdown !== null || result !== null || !raceRef.current || raceRef.current.over) return;
    const meRunner = raceRef.current.runners.find(r => r.id === myRunnerId);
    if (meRunner?.buckedOff || meRunner?.failed) return;

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
      } else if (msg.t === "horse_bucked_off" && raceRef.current) {
        raceRef.current = setRunnerBuckedOff(raceRef.current, msg.id as string);
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
            if (idx !== myIndex && Math.random() < 0.45 && !r.buckedOff) {
              raceRef.current = applyTapBoost(raceRef.current!, r.id);
            }
          });
        }
      }

      raceRef.current = updateRace(raceRef.current!, dt);
      scene.render(raceRef.current, viewRef.current, dt);

      // 同步自身马匹状态（加速增益、上限过载与颠飞出局）
      const me = raceRef.current.runners.find(r => r.id === myRunnerId);
      if (me) {
        setBoostRatio((me.boost - 1.0) / (MAX_BOOST - 1.0));
        setDangerSec(me.dangerDuration);
        if (me.buckedOff) {
          if (!buckedOffSoundPlayed.current) {
            buckedOffSoundPlayed.current = true;
            setBuckedOff(true);
            playBuckedOffSound();
            transport.send({
              t: "horse_bucked_off",
              id: myRunnerId,
            });
          }
        }
      }

      if (raceRef.current.over) {
        const rank = ranking(raceRef.current);
        const winner = rank.find(r => !r.failed);
        setResult({
          name: winner ? winner.name : "无人完赛",
          list: rank.map(r => ({
            name: r.name,
            failed: r.failed,
            time: r.failed
              ? "（颠飞坠马 · 游戏失败）"
              : r.finishTime != null
              ? `（${r.finishTime.toFixed(1)} 秒）`
              : "（未完赛）",
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
  const currentRunner = raceRef.current?.runners.find(r => r.id === myRunnerId);
  const isDangerZone = dangerSec > 0.05 || (currentRunner ? currentRunner.boost >= DANGER_BOOST_THRESHOLD : boostRatio >= 0.92);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none touch-manipulation" onPointerDown={onPointerDown}>
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* 极速上限过载：全屏边缘快闪红色呼吸氛围灯警告 */}
      {isDangerZone && !buckedOff && !countdown && !result && (
        <div className="danger-ambient-pulse fixed inset-0 pointer-events-none z-25" />
      )}

      {countdown && (
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl sm:text-9xl font-black text-[#e2703a] drop-shadow-[0_4px_16px_rgba(255,255,255,0.9)] pointer-events-none animate-pulse">
          {countdown}
        </div>
      )}

      {/* 视角切换按钮组 */}
      <div className="race-view-btns absolute top-3 right-3 flex flex-wrap gap-1.5 sm:gap-2 z-20">
        <button
          className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold border-2 rounded-lg transition-all ${
            view === "third" ? "bg-[#e2703a] text-white border-[#233140]" : "bg-[#233140]/90 text-white border-white/80"
          }`}
          onClick={() => setView("third")}
        >
          俯瞰旁观
        </button>
        <button
          className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold border-2 rounded-lg transition-all ${
            view === "first" ? "bg-[#e2703a] text-white border-[#233140]" : "bg-[#233140]/90 text-white border-white/80"
          }`}
          onClick={() => setView("first")}
        >
          第一人称 (V)
        </button>
      </div>

      {/* 极速超载提醒横幅：差不多得了，别太颠了！ */}
      {isDangerZone && !buckedOff && !countdown && !result && (
        <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce w-[92vw] max-w-sm">
          <div className="bg-red-600/95 border-2 border-white text-white font-black text-sm sm:text-base px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.95)] flex items-center justify-center gap-1.5 text-center">
            <span className="text-lg">🚨</span>
            <span>差不多得了，别太颠了！</span>
          </div>
          <div className="mt-1 bg-black/85 text-amber-300 text-xs font-mono font-bold px-3 py-0.5 rounded-full border border-red-500/60 shadow">
            颠簸过载预警：{(Math.max(0, 3.0 - dangerSec)).toFixed(1)}s 后将被马儿颠飞！
          </div>
        </div>
      )}

      {/* 颠飞下马出局提示 */}
      {buckedOff && !result && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none bg-red-700/95 border-3 border-white text-white p-4 sm:p-6 rounded-2xl shadow-[0_0_40px_rgba(185,28,28,0.95)] text-center animate-bounce w-[92vw] max-w-sm">
          <div className="text-4xl mb-1">🏇💨💥</div>
          <div className="text-xl sm:text-2xl font-black text-amber-300">颠飞下马！游戏失败！</div>
          <div className="text-xs sm:text-sm text-slate-100 mt-1">马儿加速持续过载超过 3 秒，你已被狂颠甩飞下马！</div>
        </div>
      )}

      {!countdown && !result && (
        <>
          <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs sm:max-w-sm text-center text-xs sm:text-sm font-bold bg-black/65 text-white px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-xs border border-white/20 shadow-lg">
            👆 快速疯狂连点屏幕 / 按空格 抽打马鞭加速！
          </div>
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs sm:max-w-sm bg-slate-900/90 border-2 border-amber-500 rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center gap-1.5 shadow-2xl pointer-events-none z-20 backdrop-blur-xs">
            <div className="text-amber-400 text-xs sm:text-sm font-extrabold flex items-center justify-between w-full px-1">
              <span>🔥 挥鞭加速: +{boostPercent}%</span>
              <span className="text-[11px] text-slate-400 font-normal">(上限 +60%)</span>
            </div>
            <div className="w-full h-3 sm:h-3.5 bg-slate-800 rounded-full overflow-hidden border border-white/30">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.max(4, boostRatio * 100)}%`,
                  background: isDangerZone
                    ? "linear-gradient(90deg, #f59e0b, #ef4444, #b91c1c)"
                    : "linear-gradient(90deg, #f59e0b, #ef4444, #ec4899)",
                }}
              />
            </div>
            <div className="text-[11px] sm:text-xs text-slate-300 font-bold">
              {buckedOff
                ? "💥 已颠飞下马出局！"
                : isDangerZone
                ? "⚠️ 严重颠簸！即将被颠飞！"
                : boostRatio > 0.8
                ? "⚡ 狂暴冲刺！"
                : boostRatio > 0.4
                ? "💨 抽打加速中！"
                : "连点越快，抽得越狠，跑得越快！"}
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
        <div className="race-banner absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-white border-3 border-[#233140] rounded-2xl p-5 sm:p-7 shadow-[8px_8px_0_rgba(35,49,64,0.95)] text-center z-40 max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-[#233140] mb-2">竞速结算</h2>
          <p className="text-slate-600 text-xs sm:text-sm mb-3">
            {result.name !== "无人完赛" ? (
              <>
                <b className="text-[#e2703a] font-black">{result.name}</b> 率先撞线，物理连杆动力学决胜！
              </>
            ) : (
              <span className="text-red-600 font-bold">全员颠飞下马，无人生还！</span>
            )}
          </p>
          <ol className="list-none p-0 my-3 flex flex-col gap-2 text-left">
            {result.list.map((r, i) => (
              <li
                key={i}
                className={`py-2 px-3 rounded-lg border-b border-dashed border-slate-200 text-xs sm:text-sm font-semibold flex items-center justify-between ${
                  r.failed ? "bg-red-50 text-red-700 border-red-200" : "text-slate-800"
                }`}
              >
                <span>
                  {r.failed ? "【颠飞坠马】" : (rankTitles[i] ?? `第 ${i + 1} 名`)} {r.name}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {r.time}
                </span>
              </li>
            ))}
          </ol>
          {iAmHost && (
            <button
              onClick={playAgain}
              className="primary w-full py-2.5 sm:py-3 px-4 rounded-lg border-2 border-[#233140] bg-[#2ea043] hover:bg-[#278839] text-white font-bold text-sm sm:text-base shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all mt-2"
            >
              重回大厅 (再来一局)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

