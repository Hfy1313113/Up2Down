// raceSim.ts —— 赛跑模拟的纯逻辑核心（可单测，无 DOM 依赖）：
// 每匹马速度由 computeMetrics 决定，位移确定性积分；名次按冲线时间/距离排名。
// 支持用户连点屏幕加速（带上限）、物理交互（拌腿、冲撞、美式截停、创飞）。
import { computeMetrics } from "./metrics";
import type { HorseModel } from "./types";

export const TRACK_LEN = 2600;            // 赛道长度（世界像素）
export const COLORS = ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"];

export const MAX_BOOST = 1.6;             // 最高加速倍率 (+60%)
export const BOOST_DECAY = 1.8;           // 连点增益每秒自然衰减
export const TAP_IMPULSE = 0.35;          // 单次点击激发的加速脉冲
export const MAX_TAP_INTENSITY = 2.5;     // 连点强度上限
export const DANGER_BOOST_THRESHOLD = 1.55; // 接近或等于加速上限的预警阈值
export const BUCK_OFF_TIME = 3.0;          // 维持在上限连续超过 3 秒颠飞下马

export type InteractionType = "bump" | "trip" | "pit" | "launch";

export interface Runner {
  id: string;
  name: string;
  model: HorseModel;
  color: string;
  speed: number;            // 基础像素/秒
  effectiveSpeed: number;   // 结合加速与物理阻尼后的实际速度
  period: number;           // 步态周期（秒）
  x: number;
  baseZ: number;            // 预设基准赛道位置
  z: number;                // 实际横向世界坐标
  vz: number;               // 横向速度
  y: number;                // 垂直弹跳/创飞高度
  vy: number;               // 垂直速度
  rotX: number;             // 俯仰角偏移（前倾绊倒）
  rotY: number;             // 航向角偏移（美式截停打转甩尾）
  rotZ: number;             // 滚转角偏移（冲撞侧倾/空中翻滚）
  boost: number;            // 当前加速倍率 [1.0, MAX_BOOST]
  tapIntensity: number;     // 连点激烈程度 (0 ~ MAX_TAP_INTENSITY)
  whipIntensity: number;    // 挥鞭强度 (0 ~ 1.0)
  dangerDuration: number;   // 维持在加速上限附近的连续时长（秒）
  buckedOff: boolean;       // 是否被马儿颠飞下马
  failed: boolean;          // 该玩家是否已游戏失败
  riderFlyX: number;        // 骑手被颠飞脱离后的相对纵向位移
  riderFlyY: number;        // 骑手被颠飞脱离后的相对垂直位移
  riderFlyZ: number;        // 骑手被颠飞脱离后的相对横向位移
  riderFlyRot: number;      // 骑手空中翻滚角
  stumbleTimer: number;     // 拌腿硬直剩余时间
  spinTimer: number;        // 美式截停打转硬直
  launchedTimer: number;    // 被创飞浮空状态
  cooldownTimer: number;    // 碰撞免疫冷却时间
  interactionText: string | null;  // 碰撞浮动文案（"创飞！", "美式截停！", 等）
  interactionTimer: number;
  phase: number;            // ∈ [0,1)
  finished: boolean;
  finishTime: number | null;
}

export interface RaceState {
  time: number;
  over: boolean;
  runners: Runner[];
}

export function createRace(entries: { id: string; name: string; model: HorseModel }[]): RaceState {
  const count = entries.length;
  return {
    time: 0,
    over: false,
    runners: entries.map((e, i) => {
      const m = computeMetrics(e.model);
      const baseZ = (i - (count - 1) / 2) * 4;
      return {
        id: e.id, name: e.name, model: e.model,
        color: COLORS[i % COLORS.length],
        speed: m.speed,
        effectiveSpeed: m.speed,
        period: 1 / m.cadence,
        x: 0,
        baseZ,
        z: baseZ,
        vz: 0,
        y: 0,
        vy: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        boost: 1.0,
        tapIntensity: 0,
        whipIntensity: 0,
        dangerDuration: 0,
        buckedOff: false,
        failed: false,
        riderFlyX: 0,
        riderFlyY: 0,
        riderFlyZ: 0,
        riderFlyRot: 0,
        stumbleTimer: 0,
        spinTimer: 0,
        launchedTimer: 0,
        cooldownTimer: 0,
        interactionText: null,
        interactionTimer: 0,
        phase: 0,
        finished: false,
        finishTime: null,
      };
    }),
  };
}

// 玩家点击屏幕或按下空格：注入连点冲量
export function applyTapBoost(state: RaceState, runnerId: string): RaceState {
  const runners = state.runners.map(r => {
    if (r.id !== runnerId || r.finished || r.buckedOff || r.failed) return r;
    const newIntensity = Math.min(MAX_TAP_INTENSITY, r.tapIntensity + TAP_IMPULSE);
    const boost = 1.0 + Math.min(MAX_BOOST - 1.0, newIntensity * 0.25);
    const whipIntensity = Math.min(1.0, newIntensity / 1.4);
    return {
      ...r,
      tapIntensity: newIntensity,
      boost,
      whipIntensity,
    };
  });
  return { ...state, runners };
}

// 网络同步其他玩家的 boost 与颠飞状态
export function setRunnerBoost(
  state: RaceState,
  runnerId: string,
  boost: number,
  whipIntensity?: number,
  buckedOff?: boolean
): RaceState {
  const runners = state.runners.map(r => {
    if (r.id !== runnerId) return r;
    if (buckedOff || r.buckedOff || r.failed) {
      return {
        ...r,
        buckedOff: true,
        failed: true,
        boost: 1.0,
        tapIntensity: 0,
        whipIntensity: 0,
        effectiveSpeed: 0,
      };
    }
    const clampedBoost = Math.max(1.0, Math.min(MAX_BOOST, boost));
    return {
      ...r,
      boost: clampedBoost,
      whipIntensity: whipIntensity ?? Math.min(1.0, (clampedBoost - 1.0) / (MAX_BOOST - 1.0)),
    };
  });
  return { ...state, runners };
}

export function setRunnerBuckedOff(state: RaceState, runnerId: string): RaceState {
  const runners = state.runners.map(r => {
    if (r.id !== runnerId || r.buckedOff) return r;
    return {
      ...r,
      buckedOff: true,
      failed: true,
      boost: 1.0,
      tapIntensity: 0,
      whipIntensity: 0,
      dangerDuration: 0,
      effectiveSpeed: 0,
      interactionText: "颠飞下马！💥",
      interactionTimer: 4.0,
      riderFlyY: 0.5,
      riderFlyRot: 0.5,
    };
  });
  return { ...state, runners };
}

// 推进一帧。
export function updateRace(state: RaceState, dt: number): RaceState {
  if (state.over) return state;
  const time = state.time + dt;
  let allDone = true;
  let leaderDone: number | null = null;

  // 1. 各 runner 动力学、连点衰减、上限判定与阻尼更新
  let runners = state.runners.map(r => {
    if (r.finished) return r;

    // 若已经颠飞坠马失败，则马匹迅速减速滑停，骑手继续翻滚抛飞升天
    if (r.buckedOff || r.failed) {
      const riderFlyY = Math.min(35, r.riderFlyY + (20 - r.riderFlyY * 0.3) * dt);
      const riderFlyX = r.riderFlyX + (12 + r.riderFlyX * 0.3) * dt;
      const riderFlyRot = r.riderFlyRot + 16 * dt;
      const effectiveSpeed = Math.max(0, r.effectiveSpeed - 180 * dt);
      const x = r.x + effectiveSpeed * dt;
      const phase = (r.phase + (effectiveSpeed / Math.max(1, r.speed)) * (dt / r.period)) % 1;
      const interactionTimer = Math.max(0, r.interactionTimer - dt);
      let interactionText = r.interactionText;
      if (interactionTimer > 2.8) interactionText = "颠飞下马！💥";
      else if (interactionTimer > 1.5) interactionText = "大风车翻滚！🌪️";
      else if (interactionTimer > 0) interactionText = "化作流星！✨";
      else interactionText = null;
      return {
        ...r,
        effectiveSpeed,
        x,
        phase,
        boost: 1.0,
        tapIntensity: 0,
        whipIntensity: 0,
        dangerDuration: 0,
        buckedOff: true,
        failed: true,
        riderFlyX,
        riderFlyY,
        riderFlyRot,
        interactionTimer,
        interactionText,
        finished: false,
        finishTime: null,
      };
    }

    // 衰减连点强度与计算当前加速
    const tapIntensity = Math.max(0, r.tapIntensity - BOOST_DECAY * dt);
    const calculatedBoost = 1.0 + Math.min(MAX_BOOST - 1.0, tapIntensity * 0.25);
    const boost = Math.max(r.boost > 1.0 ? Math.max(1.0, r.boost - (BOOST_DECAY * 0.25) * dt) : 1.0, calculatedBoost);
    const whipIntensity = Math.max(0, r.whipIntensity - BOOST_DECAY * 0.8 * dt);

    // 维持在接近或等于加速上限的连续时长检测 (≥ 3 秒则颠飞下马出局)
    let dangerDuration = r.dangerDuration;
    let buckedOff = false;
    let failed = false;
    let riderFlyX = r.riderFlyX;
    let riderFlyY = r.riderFlyY;
    let riderFlyRot = r.riderFlyRot;

    // 碰撞/交互计时器递减
    const stumbleTimer = Math.max(0, r.stumbleTimer - dt);
    const spinTimer = Math.max(0, r.spinTimer - dt);
    const launchedTimer = Math.max(0, r.launchedTimer - dt);
    const cooldownTimer = Math.max(0, r.cooldownTimer - dt);
    const interactionTimer = Math.max(0, r.interactionTimer - dt);
    let interactionText = interactionTimer > 0 ? r.interactionText : null;

    if (boost >= DANGER_BOOST_THRESHOLD) {
      dangerDuration += dt;
      if (dangerDuration >= BUCK_OFF_TIME) {
        buckedOff = true;
        failed = true;
        interactionText = "颠飞下马！💥";
        riderFlyY = 0.6;
        riderFlyRot = 0.6;
      }
    } else {
      dangerDuration = 0;
    }

    // 计算物理状态对速度的减速惩罚
    let penalty = 1.0;
    if (stumbleTimer > 0) penalty *= 0.55;    // 绊腿失速
    if (spinTimer > 0) penalty *= 0.35;       // 美式截停打转失速
    if (launchedTimer > 0) penalty *= 0.25;   // 空中创飞失速

    const effectiveSpeed = buckedOff ? 0 : r.speed * boost * penalty;
    const x = r.x + effectiveSpeed * dt;
    const phase = (r.phase + (effectiveSpeed / Math.max(1, r.speed)) * (dt / r.period)) % 1;
    const finished = !buckedOff && x >= TRACK_LEN;

    // 横向弹簧恢复力（往 baseZ 回归）
    const spring = (r.baseZ - r.z) * 3.5;
    let vz = (r.vz + spring * dt) * Math.max(0, 1 - 4 * dt);
    let z = r.z + vz * dt;

    // 垂直抛射物理（创飞弹跳）
    let y = r.y;
    let vy = r.vy;
    if (y > 0 || vy !== 0) {
      vy -= 26 * dt; // 重力加速度
      y += vy * dt;
      if (y <= 0) {
        y = 0;
        vy = 0;
      }
    }

    // 旋转物理衰减（恢复平衡）
    let rotX = r.rotX;
    let rotY = r.rotY;
    let rotZ = r.rotZ;

    if (stumbleTimer > 0) {
      rotX = 0.45 * Math.sin(stumbleTimer * 10);
    } else {
      rotX *= Math.max(0, 1 - 6 * dt);
    }

    if (spinTimer > 0) {
      rotY += (spinTimer > 0.4 ? 12 : 6) * dt;
    } else {
      rotY *= Math.max(0, 1 - 6 * dt);
    }

    if (launchedTimer > 0) {
      rotZ += 8 * dt;
    } else {
      rotZ *= Math.max(0, 1 - 6 * dt);
    }

    return {
      ...r,
      tapIntensity,
      boost,
      whipIntensity,
      dangerDuration,
      buckedOff,
      failed,
      riderFlyX,
      riderFlyY,
      riderFlyRot,
      stumbleTimer,
      spinTimer,
      launchedTimer,
      cooldownTimer,
      interactionText,
      interactionTimer: buckedOff ? 4.0 : interactionTimer,
      effectiveSpeed,
      x,
      z,
      vz,
      y,
      vy,
      rotX,
      rotY,
      rotZ,
      phase,
      finished,
      finishTime: finished ? time : null,
    };
  });

  // 2. 两两马匹间的物理交互检测（冲撞、拌腿、美式截停、创飞）
  const len = runners.length;
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      const rA = runners[i];
      const rB = runners[j];
      if (rA.finished || rB.finished || rA.failed || rB.failed) continue;

      const dx = rA.x - rB.x;
      const dz = rA.z - rB.z;
      const absDx = Math.abs(dx);
      const absDz = Math.abs(dz);

      // 横向距离足够接近，且前后身位相交
      if (absDz < 3.0 && absDx < 38) {
        // 判断是否处于冷却期
        if (rA.cooldownTimer <= 0 && rB.cooldownTimer <= 0) {
          const rearRunner = dx < 0 ? rA : rB;
          const frontRunner = dx < 0 ? rB : rA;
          const relSpeed = rearRunner.effectiveSpeed - frontRunner.effectiveSpeed;

          // 场景 1：创飞 (High-speed ram from behind -> Sent Flying!)
          if (relSpeed > 45 && absDz < 2.0 && absDx > 10 && absDx < 35) {
            frontRunner.vy = 13;
            frontRunner.y = 0.5;
            frontRunner.launchedTimer = 1.1;
            frontRunner.vz = (Math.random() - 0.5) * 6;
            frontRunner.cooldownTimer = 2.0;
            frontRunner.interactionText = "创飞！💥";
            frontRunner.interactionTimer = 1.2;

            rearRunner.vz = (rearRunner.z > frontRunner.z ? 1 : -1) * 3;
            rearRunner.cooldownTimer = 1.5;
            rearRunner.interactionText = "大创特创！⚡";
            rearRunner.interactionTimer = 0.8;
          }
          // 场景 2：美式截停 (PIT Maneuver - rear quarter contact causes spinout)
          else if (absDx >= 14 && absDx <= 32 && absDz < 2.4) {
            const victim = rearRunner;
            victim.spinTimer = 1.0;
            victim.vz = (dz > 0 ? -4 : 4);
            victim.cooldownTimer = 2.0;
            victim.interactionText = "美式截停！🚨";
            victim.interactionTimer = 1.1;

            const interceptor = frontRunner;
            interceptor.cooldownTimer = 1.5;
            interceptor.interactionText = "截停得手！🎯";
            interceptor.interactionTimer = 0.8;
          }
          // 场景 3：拌腿 (Tangled legs / trip when running close and overlap)
          else if (absDx < 16 && absDz < 2.0 && frontRunner.y === 0 && rearRunner.y === 0) {
            rearRunner.stumbleTimer = 0.85;
            rearRunner.rotX = 0.5;
            rearRunner.cooldownTimer = 1.8;
            rearRunner.interactionText = "绊腿了！💫";
            rearRunner.interactionTimer = 1.0;

            frontRunner.vz = (dz > 0 ? 3 : -3);
            frontRunner.cooldownTimer = 1.2;
          }
          // 场景 4：冲撞 (Side-by-side bumping)
          else if (absDx < 18 && absDz < 2.6) {
            const pushDir = dz > 0 ? 1 : -1;
            rA.vz += pushDir * 4.5;
            rB.vz -= pushDir * 4.5;
            rA.rotZ = -pushDir * 0.25;
            rB.rotZ = pushDir * 0.25;
            rA.cooldownTimer = 1.0;
            rB.cooldownTimer = 1.0;
            rA.interactionText = "冲撞！⚡";
            rB.interactionText = "冲撞！⚡";
            rA.interactionTimer = 0.7;
            rB.interactionTimer = 0.7;
          }
        }
      }
    }
  }

  for (const r of runners) {
    if (r.finishTime != null) {
      if (leaderDone === null || r.finishTime < leaderDone) leaderDone = r.finishTime;
    }
    const settled = r.finished || r.failed;
    allDone = allDone && settled;
  }
  const over = allDone || (leaderDone !== null && time - leaderDone > 10);
  return { time, over, runners };
}

// 名次：冲线者按时间，未完赛者按距离，颠飞失败者置底
export function ranking(state: RaceState): Runner[] {
  return state.runners.slice().sort((a, b) => {
    if (a.failed && !b.failed) return 1;
    if (!a.failed && b.failed) return -1;
    if (a.failed && b.failed) return b.x - a.x;

    if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
    if (a.finishTime != null) return -1;
    if (b.finishTime != null) return 1;
    return b.x - a.x;
  });
}

