/* metrics.ts —— 速度公式（纯函数移植自 frontend-legacy/js/race.js 的 computeMetrics）。
   速度完全由玩家绘制的腿长几何决定：
     步幅 ∝ 腿长（大腿+小腿）× 摆幅
     步频 ∝ 1/√腿长（现实规律：腿越短倒腾越快）
     效率 ∝ 大腿:小腿 接近 1.05:1 时最高，偏离则惩罚 */
import { THIGH_AMP } from "./gait";
import type { HorseModel, Metrics } from "./types";

const SPEED_K = 0.62;  // 全局速度系数

// 由识别出的马模型计算速度与步频（确定性：所有客户端结果一致）
export function computeMetrics(model: HorseModel): Metrics {
  let vSum = 0, cSum = 0;
  for (const leg of model.legs) {
    const L1 = Math.max(leg.L1, 4), L2 = Math.max(leg.L2, 4);
    const stride = 2 * (L1 + L2) * Math.sin(THIGH_AMP);            // 步幅
    const cadence = 2.4 * Math.sqrt(140 / (L1 + L2));              // 步频（步/秒）
    const ratioF = Math.exp(-1.8 * Math.pow(Math.log((L1 / L2) / 1.05), 2));
    vSum += stride * cadence * ratioF * leg.quality;
    cSum += cadence;
  }
  const n = model.legs.length || 1;
  return {
    speed: vSum / n * SPEED_K,      // 像素/秒
    cadence: cSum / n,              // 步/秒 → 动画周期 T = 1/cadence
    quality: model.quality,
  };
}

export { SPEED_K };
