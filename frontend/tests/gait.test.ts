import { describe, expect, it } from "vitest";
import { Recognize } from "../src/game/recognize";
import { GAIT_OFFSETS, THIGH_AMP, computePose, legPoints } from "../src/game/gait";
import { synthParts } from "./synth";

describe("gait 步态", () => {
  const model = Recognize.analyzeParts(synthParts());

  it("常量与 legacy 一致", () => {
    expect(GAIT_OFFSETS).toEqual([0.0, 0.12, 0.50, 0.62]);
    expect(THIGH_AMP).toBeCloseTo(0.60);
  });

  it("同输入同输出（相位确定性）", () => {
    for (const phase of [0, 0.13, 0.5, 0.87, 0.999]) {
      const a = computePose(model, phase);
      const b = computePose(model, phase);
      expect(a).toEqual(b);
    }
  });

  it("pose 覆盖 pitch/bob 与 4 条腿", () => {
    const pose = computePose(model, 0.3);
    expect(pose.legs).toHaveLength(4);
    for (const pl of pose.legs) {
      expect(typeof pl.thigh).toBe("number");
      expect(typeof pl.fold).toBe("number");
    }
    expect(typeof pose.pitch).toBe("number");
    expect(typeof pose.bob).toBe("number");
  });

  it("legPoints 前向运动学：膝/蹄位置确定且符合几何", () => {
    const pose = computePose(model, 0.25);
    model.legs.forEach((leg, i) => {
      const p1 = legPoints(leg, pose.legs[i]);
      const p2 = legPoints(leg, pose.legs[i]);
      expect(p1).toEqual(p2); // 确定性
      // 大腿长度守恒：|knee - hip| = L1
      const d1 = Math.hypot(p1.knee[0] - leg.hip[0], p1.knee[1] - leg.hip[1]);
      expect(d1).toBeCloseTo(leg.L1, 5);
      // 小腿长度守恒：|foot - knee| = L2
      const d2 = Math.hypot(p1.foot[0] - p1.knee[0], p1.foot[1] - p1.knee[1]);
      expect(d2).toBeCloseTo(leg.L2, 5);
    });
  });
});
