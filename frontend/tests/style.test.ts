import { describe, expect, it } from "vitest";
import { listPacks, getPack, DEFAULT_STYLE_ID, hasPack } from "../src/style/registry";
import { validatePack } from "../src/style/validate";
import { specUsesPlayer, recipeKey } from "../src/style/materials";
import bollywood from "../src/style/packs/bollywood/index";

describe("风格包注册表与校验", () => {
  it("自动发现三套风格包：默认「腋毛攻击」排第一，其余按 id 排序（宝莱坞、神圣奶娃），草稿纸经典已移除", () => {
    const ids = listPacks().map(p => p.id);
    expect(ids).toEqual(["road-rage", "bollywood", "milk-baby"]);
    expect(DEFAULT_STYLE_ID).toBe("road-rage");
    expect(hasPack("classic")).toBe(false);
  });

  it("每套已注册风格包都通过结构校验", () => {
    for (const p of listPacks()) expect(validatePack(p), p.id).toEqual([]);
  });

  it("未知 id 回落到默认风格；hasPack 正确", () => {
    expect(getPack("nope").id).toBe(DEFAULT_STYLE_ID);
    expect(getPack(null).id).toBe(DEFAULT_STYLE_ID);
    expect(hasPack("bollywood")).toBe(true);
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
    bad.elephantAccessories = [{ kind: "spoiler" }, { kind: "plate", materials: { plate: {} } }];
    bad.rider.face = { calm: { color: "#000" }, furious: {} };
    const errs = validatePack(bad);
    expect(errs.some(e => e.includes("id"))).toBe(true);
    expect(errs.some(e => e.includes("elephant.trunk"))).toBe(true);
    expect(errs.some(e => e.includes("music.race"))).toBe(true);
    expect(errs.some(e => e.includes("spaceship"))).toBe(true);
    expect(errs.some(e => e.includes("crown"))).toBe(true);
    expect(errs.some(e => e.includes("laser"))).toBe(true);
    expect(errs.some(e => e.includes("spoiler"))).toBe(true);
    expect(errs.some(e => e.includes("elephantAccessories.plate.plate"))).toBe(true);
    expect(errs.some(e => e.includes("rider.face.furious"))).toBe(true);
  });

  it("腋毛攻击风格包：大象车件、驭象师表情档位与公路装饰物都在契约允许的范围内", () => {
    const p = getPack("road-rage");
    expect(p.id).toBe("road-rage");
    expect(p.elephantAccessories?.map(a => a.kind)).toEqual(
      expect.arrayContaining(["headlights", "taillights", "mirrors", "plate", "hubcaps", "bumper"]),
    );
    expect(p.rider.accessories).toEqual(expect.arrayContaining(["curlyHair", "seat", "steeringWheel"]));
    expect(p.rider.face?.calm.texture?.kind).toBe("procedural");
    expect(p.rider.face?.furious).toBeDefined();
    expect(p.environment.props.map(x => x.kind)).toEqual(expect.arrayContaining(["hill", "highwayLamp", "roadSign", "boxCar", "boxTruck"]));
    expect(p.music.race.file).toBe("/styles/road-rage/music/race.mp3");
    expect(p.sfx.whip?.synth).toBe("hornHonk");
  });

  it("宝莱坞：鞭响与象鸣指向公版音频文件，且都保留合成预设回落", () => {
    const p = getPack("bollywood");
    expect(p.sfx.whip).toMatchObject({ file: "/styles/bollywood/sfx/whip.mp3", synth: "whipCrack" });
    expect(p.sfx.trumpet).toMatchObject({ file: "/styles/bollywood/sfx/trumpet.mp3", synth: "trumpetTrunk" });
    expect(validatePack({ ...p, sfx: { ...p.sfx, trumpet: { synth: "trumpetTrunk" } } })).toEqual([]);
  });

  it("神圣奶娃：奶象大眼与肚皮附件、按玩家轮选的牛来 / 肥嘟嘟附件组与脸物种、奶娃人群与弹幕牌都在契约范围内", () => {
    const p = getPack("milk-baby");
    expect(p.elephantAccessories?.map(a => a.kind)).toEqual(expect.arrayContaining(["bigEyes", "belly"]));
    expect(p.rider.accessories).toEqual(expect.arrayContaining(["sash", "belly"]));
    expect(p.rider.accessoriesByPlayer).toHaveLength(2);
    expect(p.rider.accessoriesByPlayer?.[0]).toEqual(expect.arrayContaining(["horns", "cowEars", "muzzle"]));
    expect(p.rider.accessoriesByPlayer?.[1]).toEqual(expect.arrayContaining(["tallEars", "bigNose"]));
    const calm = p.rider.face?.calm.texture;
    expect(calm?.kind === "procedural" && calm.recipe.type === "face" && calm.recipe.species).toEqual(["bull", "roo"]);
    const kinds = p.environment.props.map(x => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["milkBaby", "fuzzyBull", "chubbyRoo", "milkBottle", "billboard"]));
    expect(p.environment.props.filter(x => x.kind === "milkBaby").reduce((n, x) => n + x.count, 0)).toBeGreaterThanOrEqual(40);
    expect(p.environment.props.some(x => x.kind === "milkBaby" && x.variant === "sad")).toBe(true);
    expect(p.environment.props.filter(x => x.kind === "billboard").length).toBeGreaterThanOrEqual(4);
    expect(p.music.race.file).toBe("/styles/milk-baby/music/race.mp3");
    expect(p.music.race.procedural).toBeDefined();
    expect(p.sfx.whip?.synth).toBe("squeak");
    expect(p.sfx.trumpet?.synth).toBe("giggle");
    expect(p.sfx.buckedOff?.synth).toBe("boing");
  });

  it("校验器接受 { kind, materials } 形式的驭象师附件与 accessoriesByPlayer，并拒绝其中的未知附件与空材质", () => {
    const p = getPack("milk-baby");
    const ok = { ...p, rider: { ...p.rider, accessories: [{ kind: "horns", materials: { horn: { color: "#999" } } }, "belly"] } };
    expect(validatePack(ok)).toEqual([]);
    const bad = JSON.parse(JSON.stringify(p));
    bad.rider.accessories.push({ kind: "antenna" });
    bad.rider.accessoriesByPlayer[1].push({ kind: "bigNose", materials: { nose: {} } });
    bad.environment.props[0].materials = { grass: {} };
    const errs = validatePack(bad);
    expect(errs.some(e => e.includes("antenna"))).toBe(true);
    expect(errs.some(e => e.includes("accessoriesByPlayer[1].bigNose.nose"))).toBe(true);
    expect(errs.some(e => e.includes("props.hill.grass"))).toBe(true);
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
