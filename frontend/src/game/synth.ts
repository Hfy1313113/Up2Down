// synth.ts —— 分部位合成笔画测试数据生成器（移植自 frontend-legacy/harness.html 的 synthParts）
import type { PartStrokes, Stroke, Vec2 } from "./types";

interface SynthOptions {
  legLen?: number;   // 腿总长
  ratio?: number;    // 大腿:小腿 比例
  hips?: number[];   // 各腿髋部 x 坐标
}

export function synthParts({ legLen = 150, ratio = 1.05, hips = [140, 175, 265, 300] }: SynthOptions = {}): PartStrokes {
  const legs: Stroke[] = [];
  const L1 = legLen * ratio / (1 + ratio), L2 = legLen / (1 + ratio);
  hips.forEach((hx, i) => {
    const dir = (i % 2 ? 1 : -1);
    const pts: Vec2[] = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14;
      let x: number, y: number;
      if (t < 0.5) {
        const u = t / 0.5;
        x = hx + dir * 8 * u; y = 175 + u * L1;
      } else {
        const u = (t - 0.5) / 0.5;
        x = hx + dir * 8 - dir * 28 * u; y = 175 + L1 + u * L2;
      }
      pts.push([x, y]);
    }
    legs.push({ points: pts });
  });
  return {
    legs,
    head: [{ points: [[325, 165], [350, 120], [368, 100], [378, 108], [372, 128]] }],
    butt: [{ points: [[122, 165], [95, 185], [82, 215]] }],
  };
}
