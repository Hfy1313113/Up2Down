import { describe, expect, it } from "vitest";
import { Recognize } from "../src/game/recognize";
import { synthParts } from "../src/game/synth";

describe("Recognize.analyzeParts", () => {
  it("合成标准笔画 → 4 条腿，每条有 hip/knee/thigh(=L1)/shin(=L2)/foot", () => {
    const model = Recognize.analyzeParts(synthParts());
    expect(model.legs).toHaveLength(4);
    for (const leg of model.legs) {
      expect(leg.hip).toHaveLength(2);
      expect(leg.knee).toHaveLength(2);
      expect(leg.foot).toHaveLength(2);
      expect(leg.L1).toBeGreaterThan(0);   // 大腿
      expect(leg.L2).toBeGreaterThan(0);   // 小腿
      expect(leg.quality).toBeCloseTo(1);
      expect(leg.synthesized).toBe(false);
      expect(["hind", "fore"]).toContain(leg.type);
    }
    // 左两条 = 后腿，右两条 = 前腿
    expect(model.legs[0].type).toBe("hind");
    expect(model.legs[1].type).toBe("hind");
    expect(model.legs[2].type).toBe("fore");
    expect(model.legs[3].type).toBe("fore");
  });

  it("躯干自动生成并归一化（len=120，脚底 y=0）", () => {
    const model = Recognize.analyzeParts(synthParts());
    expect(model.torso.len).toBeCloseTo(120);
    expect(model.torso.cx).toBe(0);
    expect(model.torso.thick).toBeGreaterThanOrEqual(34);
    expect(model.torso.thick).toBeLessThanOrEqual(56);
    for (const leg of model.legs) {
      expect(leg.foot[1]).toBeCloseTo(0, 5); // 脚底在 y=0
    }
    expect(model.bodyH).toBeGreaterThan(0);
    expect(model.bodyH).toBeCloseTo(model.torso.cy, 5);
  });

  it("头在躯干前上方，屁股在躯干后方", () => {
    const model = Recognize.analyzeParts(synthParts());
    expect(model.head.x).toBeGreaterThan(model.torso.cx);
    expect(model.head.y).toBeGreaterThan(model.torso.cy);   // 本地系 y 向上
    expect(model.head.size).toBeGreaterThan(0);
    expect(model.tail?.found).toBe(true);
    expect(model.tail!.x).toBeLessThan(model.torso.cx);
  });

  it("头部识别：脖子两端分离、朝向指向右上、识别出双耳尖", () => {
    const model = Recognize.analyzeParts(synthParts());
    const H = model.head;
    expect(H.found).toBe(true);
    // 脖子根（neckBase）应在脖子头端（neckX/neckY）的左下（靠躯干）
    expect(H.neckBaseX!).toBeLessThan(H.neckX);
    expect(H.neckBaseY!).toBeLessThan(H.neckY);
    // 朝向单位向量：指向右上（本地系 y 向上）
    expect(H.dirX!).toBeGreaterThan(0.3);
    expect(H.dirY!).toBeGreaterThan(0.3);
    expect(Math.hypot(H.dirX!, H.dirY!)).toBeCloseTo(1, 5);
    // 合成数据画了 2 个耳尖，且耳尖在头心上方
    expect(H.earTips).toHaveLength(2);
    for (const tip of H.earTips!) expect(tip[1]).toBeGreaterThan(H.y);
  });

  it("屁股识别：尾巴曲线尾根靠近躯干、尾尖在后方，摆动幅度合法", () => {
    const model = Recognize.analyzeParts(synthParts());
    const T = model.tail!;
    expect(T.found).toBe(true);
    expect(T.curve).toBeDefined();
    expect(T.curve!.length).toBe(8);
    // 尾根比尾尖更靠近躯干前部（x 更大）
    const tip = T.curve![T.curve!.length - 1];
    expect(T.x).toBeGreaterThan(tip[0]);
    // 整条尾巴在躯干中心后方
    for (const [x] of T.curve!) expect(x).toBeLessThan(model.torso.cx);
    expect(T.swing!).toBeGreaterThanOrEqual(0);
    expect(T.swing!).toBeLessThanOrEqual(1);
  });

  it("缺头缺屁股 → found=false，网格层将使用默认头尾", () => {
    const model = Recognize.analyzeParts({ legs: synthParts().legs, head: [], butt: [] });
    expect(model.head.found).toBe(false);
    expect(model.tail!.found).toBe(false);
    expect(model.tail!.curve ?? []).toHaveLength(0);
    // 头/尾字段仍有合理缺省，网格层不会崩
    expect(model.head.dirX ?? 1).toBeGreaterThan(0);
  });

  it("归一化后腿长与躯干等比（腿长≈髋高，足以触地）", () => {
    const model = Recognize.analyzeParts(synthParts({ legLen: 150, ratio: 1.05 }));
    for (const leg of model.legs) {
      const L = leg.L1 + leg.L2;
      expect(L).toBeGreaterThan(model.bodyH * 0.8);   // 腿能达到地面附近
      expect(leg.hip[1]).toBeLessThan(L + model.torso.thick * 0.2); // 髋高≈腿长（后腿略抬高）
    }
  });

  it("缺腿 → 合成兜底，quality=0.7 惩罚路径", () => {
    const parts = synthParts();
    parts.legs = parts.legs!.slice(0, 2); // 只画 2 条腿
    const model = Recognize.analyzeParts(parts);
    expect(model.legs).toHaveLength(4);
    const synth = model.legs.filter(l => l.synthesized);
    expect(synth.length).toBe(2);
    for (const l of synth) expect(l.quality).toBeCloseTo(0.7);
    // 整体质量 = (1+1+0.7+0.7)/4 = 0.85
    expect(model.quality).toBeCloseTo(0.85);
  });

  it("完全空笔画 → 全部合成兜底，quality=0.7（legacy analyzeParts 语义）", () => {
    const model = Recognize.analyzeParts({ legs: [], head: [], butt: [] });
    expect(model.legs).toHaveLength(4);
    expect(model.quality).toBeCloseTo(0.7);
    for (const l of model.legs) expect(l.synthesized).toBe(true);
  });
});
