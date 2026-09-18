/* gait.ts —— 马的固定奔跑步态算法（纯数学，不含绘制）。
   所有马共用同一函数：动画只决定姿态，位移由 metrics.ts 的速度公式积分决定。 */
import type { HorseModel, LegModel, Pose, PoseLeg, Vec2 } from "./types";

// 旋转式 gallop 真实步态顺序：左后 → 右后 → 右前 → 左前（各占约 1/4 周期相位差）
export const GAIT_OFFSETS = [0.0, 0.12, 0.50, 0.62];
export const THIGH_AMP = 0.60;      // 大腿摆幅（弧度）—— 与 race.js 的步幅公式一致
const FOLD_AMP_HIND = 0.85;         // 后腿小腿折叠幅度
const FOLD_AMP_FORE = 0.95;         // 前腿小腿折叠幅度

// phase ∈ [0,1) 一个完整奔跑周期
export function computePose(model: HorseModel, phase: number): Pose {
  const legs = model.legs.map((leg, i) => {
    const off = GAIT_OFFSETS[i % GAIT_OFFSETS.length];
    const p = (phase + off) % 1;
    const base = leg.type === "hind" ? -0.10 : 0.05;
    const thigh = base + THIGH_AMP * Math.sin(2 * Math.PI * p);
    // 摆动相中小腿折叠（收起），支撑相中近乎伸直
    const foldSw = Math.max(0, Math.sin(2 * Math.PI * p + Math.PI * 0.55));
    const fold = 0.15 + (leg.type === "hind" ? FOLD_AMP_HIND : FOLD_AMP_FORE) * Math.pow(foldSw, 1.2);
    return { thigh, fold };
  });
  return {
    legs,
    pitch: 0.09 * Math.sin(2 * Math.PI * phase + 1.0),  // 躯干俯仰
    bob: 3.0 * Math.sin(4 * Math.PI * phase),           // 躯干上下颠簸
  };
}

// 前向运动学：由髋/膝角度算膝、蹄位置（本地坐标 y 向上）
export function legPoints(leg: LegModel, poseLeg: PoseLeg): { knee: Vec2; foot: Vec2 } {
  const th = poseLeg.thigh;
  const dir = leg.type === "hind" ? -1 : 1;   // 后腿向前收、前腿向后收
  const kx = leg.hip[0] + leg.L1 * Math.sin(th);
  const ky = leg.hip[1] - leg.L1 * Math.cos(th);
  const a2 = th + dir * poseLeg.fold;
  const fx = kx + leg.L2 * Math.sin(a2);
  const fy = ky - leg.L2 * Math.cos(a2);
  return { knee: [kx, ky], foot: [fx, fy] };
}
