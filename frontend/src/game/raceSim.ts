// raceSim.ts —— 赛跑模拟的纯逻辑核心（可单测，无 DOM 依赖）：
// 每匹马速度由 computeMetrics 决定，位移确定性积分；名次按冲线时间/距离排名。
import { computeMetrics } from "./metrics";
import type { HorseModel } from "./types";

export const TRACK_LEN = 2600;            // 赛道长度（世界像素）
export const COLORS = ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"];

export interface Runner {
  id: string;
  name: string;
  model: HorseModel;
  color: string;
  speed: number;       // 像素/秒
  period: number;      // 步态周期（秒）
  x: number;
  phase: number;       // ∈ [0,1)
  finished: boolean;
  finishTime: number | null;
}

export interface RaceState {
  time: number;
  over: boolean;
  runners: Runner[];
}

export function createRace(entries: { id: string; name: string; model: HorseModel }[]): RaceState {
  return {
    time: 0,
    over: false,
    runners: entries.map((e, i) => {
      const m = computeMetrics(e.model);
      return {
        id: e.id, name: e.name, model: e.model,
        color: COLORS[i % COLORS.length],
        speed: m.speed, period: 1 / m.cadence,
        x: 0, phase: 0, finished: false, finishTime: null,
      };
    }),
  };
}

// 推进一帧。确定性：给定相同 entries 与相同 dt 序列，结果必然一致。
export function updateRace(state: RaceState, dt: number): RaceState {
  if (state.over) return state;
  const time = state.time + dt;
  let allDone = true;
  let leaderDone: number | null = null;
  const runners = state.runners.map(r => {
    if (r.finished) return r;
    const x = r.x + r.speed * dt;
    const phase = (r.phase + dt / r.period) % 1;
    const finished = x >= TRACK_LEN;
    return {
      ...r, x, phase,
      finished,
      finishTime: finished ? time : null,
    };
  });
  for (const r of runners) {
    if (r.finishTime != null) {
      if (leaderDone === null || r.finishTime < leaderDone) leaderDone = r.finishTime;
    }
    allDone = allDone && r.finished;
  }
  const over = allDone || (leaderDone !== null && time - leaderDone > 10);
  return { time, over, runners };
}

// 名次：冲线者按时间，未完赛者按距离
export function ranking(state: RaceState): Runner[] {
  return state.runners.slice().sort((a, b) => {
    if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
    if (a.finishTime != null) return -1;
    if (b.finishTime != null) return 1;
    return b.x - a.x;
  });
}
