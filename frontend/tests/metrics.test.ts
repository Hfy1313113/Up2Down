import { describe, expect, it } from "vitest";
import { Recognize } from "../src/game/recognize";
import { computeMetrics } from "../src/game/metrics";
import { synthParts } from "./synth";

describe("computeMetrics 速度公式", () => {
  it("大腿:小腿 = 1.05 附近速度最优", () => {
    const good = computeMetrics(Recognize.analyzeParts(synthParts({ ratio: 1.05 })));
    const near = computeMetrics(Recognize.analyzeParts(synthParts({ ratio: 1.3 })));
    expect(good.speed).toBeGreaterThan(near.speed);
  });

  it("明显失衡（ratio=2.2）显著慢于均衡腿", () => {
    const balanced = computeMetrics(Recognize.analyzeParts(synthParts({ legLen: 185, ratio: 1.05 })));
    const lopsided = computeMetrics(Recognize.analyzeParts(synthParts({ legLen: 185, ratio: 2.2 })));
    expect(lopsided.speed).toBeLessThan(balanced.speed * 0.7);
  });

  it("缺腿 quality 惩罚 → 速度下降", () => {
    const full = computeMetrics(Recognize.analyzeParts(synthParts()));
    const parts = synthParts();
    parts.legs = parts.legs!.slice(0, 2);
    const missing = computeMetrics(Recognize.analyzeParts(parts));
    expect(missing.quality).toBeLessThan(full.quality);
    expect(missing.speed).toBeLessThan(full.speed);
  });

  it("确定性：同模型多次计算结果一致", () => {
    const model = Recognize.analyzeParts(synthParts());
    const a = computeMetrics(model);
    const b = computeMetrics(model);
    expect(a).toEqual(b);
    expect(a.speed).toBeGreaterThan(0);
    expect(a.cadence).toBeGreaterThan(0);
  });
});
