import { describe, expect, it } from "vitest";
import { listPacks, getPack, DEFAULT_STYLE_ID, hasPack } from "../src/style/registry";
import { validatePack } from "../src/style/validate";
import { specUsesPlayer, recipeKey } from "../src/style/materials";
import bollywood from "../src/style/packs/bollywood/index";

describe("风格包注册表与校验", () => {
  it("自动发现至少两套风格包，且默认为宝莱坞", () => {
    const ids = listPacks().map(p => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids).toContain("bollywood");
    expect(ids).toContain("classic");
    expect(DEFAULT_STYLE_ID).toBe("bollywood");
    expect(listPacks()[0].id).toBe(DEFAULT_STYLE_ID);
  });

  it("每套已注册风格包都通过结构校验", () => {
    for (const p of listPacks()) expect(validatePack(p), p.id).toEqual([]);
  });

  it("未知 id 回落到默认风格；hasPack 正确", () => {
    expect(getPack("nope").id).toBe(DEFAULT_STYLE_ID);
    expect(getPack(null).id).toBe(DEFAULT_STYLE_ID);
    expect(hasPack("classic")).toBe(true);
    expect(hasPack("nope")).toBe(false);
  });

  it("校验器能指出缺槽、坏 id、音乐缺失与未知装饰物", () => {
    const bad = JSON.parse(JSON.stringify(bollywood));
    bad.id = "Bad Id";
    delete bad.elephant.trunk;
    bad.music.race = {};
    bad.environment.props.push({ kind: "spaceship", count: 1 });
    bad.rider.accessories.push("crown");
    bad.sfx.whip = { synth: "laser" };
    const errs = validatePack(bad);
    expect(errs.some(e => e.includes("id"))).toBe(true);
    expect(errs.some(e => e.includes("elephant.trunk"))).toBe(true);
    expect(errs.some(e => e.includes("music.race"))).toBe(true);
    expect(errs.some(e => e.includes("spaceship"))).toBe(true);
    expect(errs.some(e => e.includes("crown"))).toBe(true);
    expect(errs.some(e => e.includes("laser"))).toBe(true);
  });

  it("$player 占位识别：颜色或程序化配方里出现即视为玩家相关材质", () => {
    expect(specUsesPlayer({ color: "$player" })).toBe(true);
    expect(specUsesPlayer(bollywood.elephant.blanket)).toBe(true);
    expect(specUsesPlayer(bollywood.elephant.tusk)).toBe(false);
  });

  it("程序化纹理缓存键对同配方稳定、对玩家色敏感", () => {
    const r = { type: "stripes" as const, colors: ["$player", "#fff"], width: 8 };
    expect(recipeKey(r, 256, "#f00")).toBe(recipeKey({ ...r }, 256, "#f00"));
    expect(recipeKey(r, 256, "#f00")).not.toBe(recipeKey(r, 256, "#0f0"));
  });
});
