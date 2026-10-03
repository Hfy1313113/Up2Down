// RaceScreen.tsx —— 赛跑/结算屏（three.js 版）：
// 真实 3D 场景消费 raceSim 状态（积分确定性在 raceSim，不在此处），
// 第三人称跟随相机 + 第一人称象背视角（V 键/按钮切换）、3-2-1-抽、全屏连点挥鞭、名次结算、房主"再来一局"。
// 加速上限过载检测：持续贴近上限时全屏红色呼吸灯警告「差不多得了，别太抽了！」；
// 连续 3 秒仍在上限则驭象师被甩下象背出局。
// 正赛背景音乐、倒数/挥鞭/出局/结算音效全部来自当前风格包。
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
import { RaceScene, pipLayout, type PipRect, type ViewMode } from "../three/raceScene";
import { useGame, playAgain } from "../state/game";
import { transport } from "../net/transport";
import { getPack } from "../style/registry";
import { playSfx } from "../audio/sfx";
import { music } from "../audio/music";
import { AudioToggle } from "./AudioToggle";

interface WhipPop {
  id: number;
  x: number;
  y: number;
  text: string;
}

/** 结算名次条目（房主经 race_result 广播的权威名次，各端据此渲染同一份结果） */
interface RankEntry {
  id: string;
  name: string;
  failed: boolean;
  finishTime: number | null;
}

// 非房主本地模拟结束后最多等待房主权威结算的时长；超时（房主掉线等）则用本地名次兜底
const RESULT_WAIT_MS = 8000;
/** 结算弹出后「再来一局」按钮的锁定秒数 */
const AGAIN_LOCK_SECONDS = 3;

const WHIP_TEXTS = ["抽！象！💥", "快象加鞭！🐘", "象前冲！⚡", "万象更新！✨", "抽象起来！🔥", "具象化加速！💨"];
const RANK_TITLES = ["冠军【抽象派大师】", "亚军【印象派】", "季军【具象派】", "殿军【盲人摸象】"];

export function RaceScreen({ demo = false }: { demo?: boolean }) {
  const g = useGame();
  const pack = getPack(g.styleId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [result, setResult] = useState<{
    name: string;
    crossed: boolean;
    list: { name: string; time: string; failed?: boolean }[];
  } | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [awaitingHost, setAwaitingHost] = useState(false);
  // 结算弹出后「再来一局」锁定 3 秒：玩家此前一直在连点加速，手指停不下来，防止误触直接跳走
  const [againLock, setAgainLock] = useState(0);
  const spectatingRef = useRef(false);
  const resultShownRef = useRef(false);
  const [view, setView] = useState<ViewMode>("third");
  const viewRef = useRef(view);
  viewRef.current = view;
  const raceRef = useRef<RaceState | null>(null);
  const [boostRatio, setBoostRatio] = useState(0);
  const [whip, setWhip] = useState(0);
  const [pip, setPip] = useState<PipRect>(() => pipLayout(window.innerWidth, window.innerHeight));
  const [dangerSec, setDangerSec] = useState(0);
  const [buckedOff, setBuckedOff] = useState(false);
  const buckedOffSoundPlayed = useRef(false);
  const [whipPops, setWhipPops] = useState<WhipPop[]>([]);
  const popSeq = useRef(0);
  const lastTrumpet = useRef(0);

  const iAmHost = demo || (g.host != null && g.host === g.myId);
  const hostRef = useRef(iAmHost);
  hostRef.current = iAmHost;
  const hostIdRef = useRef(g.host);
  hostIdRef.current = g.host;
  const myIndex = Math.max(0, g.elephants?.findIndex(h => h.id === g.myId) ?? 0);
  const myRunnerId = (g.elephants && g.elephants[myIndex]?.id) || (g.elephants && g.elephants[0]?.id) || "default";

  // 结算只展示一次：房主用本地名次并广播；非房主优先使用房主广播的权威名次
  useEffect(() => {
    if (againLock <= 0) return;
    const t = setTimeout(() => setAgainLock(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [againLock]);

  const showResult = useCallback((rank: RankEntry[]) => {
    if (resultShownRef.current) return;
    resultShownRef.current = true;
    setAwaitingHost(false);
    setAgainLock(AGAIN_LOCK_SECONDS);
    playSfx("blast");
    music.duck(0.35);
    const winner = rank.find(r => !r.failed);
    setResult({
      name: winner ? winner.name : "无人完赛",
      crossed: !!winner && winner.finishTime != null,
      list: rank.map(r => ({
        name: r.name,
        failed: r.failed,
        time: r.failed
          ? "（甩下象背 · 象征性出局）"
          : r.finishTime != null
          ? `（${r.finishTime.toFixed(1)} 秒）`
          : "（未完赛）",
      })),
    });
  }, []);

  // 连点加速与挥鞭逻辑：同时支持点击屏幕与键盘空格
  const handleBoostTap = useCallback((clientX?: number, clientY?: number) => {
    if (countdown !== null || result !== null || !raceRef.current || raceRef.current.over) return;
    const meRunner = raceRef.current.runners.find(r => r.id === myRunnerId);
    if (meRunner?.buckedOff || meRunner?.failed) return;

    playSfx("whip");
    raceRef.current = applyTapBoost(raceRef.current, myRunnerId);

    const me = raceRef.current.runners.find(r => r.id === myRunnerId);
    if (me) {
      setBoostRatio((me.boost - 1.0) / (MAX_BOOST - 1.0));
      // 抽得够猛时大象扬鼻长鸣（节流 1.6s）
      if (me.boost >= 1.4 && performance.now() - lastTrumpet.current > 1600) {
        lastTrumpet.current = performance.now();
        playSfx("trumpet", 0.7);
      }
      transport.send({
        t: "elephant_boost",
        id: myRunnerId,
        boost: me.boost,
        whip: me.whipIntensity,
      });
    }

    const x = clientX ?? (window.innerWidth / 2 + (Math.random() - 0.5) * 80);
    const y = clientY ?? (window.innerHeight * 0.52 + (Math.random() - 0.5) * 60);
    const id = ++popSeq.current;
    const text = WHIP_TEXTS[id % WHIP_TEXTS.length];
    setWhipPops(p => [...p.slice(-4), { id, x, y, text }]);
    setTimeout(() => {
      setWhipPops(p => p.filter(item => item.id !== id));
    }, 500);
  }, [countdown, result, myRunnerId]);

  useEffect(() => {
    const unsub = transport.on((msg) => {
      // `_from` 由传输层按到达通道标注：加速/出局只接受本人发出，结算只接受房主发出
      const self = msg._from == null || msg._from === msg.id;
      if (msg.t === "elephant_boost" && raceRef.current && self) {
        raceRef.current = setRunnerBoost(raceRef.current, msg.id as string, msg.boost as number, msg.whip as number);
      } else if (msg.t === "elephant_bucked_off" && raceRef.current && self) {
        raceRef.current = setRunnerBuckedOff(raceRef.current, msg.id as string);
      } else if (msg.t === "race_result" && Array.isArray(msg.rank)) {
        if (msg._from != null && msg._from !== hostIdRef.current) return;
        showResult(msg.rank as RankEntry[]);
      }
    });
    return unsub;
  }, [showResult]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const list = (g.elephants ?? []).map(h => ({ id: h.id, name: h.name, model: h.model }));
    const scene = new RaceScene(canvas, list, myIndex, pack);
    const onResize = () => { scene.resize(); setPip(pipLayout(window.innerWidth, window.innerHeight)); };
    window.addEventListener("resize", onResize);
    onResize();

    const race = createRace(list.map(l => ({ id: l.id, name: l.name, model: l.model })));
    raceRef.current = race;

    // 正赛背景音乐：倒数一开始就起播
    void music.play(pack.music.race, `${pack.id}:race`);
    music.duck(1);

    let raf = 0;
    let last = 0;
    let cancelled = false;
    let demoAiTimer = 0;
    let localOverAt: number | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const frame = (now: number) => {
      if (cancelled) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      // 开发态 demo 模式下给 AI 大象注入微加速，呈现动态对抗
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

      const me = raceRef.current.runners.find(r => r.id === myRunnerId);
      if (me) {
        setBoostRatio((me.boost - 1.0) / (MAX_BOOST - 1.0));
        setWhip(me.whipIntensity);
        setDangerSec(me.dangerDuration);
        if (me.buckedOff && !buckedOffSoundPlayed.current) {
          buckedOffSoundPlayed.current = true;
          setBuckedOff(true);
          playSfx("buckedOff");
          music.duck(0.45);
          transport.send({ t: "elephant_bucked_off", id: myRunnerId });
        }
      }

      if (me?.buckedOff && me.interactionTimer <= 0 && !spectatingRef.current) {
        spectatingRef.current = true;
        setSpectating(true);
      }

      if (resultShownRef.current) return;

      if (raceRef.current.over) {
        if (hostRef.current) {
          const rank: RankEntry[] = ranking(raceRef.current).map(r => ({
            id: r.id, name: r.name, failed: r.failed, finishTime: r.finishTime,
          }));
          transport.send({ t: "race_result", rank });
          showResult(rank);
          return;
        }
        if (localOverAt == null) {
          localOverAt = now;
          setAwaitingHost(true);
        } else if (now - localOverAt > RESULT_WAIT_MS) {
          showResult(ranking(raceRef.current).map(r => ({
            id: r.id, name: r.name, failed: r.failed, finishTime: r.finishTime,
          })));
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const seq = ["3", "2", "1", "抽！"];
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i < seq.length) {
        setCountdown(seq[i]);
        playSfx(i === seq.length - 1 ? "go" : "countdown");
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
      music.duck(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        setView(v => v === "first" ? "third" : "first");
      } else if (e.code === "Space" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handleBoostTap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleBoostTap]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest(".race-view-btns") || el.closest(".race-banner") || el.closest(".audio-toggle")) return;
    handleBoostTap(e.clientX, e.clientY);
  };

  const boostPercent = Math.round(boostRatio * 60);
  const currentRunner = raceRef.current?.runners.find(r => r.id === myRunnerId);
  const isDangerZone = dangerSec > 0.05 || (currentRunner ? currentRunner.boost >= DANGER_BOOST_THRESHOLD : boostRatio >= 0.92);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none touch-manipulation" onPointerDown={onPointerDown}>
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* 面部直播画中画：3D 画面由 RaceScene 以剪裁视口渲染到同一画布，这里只叠边框、标签与随挥鞭力度加深的红色暗角 */}
      {!countdown && !result && !spectating && (
        <div
          className="race-pip absolute z-20 pointer-events-none"
          style={{ left: pip.x, bottom: pip.y, width: pip.w, height: pip.h }}
        >
          <div
            className="absolute inset-0 rounded-md"
            style={{ background: `radial-gradient(ellipse at center, transparent ${Math.round(62 - 22 * whip)}%, rgba(220,38,38,${(0.08 + 0.55 * whip).toFixed(2)}) 100%)` }}
          />
          <div
            className="absolute -inset-0.5 rounded-lg border-3 border-(--ui-ink) shadow-[3px_3px_0_var(--ui-ink)]"
            style={{ boxShadow: `3px 3px 0 var(--ui-ink), inset 0 0 ${Math.round(6 + 30 * whip)}px rgba(239,68,68,${(0.15 + 0.7 * whip).toFixed(2)})` }}
          />
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/75 text-white text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded">
            <span className="bg-red-600 text-white px-1 rounded font-mono animate-pulse">LIVE</span>
            <span>{buckedOff ? "驭象师升天实况" : whip > 0.7 ? "驭象师·狰狞中" : whip > 0.2 ? "驭象师·使劲抽" : "驭象师面部直播"}</span>
          </div>
        </div>
      )}

      {isDangerZone && !buckedOff && !countdown && !result && (
        <div className="danger-ambient-pulse fixed inset-0 pointer-events-none z-25" />
      )}

      {countdown && (
        <div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex items-center justify-center w-full px-4">
          <div className="text-6xl sm:text-8xl md:text-9xl font-black text-(--ui-accent) whitespace-nowrap select-none text-center leading-none tracking-wider drop-shadow-[0_6px_24px_rgba(255,255,255,0.98)] animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* 左上：音频开关 */}
      <div className="absolute top-3 left-3 z-20">
        <AudioToggle compact />
      </div>

      {!buckedOff && (
        <div className="race-view-btns absolute top-3 right-3 flex flex-wrap gap-1.5 sm:gap-2 z-20">
          <button
            className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold border-2 rounded-lg transition-all ${
              view === "third" ? "bg-(--ui-accent) text-white border-(--ui-ink)" : "bg-(--ui-ink)/90 text-white border-white/80"
            }`}
            onClick={() => setView("third")}
          >
            俯瞰旁观
          </button>
          <button
            className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-bold border-2 rounded-lg transition-all ${
              view === "first" ? "bg-(--ui-accent) text-white border-(--ui-ink)" : "bg-(--ui-ink)/90 text-white border-white/80"
            }`}
            onClick={() => setView("first")}
          >
            象背视角 (V)
          </button>
        </div>
      )}

      {isDangerZone && !buckedOff && !countdown && !result && (
        <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce w-[92vw] max-w-sm">
          <div className="bg-red-600/95 border-2 border-white text-white font-black text-sm sm:text-base px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.95)] flex items-center justify-center gap-1.5 text-center">
            <span className="text-lg">🚨</span>
            <span>差不多得了，别太抽了！</span>
          </div>
          <div className="mt-1 bg-black/85 text-amber-300 text-xs font-mono font-bold px-3 py-0.5 rounded-full border border-red-500/60 shadow">
            过载预警：{(Math.max(0, 3.0 - dangerSec)).toFixed(1)}s 后将被大象甩下象背！
          </div>
        </div>
      )}

      {!result && (spectating || awaitingHost) && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92vw] max-w-xs text-center">
          <div className="inline-block bg-slate-900/90 border-2 border-amber-400 text-amber-200 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl shadow-xl">
            {awaitingHost ? "全场完赛，等待房主结算…" : "你已象征性出局 · 观战中，等待全场完赛"}
          </div>
        </div>
      )}

      {buckedOff && !spectating && !result && (
        <>
          <div className="buckoff-comic-overlay fixed inset-0 pointer-events-none z-20" />
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1 w-[92vw] max-w-xs">
            <div className="bg-slate-900/95 border-2 border-amber-400 text-amber-300 text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
              <span className="text-base">🎥</span>
              <span>第二人称象视角</span>
              <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">REC</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-100 bg-black/80 border border-white/20 px-3 py-1 rounded-full shadow text-center">
              大象回眸扬鼻：我就静静看着你螺旋升天…
            </div>
          </div>
          <div className="absolute bottom-5 left-3 sm:left-6 z-30 pointer-events-none bg-red-700/95 border-3 border-white text-white p-3 sm:p-4 rounded-2xl shadow-[0_0_40px_rgba(185,28,28,0.95)] text-center animate-bounce w-[80vw] max-w-xs">
            <div className="text-4xl mb-1">🐘💨💫</div>
            <div className="text-xl sm:text-2xl font-black text-amber-300">甩下象背！抽得太狠了！</div>
            <div className="text-xs sm:text-sm text-slate-100 mt-1">大象第二人称回眸：四肢狂暴大风车，彻底飞出抽象派！</div>
          </div>
        </>
      )}

      {!countdown && !result && !buckedOff && (
        <>
          <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs sm:max-w-sm text-center text-xs sm:text-sm font-bold bg-black/65 text-white px-3.5 py-1.5 rounded-full pointer-events-none backdrop-blur-xs border border-white/20 shadow-lg">
            👆 连续点击屏幕 或 敲击空格 挥鞭抽象加速！
          </div>
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 w-[92vw] max-w-xs sm:max-w-sm bg-slate-900/90 border-2 border-amber-500 rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center gap-1.5 shadow-2xl pointer-events-none z-20 backdrop-blur-xs">
            <div className="text-amber-400 text-xs sm:text-sm font-extrabold flex items-center justify-between w-full px-1">
              <span>🔥 抽象加速: +{boostPercent}%</span>
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
              {isDangerZone
                ? "⚠️ 抽得太狠！即将被甩下象背！"
                : boostRatio > 0.8
                ? "⚡ 狂暴冲刺！象鼻朝天！"
                : boostRatio > 0.4
                ? "💨 抽象加速中！"
                : "连点越快，抽得越狠，象跑得越快！"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm pointer-events-auto overflow-hidden">
          <div className="banner-blast-shockwave absolute w-64 h-64 rounded-full border-4 border-amber-400 pointer-events-none" />
          <div className="banner-blast-shockwave absolute w-48 h-48 rounded-full border-2 border-red-500 pointer-events-none" />

          <div className="race-banner animate-banner-blast w-full max-w-sm sm:max-w-md bg-(--ui-paper) border-4 border-(--ui-ink) rounded-2xl p-4 sm:p-7 shadow-[10px_10px_0_var(--ui-ink)] text-center max-h-[90vh] overflow-y-auto relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black text-(--ui-ink) mb-2 flex items-center justify-center gap-2">
              <span>💥</span>
              <span>抽象结算</span>
              <span>💥</span>
            </h2>
            <p className="text-(--ui-ink) opacity-80 text-xs sm:text-sm mb-3">
              {result.name !== "无人完赛" ? (
                <>
                  <b className="text-(--ui-accent) font-black">{result.name}</b>
                  {result.crossed ? " 率先撞线，抽象派连杆动力学决胜！" : " 跑得最远，按距离判定夺冠！"}
                </>
              ) : (
                <span className="text-red-600 font-bold">全员甩下象背，无人生还，抽象到家！</span>
              )}
            </p>
            <ol className="list-none p-0 my-3 flex flex-col gap-2 text-left">
              {result.list.map((r, i) => (
                <li
                  key={i}
                  className={`py-2 px-3 rounded-lg border-b border-dashed border-(--ui-ink)/20 text-xs sm:text-sm font-semibold flex items-center justify-between ${
                    r.failed ? "bg-red-50 text-red-700 border-red-200" : "text-(--ui-ink)"
                  }`}
                >
                  <span>
                    {r.failed ? "【象征性出局】" : (RANK_TITLES[i] ?? `第 ${i + 1} 名`)} {r.name}
                  </span>
                  <span className="text-xs font-mono opacity-70">
                    {r.time}
                  </span>
                </li>
              ))}
            </ol>
            {iAmHost && (
              <button
                disabled={againLock > 0}
                onClick={() => { if (againLock > 0) return; playSfx("uiTap"); playAgain(); }}
                className="primary w-full py-2.5 sm:py-3 px-4 rounded-lg border-2 border-(--ui-ink) bg-(--ui-go) hover:bg-(--ui-go-hover) text-white font-bold text-sm sm:text-base shadow-[3px_3px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 disabled:shadow-[2px_2px_0_#94a3b8] disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 transition-all mt-2"
              >
                {againLock > 0 ? `先看看结算… (${againLock}s)` : "重回象限 (再来一局)"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
