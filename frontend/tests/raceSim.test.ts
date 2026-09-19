import { describe, expect, it } from "vitest";
import { Recognize } from "../src/game/recognize";
import { createRace, ranking, TRACK_LEN, updateRace, applyTapBoost, MAX_BOOST } from "../src/game/raceSim";
import { synthParts } from "../src/game/synth";

function modelOf(ratio: number, legLen = 150) {
  return Recognize.analyzeParts(synthParts({ ratio, legLen }));
}

// 以固定 dt 跑 n tick
function simulate(entries: { id: string; name: string; model: ReturnType<typeof modelOf> }[], ticks: number, dt: number) {
  let s = createRace(entries);
  for (let i = 0; i < ticks; i++) s = updateRace(s, dt);
  return s;
}

describe("raceSim 位移积分", () => {
  const entries = [
    { id: "a", name: "A", model: modelOf(1.05) },
    { id: "b", name: "B", model: modelOf(2.2) },
  ];

  it("1000 tick 后确定性：两次模拟逐位一致", () => {
    const s1 = simulate(entries, 1000, 1 / 60);
    const s2 = simulate(entries, 1000, 1 / 60);
    expect(s1.time).toBeCloseTo(s2.time);
    s1.runners.forEach((r, i) => {
      expect(r.x).toBe(s2.runners[i].x);
      expect(r.phase).toBe(s2.runners[i].phase);
      expect(r.finished).toBe(s2.runners[i].finished);
    });
  });

  it("积分 = Σ speed·dt：匀速马 x≈speed·time", () => {
    const s = simulate(entries, 600, 1 / 60);   // 10 秒
    for (const r of s.runners) {
      expect(r.x).toBeCloseTo(r.speed * s.time, 3);
    }
  });

  it("均衡腿速度快于失衡腿，且明显先冲线（头名冲线+10s 强制结束）", () => {
    const s = simulate(entries, 60 * 120, 1 / 60);
    const rank = ranking(s);
    expect(rank[0].id).toBe("a");
    const a = s.runners.find(r => r.id === "a")!;
    const b = s.runners.find(r => r.id === "b")!;
    expect(a.finishTime).not.toBeNull();
    expect(a.speed).toBeGreaterThan(b.speed);
    expect(b.finished).toBe(false);   // 失衡腿在强制结束前到不了终点
    expect(a.finishTime!).toBeLessThan(40);
    expect(s.over).toBe(true);
  });

  it("冲线后不再前进；未完赛者按距离排名", () => {
    let s = createRace(entries);
    // 只推一小段时间：无人冲线
    s = simulate(entries, 60, 1 / 60);
    const rank = ranking(s);
    expect(rank.every(r => r.finishTime === null)).toBe(true);
    expect(rank[0].x).toBeGreaterThanOrEqual(rank[1].x);
    expect(s.time).toBeLessThan(TRACK_LEN / Math.max(...s.runners.map(r => r.speed)));
  });

  it("连点屏幕加速：连击提升速度且存在严格上限 MAX_BOOST", () => {
    let s = createRace(entries);
    // 初始 boost 为 1.0
    expect(s.runners[0].boost).toBe(1.0);

    // 快速连点 10 次
    for (let i = 0; i < 10; i++) {
      s = applyTapBoost(s, "a");
    }
    const boosted = s.runners.find(r => r.id === "a")!;
    expect(boosted.boost).toBeGreaterThan(1.0);
    expect(boosted.boost).toBeLessThanOrEqual(MAX_BOOST); // 不超过 MAX_BOOST 上限

    // 跑一小段：连点的马比没连点的马跑得更快
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      s = updateRace(s, dt);
    }
    const rA = s.runners.find(r => r.id === "a")!;
    expect(rA.x).toBeGreaterThan(rA.speed * s.time);
  });

  it("物理交互：超车追尾创飞与截停逻辑生效", () => {
    let s = createRace(entries);
    // 将两匹马强行拉到同一横向赛道附近，后车具有极高初速
    s.runners[0].x = 100;
    s.runners[0].z = 0;
    s.runners[0].speed = 180;
    s.runners[0].boost = 1.6;

    s.runners[1].x = 120;
    s.runners[1].z = 0.5;
    s.runners[1].speed = 50;
    s.runners[1].boost = 1.0;

    // 前进 1 帧，检测碰撞与创飞
    s = updateRace(s, 1 / 60);
    const victim = s.runners[1];
    expect(victim.launchedTimer).toBeGreaterThan(0);
    expect(victim.vy).toBeGreaterThan(0);
    expect(victim.interactionText).toContain("创飞");
  });
});
