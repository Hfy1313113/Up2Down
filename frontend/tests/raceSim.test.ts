import { describe, expect, it } from "vitest";
import { Recognize } from "../src/game/recognize";
import { createRace, ranking, TRACK_LEN, updateRace } from "../src/game/raceSim";
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
});
