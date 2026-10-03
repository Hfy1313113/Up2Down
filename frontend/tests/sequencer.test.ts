import { describe, expect, it } from "vitest";
import { compileTrack, degreeToFreq, loopBeats } from "../src/audio/sequencer";
import { listPacks } from "../src/style/registry";

describe("程序化音乐编译（纯函数）", () => {
  it("音阶度数 → 频率：0 度为根音，跨八度翻倍，负度数降八度", () => {
    const scale = [0, 2, 4, 5, 7, 9, 11];
    expect(degreeToFreq(440, scale, 0)).toBeCloseTo(440);
    expect(degreeToFreq(440, scale, 7)).toBeCloseTo(880);
    expect(degreeToFreq(440, scale, -7)).toBeCloseTo(220);
    expect(degreeToFreq(440, scale, 4)).toBeCloseTo(440 * Math.pow(2, 7 / 12));
  });

  it("每套风格包的每条程序化曲目都能编译出有序事件，且事件都落在循环长度内", () => {
    for (const p of listPacks()) {
      for (const t of [p.music.race, p.music.menu, p.music.birth]) {
        if (!t?.procedural) continue;
        const ev = compileTrack(t.procedural);
        expect(ev.length).toBeGreaterThan(8);
        const beats = loopBeats(t.procedural);
        for (let i = 1; i < ev.length; i++) expect(ev[i].beat).toBeGreaterThanOrEqual(ev[i - 1].beat);
        for (const e of ev) expect(e.beat).toBeLessThan(beats + 0.5);
        expect(ev.some(e => e.kind === "drum")).toBe(true);
        expect(ev.some(e => e.kind === "melody")).toBe(true);
        expect(ev.some(e => e.kind === "bass")).toBe(true);
      }
    }
  });

  it("休止符（-100）不产生音符事件；连续休止延长前一个音的时值", () => {
    const ev = compileTrack({
      bpm: 120, root: 220, scale: [0, 2, 4], drums: "K...............",
      melody: [0, -100, -100, 2], bass: [0], melodyInstrument: "pluck", bassInstrument: "bass",
    });
    const mel = ev.filter(e => e.kind === "melody");
    expect(mel).toHaveLength(2);
    expect(mel[0].dur).toBeCloseTo(1.5);   // 1 个八分音符 + 2 个休止 = 3 个八分 = 1.5 拍
    expect(mel[1].dur).toBeCloseTo(0.5);
  });
});
