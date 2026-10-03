// synth.ts —— 分部位合成笔画数据生成器（供单测与 ?demo= 目视验证入口使用）
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
  // 头部：脖子笔画（从躯干前缘向右上）+ 头轮廓小圈 + 双耳尖 + 象鼻（从头轮廓前下方垂下并回卷）
  const head: Stroke[] = [
    { points: [[322, 168], [344, 132], [360, 112]] },
    { points: [[362, 104], [372, 96], [384, 100], [388, 110], [380, 120], [368, 118], [362, 104]] },
    { points: [[366, 100], [362, 84], [360, 76]] },   // 左耳尖
    { points: [[378, 98], [382, 82], [384, 74]] },   // 右耳尖
    { points: [[388, 112], [398, 126], [406, 142], [412, 160], [412, 176], [406, 188], [396, 192]] }, // 象鼻
  ];
  // 屁股：臀线笔画（贴髋部向后）+ 尾巴笔画（向左下甩出）
  const butt: Stroke[] = [
    { points: [[142, 172], [126, 182], [116, 196]] },
    { points: [[116, 192], [96, 202], [82, 220], [76, 240]] },
  ];
  return { legs, head, butt };
}
