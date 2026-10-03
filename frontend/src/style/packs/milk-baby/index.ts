// 风格包：神圣奶娃 —— 致敬 2026 年抽象圈「三黄」吉祥物梗：奶娃（「我是奶龙」的 AI 变异体，网传「奶蛙」：
// 黄圆润 / 浅米腹 / 绿眼 / 灰爪，捧腹狂笑；忧郁款流大蓝泪）、「牛来」（AI 重绘版：鹅黄绒毛、灰角、粉内耳、淡粉嘴鼻、
// 人脸式眉眼）与「你胆子真是肥嘟嘟的」（被养胖的黄袋鼠：鹅黄、浅黄肚、大棕鼻、立耳、小圆眼）。
// 场景：蓝天白云绿草地上的幼儿园塑胶跑道，两侧堆满围观的奶娃，牛来与肥嘟嘟混在人群里，远处立着巨型奶娃与奶瓶，
// 广告牌上滚着「我是奶龙！我才是奶龙！」「胆子真是肥嘟嘟的」「牛来撞树上了」等弹幕。
// 大象是「奶象」：奶黄绒毛、奶白肚皮、奶龙式大绿眼、灰爪与奶牙；驭象师偶数号是牛来（犄角、牛耳、粉吻、不屑眉眼），
// 奇数号是肥嘟嘟（高立耳、大棕鼻、圆白眼），身披玩家色选手绶带，象毯是玩家色波点围兜。
// 只声明内容，不含任何渲染/播放代码；所有形象均为程序化几何与 Canvas 纹理原创重绘，不含原作素材。
import { defineStylePack, type MaterialSpec, type PropSpec } from "../../types";

const MILK_YELLOW = "#f9c531";
const FUR_SHADE = "#e3a81c";
const CREAM = "#fff1cf";
const SKY = "#6cc2ff";
const GRASS = "#6fcf6a";
const INK = "#2a1a0a";
const PINK = "#ff8fab";
const TRACK_RED = "#d7634e";

/** 奶黄绒毛：细碎同色系噪点 */
const fur = (base: string, repeat: [number, number] = [3, 3]): MaterialSpec => ({
  texture: { kind: "procedural", recipe: { type: "noise", base, tint: FUR_SHADE, scale: 10, strength: 0.35, seed: 21 } }, repeat, roughness: 0.95,
});
const FUR = fur(MILK_YELLOW);
/** 吉祥物脸底：与绒毛同色（脸贴图自己画绒毛感） */
const MASCOT_SKIN = "#f3bd2c";

/** 两种长相按玩家序号轮选：偶数号牛来、奇数号肥嘟嘟袋鼠（脸贴图 species 与 3D 附件组配套） */
const SPECIES = ["bull", "roo"] as const;
const face = (mood: "calm" | "angry" | "grit", sweat?: string) => ({
  texture: { kind: "procedural" as const, recipe: { type: "face" as const, skin: MASCOT_SKIN, ink: INK, mood, variant: "$player" as const, species: [...SPECIES], sweat }, size: 512 as const },
  roughness: 0.9,
});

/** 弹幕广告牌：横牌 1.3:1，文字按比例预压不变形 */
const billboard = (text: string, ring: string, count: number, side: "left" | "right" | "both", seed: number): PropSpec => ({
  kind: "billboard", count, side, offset: 22 + (seed % 3), jitter: 1, scale: 1.0, seed,
  materials: { face: { texture: { kind: "procedural", recipe: { type: "label", base: "#fff6d8", ring, ink: INK, text, shape: "rect", aspect: 1.3 }, size: 512 }, roughness: 0.7 } },
});

export default defineStylePack({
  id: "milk-baby",
  name: "神圣奶娃",
  tagline: "我是奶龙、牛来、你胆子真是肥嘟嘟",
  swatch: [MILK_YELLOW, CREAM, "#3bb273", SKY, PINK],
  // 草莓红 / 天空蓝 / 青苹果绿 / 葡萄紫：在一片奶黄里一眼分清四位玩家
  playerColors: ["#ff6b6b", "#3d9df6", "#43c463", "#b765e6"],

  elephant: {
    // 奶象：全身奶黄绒毛，灰爪（奶蛙规范「灰爪」），象牙是奶白「奶牙」，眼睛由 bigEyes 附件盖成奶龙大绿眼
    torso: FUR,
    head: FUR,
    trunk: fur(MILK_YELLOW, [1, 4]),
    ear: fur(MILK_YELLOW, [2, 2]),
    tusk: { color: "#fff6e0", roughness: 0.4 },
    thigh: FUR,
    shin: fur(MILK_YELLOW, [1, 2]),
    foot: { color: "#9a9a93", roughness: 0.9 },
    toenail: { color: "#d8d8d2", roughness: 0.6 },
    tail: { color: MILK_YELLOW, roughness: 0.95 },
    // 象毯 = 玩家色波点围兜
    blanket: { texture: { kind: "procedural", recipe: { type: "spots", base: "$player", spot: "#fffaf0", density: 1.3, radius: 0.07, seed: 8 } }, repeat: [2, 1], roughness: 0.85 },
    eye: { color: INK, roughness: 0.3 },
  },
  elephantAccessories: [
    { kind: "bigEyes", materials: { iris: { color: "#3bb273", roughness: 0.4 } } },
    { kind: "belly", materials: { belly: { color: CREAM, roughness: 0.9 } } },
  ],

  rider: {
    materials: {
      skin: fur(MASCOT_SKIN),
      // 后脑头发与绒毛同色，视觉上消失
      hair: FUR,
      // headwear 槽 = 选手绶带（sash 附件）颜色：玩家色
      headwear: { color: "$player", roughness: 0.75 },
      jewel: { color: "#8d8373", roughness: 0.7 },
      jacket: FUR,
      pants: FUR,
      boots: { color: "#d9a21b", roughness: 0.9 },
      // 鞭子 = 奶瓶棒棒糖：白杆粉穗
      whipStick: { color: "#fdf8ee", roughness: 0.5 },
      whipLash: { color: PINK, roughness: 0.8 },
    },
    accessories: ["sash", "belly"],
    // 偶数号玩家：牛来（犄角 + 牛耳 + 粉吻）；奇数号玩家：肥嘟嘟袋鼠（高立耳 + 大棕鼻）
    accessoriesByPlayer: [
      ["horns", "cowEars", "muzzle"],
      ["tallEars", "bigNose"],
    ],
    // 常态（牛来半阖不屑 / 肥嘟嘟无辜圆眼）→ 轻抽「压眉张嘴」→ 猛抽 / 甩飞「咬牙冒汗」
    face: { calm: face("calm"), tense: face("angry"), furious: face("grit", "#7fd6ff") },
  },

  environment: {
    // 晴空万里：天蓝到奶白
    sky: { top: "#3f9df0", bottom: "#d9f1ff" },
    fog: { color: "#cfe9ff", near: 110, far: 320 },
    lights: { hemiSky: "#dff2ff", hemiGround: "#6fa85a", hemiIntensity: 1.35, sunColor: "#fff4d6", sunIntensity: 1.6, sunPosition: [50, 90, 30] },
    // 幼儿园草坪
    ground: { texture: { kind: "procedural", recipe: { type: "noise", base: GRASS, tint: "#4faf4c", scale: 6, strength: 0.4, seed: 12 } }, repeat: [40, 8], roughness: 1 },
    // 红色塑胶跑道：白色边线 + 四道分道线
    lane: { texture: { kind: "procedural", recipe: { type: "road", base: TRACK_RED, line: "#fff7ea", lanes: 4, dash: 0.92, seed: 4 }, size: 512 }, repeat: [26, 1], roughness: 0.95 },
    // 白色小栅栏
    fence: { color: "#fffaf0", roughness: 0.8 },
    gate: {
      pole: { color: MILK_YELLOW, roughness: 0.6 },
      bannerColors: [MILK_YELLOW, "#fffaf0"],
      cannon: { color: PINK, roughness: 0.6 },
    },
    confettiColors: [MILK_YELLOW, "#ffffff", PINK, SKY, "#3bb273", "#ffd9a0"],
    clouds: { color: "#ffffff", count: 14 },
    props: [
      { kind: "hill", count: 8, side: "both", offset: 90, jitter: 25, scale: 1.0, seed: 1,
        materials: { grass: { color: "#5cbf62", roughness: 1 } } },
      { kind: "roundTree", count: 14, side: "both", offset: 26, jitter: 6, scale: 1.3, seed: 2,
        materials: { trunk: { color: "#9a6a3a", roughness: 1 }, leaf: { color: "#56b85e", roughness: 0.9 } } },
      // 堆满跑道两侧的奶娃围观团（抿嘴的、捧腹大笑的，偶尔一只流着蓝泪的忧郁奶娃）
      { kind: "milkBaby", count: 36, side: "both", offset: 11.6, jitter: 1.4, scale: 1.0, seed: 11, variant: "mixed" },
      { kind: "milkBaby", count: 12, side: "both", offset: 15.5, jitter: 2.5, scale: 1.35, seed: 12, variant: "laugh" },
      { kind: "milkBaby", count: 5, side: "both", offset: 13.4, jitter: 1.2, scale: 1.0, seed: 13, variant: "sad" },
      // 远处的巨型神圣奶娃
      { kind: "milkBaby", count: 3, side: "both", offset: 58, jitter: 8, scale: 7, seed: 14, variant: "laugh" },
      // 吉祥物三剑客的另外两位混在人群里
      { kind: "fuzzyBull", count: 6, side: "both", offset: 14.2, jitter: 1.5, scale: 1.0, seed: 15 },
      { kind: "chubbyRoo", count: 6, side: "both", offset: 14.0, jitter: 1.5, scale: 1.1, seed: 16 },
      { kind: "milkBottle", count: 10, side: "both", offset: 20, jitter: 3, scale: 1.6, seed: 17 },
      { kind: "milkBottle", count: 2, side: "both", offset: 70, jitter: 6, scale: 9, seed: 18 },
      // 弹幕广告牌（三黄名场面台词）
      billboard("我是奶龙！", "#f2a900", 2, "left", 19),
      billboard("我才是奶龙！", "#f2a900", 2, "right", 20),
      billboard("你胆子真是肥嘟嘟", SKY, 2, "right", 21),
      billboard("牛来撞树上了", PINK, 2, "left", 22),
      billboard("妈——妈——", PINK, 1, "both", 23),
      billboard("齁齁齁齁", "#3bb273", 1, "both", 24),
      { kind: "bunting", count: 6, offset: 9, scale: 1.0, seed: 25,
        materials: { rope: { color: "#c9a24a" }, flag: { color: MILK_YELLOW }, flag2: { color: "#ffffff" }, flag3: { color: SKY } } },
      { kind: "bush", count: 14, side: "both", offset: 18, jitter: 3, scale: 0.9, seed: 26,
        materials: { leaf: { color: "#58b85f" }, flower: { color: "#fff3b0" } } },
    ],
  },

  birth: {
    // 展台 = 一摊奶黄波点奶渍
    disc: { texture: { kind: "procedural", recipe: { type: "spots", base: "#fff4d6", spot: "#ffe08a", density: 0.7, radius: 0.08, seed: 6 } }, roughness: 0.9 },
    ring: MILK_YELLOW,
    backdrop: "linear-gradient(180deg, #5fb3f5 0%, #dcf2ff 100%)",
    lights: { hemiSky: "#e6f4ff", hemiGround: "#8cb87a", keyColor: "#fff2cc" },
  },

  ui: {
    accent: "#e07b00",
    accentHover: "#c46a00",
    ink: "#4a2e12",
    paper: "#fffaf0",
    bg: "#ffe9a8",
    // 奶黄底上的奶白波点
    bgPattern: "radial-gradient(rgba(255,255,255,0.75) 2.2px, transparent 2.4px), linear-gradient(#ffe9a8, #fff3c8)",
    go: "#3cae5c",
    goHover: "#2f9a4e",
    canvasPaper: "#fffdf6",
    canvasGrid: "rgba(224, 123, 0, 0.22)",
  },

  music: {
    race: {
      file: "/styles/milk-baby/music/race.mp3",
      volume: 0.8,
      fadeSec: 2.5,
      // 回落：奶娃进行曲——大调、铃声主旋律、蹦跳的弹拨低音
      procedural: {
        bpm: 128,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums:
          "K.h.S.h.K.h.S.h." + "K.h.S.h.K.hhS.hh" +
          "K.h.S.h.K.h.S.h." + "K.hhS.h.KKhhSSh.",
        melody: [
          0, 2, 4, 4, 2, 4, 5, -100, 4, 2, 0, -100, 2, 4, 2, -100,
          0, 2, 4, 4, 2, 4, 5, -100, 7, 5, 4, 2, 0, -100, -100, -100,
          7, 7, 9, 7, 5, 4, 5, -100, 4, 4, 5, 4, 2, 0, 2, -100,
          0, 2, 4, 5, 7, 7, 9, 7, 5, 4, 2, 4, 0, -100, -100, -100,
        ],
        bass: [0, 0, 4, 4, 5, 5, 0, 0, 3, 3, 4, 4, 0, 4, 0, 0],
        melodyInstrument: "bell",
        bassInstrument: "pluck",
        swing: 0.04,
        gain: 0.8,
      },
    },
    menu: {
      volume: 0.45,
      // 午睡摇篮曲：慢速弹拨 + 持续低音
      procedural: {
        bpm: 84,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K...h...S...h..." + "K...h...S.h.h...",
        melody: [4, -100, 2, -100, 0, -100, 2, -100, 4, 4, 4, -100, -100, -100, -100, -100, 2, 2, 2, -100, -100, -100, 4, 7, 7, -100, -100, -100, -100, -100, -100, -100],
        bass: [0, -100, -100, -100, 5, -100, -100, -100, 0, -100, -100, -100, 4, -100, 0, -100],
        melodyInstrument: "pluck",
        bassInstrument: "drone",
        drone: true,
        gain: 0.6,
      },
    },
    birth: {
      volume: 0.55,
      // 开奶仪式：方波叮当
      procedural: {
        bpm: 120,
        root: 329.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K.h.S.h.K.h.S.hh",
        melody: [0, 4, 7, 4, 0, 4, 7, -100, 2, 5, 9, 5, 2, 5, 9, -100, 4, 7, 11, 7, 4, 7, 11, -100, 7, 4, 0, -100, 0, -100, -100, -100],
        bass: [0, -100, 0, -100, 5, -100, 4, -100, 0, -100, 0, -100, 7, -100, 0, -100],
        melodyInstrument: "square",
        bassInstrument: "bass",
        gain: 0.65,
      },
    },
  },

  sfx: {
    // 挥鞭 = 玩具捏响；猛抽时奶象咯咯笑；甩飞 = 弹簧嘣
    whip: { synth: "squeak", gain: 0.9 },
    trumpet: { synth: "giggle", gain: 1 },
    impact: { synth: "thud", gain: 1 },
    fanfare: { synth: "brassFanfare", gain: 0.9 },
    blast: { synth: "boom", gain: 1 },
    buckedOff: { synth: "boing", gain: 1 },
    countdown: { synth: "tick", gain: 0.9 },
    go: { synth: "goBlast", gain: 1 },
    uiTap: { synth: "click", gain: 0.5 },
  },
});
