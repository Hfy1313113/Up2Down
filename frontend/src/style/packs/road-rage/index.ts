// 风格包：腋毛攻击 —— 致敬「驾考宝典」路怒症科普动画与《黑街 (DJ Remix)》空耳梗「黑街的孩儿，腋毛攻击」：
// 夜色高速公路、橙色路灯、低多边形方块车（黄轿车 / 红轿车 / 军绿越野 / 蓝厢货）、
// 卷发胖司机坐在座椅上握方向盘，连点越猛脸越怒。大象本身就是一辆「车」：车漆、车灯、后视镜、车牌、轮胎脚。
// 只声明内容，不含任何渲染/播放代码；所有卡通形象均为程序化原创重绘，不含原作素材。
import { defineStylePack } from "../../types";

const ASPHALT = "#3a3f47";
const LINE_WHITE = "#f2f2ea";
const LAMP_GLOW = "#ffc466";
const SEAT_GREY = "#5a5e68";
const SHIRT_TEAL = "#3b6670";
const SKIN = "#e8c993";
const INK = "#1b1b1b";
const NIGHT_INK = "#1b2440";
const CHROME = { color: "#d7dde3", metalness: 0.8, roughness: 0.25 } as const;
const TIRE = { color: "#1d1f22", roughness: 0.95 } as const;
const GLASS = { color: "#7fb6d8", roughness: 0.2, metalness: 0.3 } as const;

export default defineStylePack({
  id: "road-rage",
  name: "腋毛攻击",
  tagline: "黑街的孩儿、方块车、夜路怒飙",
  swatch: ["#e2b84f", "#c0392b", "#2d47b5", ASPHALT, LAMP_GLOW],
  // 黄轿车 / 红轿车 / 军绿越野 / 蓝厢货
  playerColors: ["#e2b84f", "#c0392b", "#6b7a3f", "#2d47b5"],

  elephant: {
    // 车漆：每位玩家一种车色，带一点金属感
    torso: { color: "$player", roughness: 0.45, metalness: 0.15 },
    head: { color: "$player", roughness: 0.45, metalness: 0.15 },
    thigh: { color: "$player", roughness: 0.5, metalness: 0.1 },
    // 象鼻 = 黑色进气软管，小腿 = 黑色挡泥板，象足 = 轮胎
    trunk: { texture: { kind: "procedural", recipe: { type: "stripes", colors: ["#2a2d33", "#3a3e45"], width: 10, angle: 90 } }, repeat: [1, 4], roughness: 0.9 },
    shin: { color: "#2a2d33", roughness: 0.85 },
    foot: TIRE,
    toenail: CHROME,
    // 扇耳 = 车窗玻璃；象牙 = 镀铬护角；尾巴 = 排气管
    ear: GLASS,
    tusk: CHROME,
    tail: { color: "#4a4f57", metalness: 0.6, roughness: 0.4 },
    // 象毯 = 灰色织物座椅
    blanket: { texture: { kind: "procedural", recipe: { type: "noise", base: "#5f6470", tint: "#454955", scale: 10, strength: 0.5, seed: 4 } }, repeat: [3, 2], roughness: 0.95 },
    eye: { color: INK, roughness: 0.3 },
  },
  elephantAccessories: [
    { kind: "headlights" },
    { kind: "taillights" },
    { kind: "mirrors", materials: { mirror: { color: "$player", roughness: 0.5, metalness: 0.15 } } },
    { kind: "bumper" },
    { kind: "hubcaps" },
    { kind: "plate", materials: { plate: { texture: { kind: "procedural", recipe: { type: "label", base: "#e9eef3", ink: NIGHT_INK, ring: NIGHT_INK, text: "象A·66666", shape: "rect" } }, roughness: 0.5 } } },
  ],

  rider: {
    materials: {
      skin: { color: SKIN, roughness: 0.75 },
      hair: { color: "#34373a", roughness: 0.95 },
      // headwear 槽 = 座椅颜色（seat 附件），jewel = 镀铬
      headwear: { color: SEAT_GREY, roughness: 0.9 },
      jewel: CHROME,
      jacket: { color: SHIRT_TEAL, roughness: 0.8 },
      pants: { color: "#3b4a5a", roughness: 0.85 },
      boots: { color: "#2b2b2b", roughness: 0.6 },
      // whipStick 槽 = 方向盘颜色（steeringWheel 附件）
      whipStick: { color: "#2f3238", roughness: 0.6 },
      whipLash: { color: "#1f1f1f", roughness: 0.8 },
    },
    accessories: ["curlyHair", "seat", "steeringWheel"],
    // 常态「不爽脸」→ 轻抽「怒视」→ 猛抽 / 甩飞「咬牙冒汗」
    face: {
      calm: { texture: { kind: "procedural", recipe: { type: "face", skin: SKIN, ink: INK, mood: "calm" }, size: 512 }, roughness: 0.75 },
      tense: { texture: { kind: "procedural", recipe: { type: "face", skin: SKIN, ink: INK, mood: "angry", mouth: "#7a1b12" }, size: 512 }, roughness: 0.75 },
      furious: { texture: { kind: "procedural", recipe: { type: "face", skin: SKIN, ink: INK, mood: "grit", sweat: "#7fd6ff" }, size: 512 }, roughness: 0.75 },
    },
  },

  environment: {
    // 傍晚转夜的高速：深蓝天幕、橙色路灯、青山剪影
    sky: { top: "#141e4d", bottom: "#4f66b3" },
    fog: { color: "#33467f", near: 90, far: 290 },
    lights: { hemiSky: "#7b8fd6", hemiGround: "#1f3b2a", hemiIntensity: 1.0, sunColor: "#b9c6ff", sunIntensity: 0.8, sunPosition: [-40, 70, 40] },
    ground: { texture: { kind: "procedural", recipe: { type: "noise", base: "#24523a", tint: "#1a3d2b", scale: 6, strength: 0.5, seed: 9 } }, repeat: [40, 8], roughness: 1 },
    // 三车道沥青：路缘实线 + 车道虚线
    lane: { texture: { kind: "procedural", recipe: { type: "road", base: ASPHALT, line: LINE_WHITE, lanes: 3, dash: 0.5, seed: 3 }, size: 512 }, repeat: [26, 1], roughness: 0.95 },
    // 波形护栏：镀锌钢
    fence: { color: "#c9ced6", metalness: 0.7, roughness: 0.35 },
    gate: {
      pole: { color: "#9aa3ad", metalness: 0.6, roughness: 0.4 },
      bannerColors: ["#f5c400", "#1b1b1b"],   // 黄黑警示格
      cannon: { color: "#ff7a1a", roughness: 0.6 },
    },
    confettiColors: ["#f5c400", "#ffffff", "#c0392b", "#ff7a1a", "#2d47b5", "#7fd6ff"],
    clouds: null,
    props: [
      { kind: "hill", count: 10, side: "both", offset: 80, jitter: 25, scale: 1.0, seed: 1,
        materials: { grass: { color: "#2b6b4e", roughness: 1 } } },
      { kind: "highwayLamp", count: 22, side: "both", offset: 10.6, scale: 1.0, seed: 2,
        materials: { post: { color: "#9aa3ad", metalness: 0.6, roughness: 0.4 }, lamp: { color: LAMP_GLOW, unlit: true } } },
      { kind: "roadSign", count: 3, side: "right", offset: 10.2, scale: 1.0, seed: 3,
        materials: { face: { texture: { kind: "procedural", recipe: { type: "label", base: "#ffffff", ring: "#d7261e", ink: INK, text: "100" } }, roughness: 0.6 } } },
      // 应急车道上停着的「同款车」：黄轿车、红轿车、军绿越野、蓝厢货
      { kind: "boxCar", count: 4, side: "left", offset: 13.5, jitter: 1, scale: 1.0, seed: 4,
        materials: { body: { color: "#e2b84f", roughness: 0.5, metalness: 0.1 }, glass: GLASS, tire: TIRE } },
      { kind: "boxCar", count: 3, side: "right", offset: 13.5, jitter: 1, scale: 1.0, seed: 5,
        materials: { body: { color: "#c0392b", roughness: 0.5, metalness: 0.1 }, glass: GLASS, tire: TIRE } },
      { kind: "boxCar", count: 2, side: "left", offset: 16.5, jitter: 1, scale: 1.15, seed: 6,
        materials: { body: { color: "#6b7a3f", roughness: 0.6, metalness: 0.05 }, glass: GLASS, tire: TIRE } },
      { kind: "boxTruck", count: 3, side: "right", offset: 17, jitter: 1, scale: 1.0, seed: 7,
        materials: { cab: { color: "#d8dde3", roughness: 0.5, metalness: 0.1 }, box: { color: "#2d47b5", roughness: 0.6 }, glass: GLASS, tire: TIRE } },
      { kind: "bush", count: 16, side: "both", offset: 20, jitter: 4, scale: 0.9, seed: 8,
        materials: { leaf: { color: "#2f6b45" }, flower: { color: "#2f6b45" } } },
    ],
  },

  birth: {
    // 展台 = 一小段夜间公路
    disc: { texture: { kind: "procedural", recipe: { type: "road", base: ASPHALT, line: LINE_WHITE, lanes: 2, dash: 0.4, seed: 5 }, size: 512 }, roughness: 0.95 },
    ring: "#f5c400",
    backdrop: "linear-gradient(180deg, #1a2656 0%, #5b73c2 100%)",
    lights: { hemiSky: "#8ea0e0", hemiGround: "#2a3a2e", keyColor: "#ffd9a0" },
  },

  ui: {
    accent: "#c8471f",
    accentHover: "#a93a18",
    ink: NIGHT_INK,
    paper: "#f7f4ec",
    bg: "#d4d9e2",
    // 虚线车道 + 浅沥青灰底
    bgPattern: "repeating-linear-gradient(90deg, rgba(255,255,255,0.45) 0 26px, transparent 26px 56px), linear-gradient(#cdd3dd, #dde2ea)",
    go: "#2f9e44",
    goHover: "#268a3a",
    canvasPaper: "#f8f6f0",
    canvasGrid: "rgba(60, 72, 100, 0.22)",
  },

  music: {
    race: {
      file: "/styles/road-rage/music/race.mp3",
      volume: 0.8,
      fadeSec: 2.5,
      // 回落：土嗨 DJ 式四四拍电子循环（和声小调、方波主旋律）
      procedural: {
        bpm: 132,
        root: 196,
        scale: [0, 2, 3, 5, 7, 8, 11],
        drums:
          "K.hhK.hhK.hhK.hh" + "K.hhK.hhK.hhK.SS" +
          "K.hhK.hhK.hhK.hh" + "K.hSK.hhK.hSKSSS",
        melody: [
          7, -100, 7, 9, 7, -100, 5, 4, 5, -100, 5, 7, 5, -100, 4, 2,
          4, -100, 4, 5, 4, -100, 2, 0, 2, -100, 2, 4, 2, -100, 0, -100,
          7, 7, 9, 11, 9, 7, 5, 7, 4, 4, 5, 7, 5, 4, 2, 4,
          0, 2, 4, 5, 4, 2, 0, -100, 7, -100, 4, -100, 0, -100, -100, -100,
        ],
        bass: [0, 0, 7, 0, 5, 5, 12, 5, 3, 3, 10, 3, 4, 4, 11, 4],
        melodyInstrument: "square",
        bassInstrument: "bass",
        swing: 0,
        gain: 0.85,
      },
    },
    menu: {
      volume: 0.45,
      // 等红灯：慢速电子鼓 + 持续低音
      procedural: {
        bpm: 96,
        root: 196,
        scale: [0, 2, 3, 5, 7, 8, 11],
        drums: "K...h...S...h..." + "K...h.K.S...h.h.",
        melody: [0, -100, 3, -100, 7, -100, 5, -100, 3, -100, 2, -100, 0, -100, -100, -100, 7, -100, 8, 7, 5, -100, 3, -100, 2, 3, 0, -100, -100, -100, -100, -100],
        bass: [0, -100, -100, -100, 5, -100, -100, -100, 3, -100, -100, -100, 4, -100, 0, -100],
        melodyInstrument: "pluck",
        bassInstrument: "drone",
        drone: true,
        gain: 0.65,
      },
    },
    birth: {
      volume: 0.55,
      // 提车仪式：明快铃声
      procedural: {
        bpm: 118,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K.h.S.h.K.h.S.hh",
        melody: [0, 4, 7, 9, 7, 4, 0, -100, 2, 5, 9, 11, 9, 5, 2, -100, 4, 7, 11, 14, 11, 7, 4, -100, 7, 4, 0, -100, 0, -100, -100, -100],
        bass: [0, -100, 0, -100, 5, -100, 4, -100, 0, -100, 0, -100, 7, -100, 0, -100],
        melodyInstrument: "bell",
        bassInstrument: "bass",
        gain: 0.7,
      },
    },
  },

  sfx: {
    whip: { synth: "hornHonk", gain: 0.9 },
    impact: { synth: "crash", gain: 1 },
    fanfare: { synth: "brassFanfare", gain: 0.9 },
    blast: { synth: "boom", gain: 1 },
    buckedOff: { synth: "tireScreech", gain: 0.9 },
    countdown: { synth: "tick", gain: 0.9 },
    go: { synth: "engineRev", gain: 1 },
    uiTap: { synth: "click", gain: 0.5 },
  },
});
