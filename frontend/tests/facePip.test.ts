import { describe, expect, it } from "vitest";
import { faceVariant, faceSpecies, recipeUsesIndex, FACE_VARIANTS } from "../src/style/materials";
import { pipLayout } from "../src/three/raceScene";

describe("脸配方的按玩家变体", () => {
  it('variant 为 "$player" 时按玩家序号轮选并在变体数内取模', () => {
    const r = { type: "face" as const, skin: "#fff", ink: "#000", mood: "calm" as const, variant: "$player" as const };
    expect(faceVariant(r, 0)).toBe(0);
    expect(faceVariant(r, 3)).toBe(3);
    expect(faceVariant(r, 4)).toBe(0);
    expect(faceVariant(r, FACE_VARIANTS + 2)).toBe(2);
  });
  it("固定 variant 不受玩家序号影响；未给 variant 为 0", () => {
    expect(faceVariant({ type: "face", skin: "#fff", ink: "#000", mood: "grit", variant: 2 }, 3)).toBe(2);
    expect(faceVariant({ type: "face", skin: "#fff", ink: "#000", mood: "angry" }, 3)).toBe(0);
  });
  it("物种：缺省为人脸；单值固定；数组按玩家序号轮选（偶数牛来、奇数肥嘟嘟袋鼠）", () => {
    const base = { type: "face" as const, skin: "#fff", ink: "#000", mood: "calm" as const };
    expect(faceSpecies(base, 2)).toBe("human");
    expect(faceSpecies({ ...base, species: "roo" }, 2)).toBe("roo");
    const alt = { ...base, species: ["bull", "roo"] as ("bull" | "roo")[] };
    expect([0, 1, 2, 3].map(i => faceSpecies(alt, i))).toEqual(["bull", "roo", "bull", "roo"]);
  });
  it("按序号变化的脸（$player 变体、肤色数组或物种数组）需要带序号缓存键，其余配方不需要", () => {
    expect(recipeUsesIndex({ type: "face", skin: "#fff", ink: "#000", mood: "calm", variant: "$player" })).toBe(true);
    expect(recipeUsesIndex({ type: "face", skin: ["#fff", "#eee"], ink: "#000", mood: "calm" })).toBe(true);
    expect(recipeUsesIndex({ type: "face", skin: "#fff", ink: "#000", mood: "calm", species: ["bull", "roo"] })).toBe(true);
    expect(recipeUsesIndex({ type: "face", skin: "#fff", ink: "#000", mood: "calm", species: "bull" })).toBe(false);
    expect(recipeUsesIndex({ type: "face", skin: "#fff", ink: "#000", mood: "calm", variant: 1 })).toBe(false);
    expect(recipeUsesIndex({ type: "stripes", colors: ["$player", "#fff"] })).toBe(false);
  });
});

describe("面部画中画布局", () => {
  it("宽屏贴右下角，尺寸有上下限且不越界", () => {
    for (const [w, h] of [[1280, 800], [1920, 1080], [760, 500], [3000, 1200]]) {
      const r = pipLayout(w, h);
      expect(r.w).toBeGreaterThanOrEqual(160);
      expect(r.w).toBeLessThanOrEqual(300);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y + r.h).toBeLessThanOrEqual(h);
      expect(r.y).toBe(12);
    }
  });
  it("窄屏（竖屏手机）抬到底部 HUD 之上且不越界", () => {
    for (const [w, h] of [[390, 844], [360, 640], [430, 932]]) {
      const r = pipLayout(w, h);
      expect(r.w).toBeGreaterThanOrEqual(116);
      expect(r.w).toBeLessThanOrEqual(180);
      expect(r.y).toBeGreaterThan(100);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y + r.h).toBeLessThanOrEqual(h);
    }
  });
});
