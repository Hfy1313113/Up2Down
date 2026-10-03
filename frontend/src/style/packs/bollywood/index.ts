// 风格包：宝莱坞狂欢 —— 典型印度艺术与节庆视觉：彩绘大象、曼陀罗与佩斯利纹样、金色托拉纳门、
// 神庙与棕榈、万寿菊彩带；驭象师深肤色、小胡子、头巾配宝石；音乐为宝莱坞节奏。
// 只声明内容，不含任何渲染/播放代码。
import { defineStylePack } from "../../types";

const GOLD = "#e3b23c";
const SAFFRON = "#ff9933";
const INDIA_GREEN = "#138808";
const MAROON = "#8a1c2b";

export default defineStylePack({
  id: "bollywood",
  name: "宝莱坞狂欢",
  tagline: "彩绘象、曼陀罗、万寿菊与鼓点",
  swatch: [SAFFRON, GOLD, MAROON, INDIA_GREEN, "#f8e7c9"],
  playerColors: ["#e63946", "#1d6fb8", "#2a9d3f", "#f4a100"],

  elephant: {
    torso: { texture: { kind: "procedural", recipe: { type: "wrinkle", base: "#8f8a86", line: "#6f6a67", density: 1.1, seed: 3 } }, repeat: [3, 2], roughness: 0.9 },
    head: { texture: { kind: "procedural", recipe: { type: "mandala", base: "#8f8a86", ink: MAROON, accent: GOLD, rings: 4 } }, roughness: 0.85 },
    trunk: { texture: { kind: "procedural", recipe: { type: "stripes", colors: ["#8f8a86", MAROON, "#8f8a86", GOLD], width: 10, angle: 90 } }, repeat: [1, 4], roughness: 0.9 },
    ear: { texture: { kind: "procedural", recipe: { type: "paisley", base: "#8f8a86", ink: MAROON, accent: SAFFRON, seed: 5 } }, roughness: 0.9 },
    tusk: { color: "#f3ead3", roughness: 0.35 },
    thigh: { texture: { kind: "procedural", recipe: { type: "wrinkle", base: "#8a8582", line: "#6b6663", density: 1.4, seed: 7 } }, repeat: [2, 2], roughness: 0.95 },
    shin: { texture: { kind: "procedural", recipe: { type: "stripes", colors: ["#8a8582", GOLD, "#8a8582", "#8a8582"], width: 8, angle: 0 } }, repeat: [1, 3], roughness: 0.9 },
    foot: { color: "#75706d", roughness: 1 },
    toenail: { color: "#e9e2cf", roughness: 0.5 },
    tail: { color: "#6f6a67", roughness: 1 },
    blanket: { color: "$player", texture: { kind: "procedural", recipe: { type: "paisley", base: "$player", ink: GOLD, accent: "#fff3d6", seed: 11 } }, repeat: [2, 1], roughness: 0.8 },
    eye: { color: "#1b1b1b", roughness: 0.3 },
  },

  rider: {
    materials: {
      skin: { color: "#5a3523", roughness: 0.75 },
      hair: { color: "#140c08", roughness: 0.9 },
      headwear: { color: "$player", texture: { kind: "procedural", recipe: { type: "stripes", colors: ["$player", GOLD], width: 14, angle: 35 } }, repeat: [2, 1], roughness: 0.7 },
      jewel: { color: GOLD, metalness: 0.8, roughness: 0.25, emissive: "#6b4a00", emissiveIntensity: 0.25 },
      jacket: { texture: { kind: "procedural", recipe: { type: "stripes", colors: ["#fff6df", GOLD, "#fff6df", "#fff6df"], width: 6, angle: 0 } }, repeat: [1, 2], roughness: 0.65 },
      pants: { color: "#f7f0e2", roughness: 0.8 },
      boots: { color: "#4a2a16", roughness: 0.55 },
      whipStick: { color: "#3b2113", roughness: 0.6 },
      whipLash: { color: MAROON, roughness: 0.8 },
    },
    accessories: ["turban", "mustache", "bindi", "sash"],
  },

  environment: {
    sky: { top: "#f2a65a", bottom: "#ffe3b3" },
    fog: { color: "#ffd9a6", near: 70, far: 260 },
    lights: { hemiSky: "#ffe6c4", hemiGround: "#b8783a", hemiIntensity: 1.15, sunColor: "#ffd59a", sunIntensity: 1.5, sunPosition: [60, 70, 20] },
    ground: { texture: { kind: "procedural", recipe: { type: "noise", base: "#d9b06d", tint: "#b98a4a", scale: 6, strength: 0.5, seed: 2 } }, repeat: [40, 8], roughness: 1 },
    lane: { texture: { kind: "procedural", recipe: { type: "stripes", colors: ["#c4652f", "#b55a28"], width: 32, angle: 90 } }, repeat: [30, 1], roughness: 1 },
    fence: { texture: { kind: "procedural", recipe: { type: "stripes", colors: [MAROON, GOLD], width: 12, angle: 0 } }, repeat: [1, 2], roughness: 0.7 },
    gate: {
      pole: { color: GOLD, metalness: 0.6, roughness: 0.35 },
      bannerColors: [SAFFRON, INDIA_GREEN],
      cannon: { color: MAROON, metalness: 0.4, roughness: 0.4 },
    },
    confettiColors: ["#ff9933", "#ffd23f", "#e63946", "#ff69b4", INDIA_GREEN, "#ffffff", GOLD],
    clouds: { color: "#fff1dc", count: 10 },
    props: [
      { kind: "mountain", count: 8, offset: 95, jitter: 20, scale: 1.2, seed: 1 },
      { kind: "temple", count: 5, side: "both", offset: 30, jitter: 6, scale: 1.0, seed: 2,
        materials: { wall: { color: "#f3d9a4", roughness: 0.9 }, dome: { color: GOLD, metalness: 0.5, roughness: 0.35 }, trim: { color: MAROON } } },
      { kind: "torana", count: 3, offset: 0, scale: 1.0, seed: 3,
        materials: { pillar: { color: GOLD, metalness: 0.5, roughness: 0.35 }, beam: { color: MAROON }, drape: { color: SAFFRON } } },
      { kind: "palm", count: 16, side: "both", offset: 18, jitter: 5, scale: 1.0, seed: 4,
        materials: { trunk: { color: "#8b5a2b", roughness: 1 }, leaf: { color: "#3e8f3e", roughness: 0.9 } } },
      { kind: "bunting", count: 10, offset: 9, scale: 1.0, seed: 5,
        materials: { rope: { color: "#6b4a2b" }, flag: { color: SAFFRON }, flag2: { color: INDIA_GREEN }, flag3: { color: "#ffffff" } } },
      { kind: "lantern", count: 12, side: "both", offset: 12.5, scale: 1.0, seed: 6,
        materials: { post: { color: "#5a3a1e" }, lamp: { color: "#ffb347", emissive: "#ff7a00", emissiveIntensity: 0.9, unlit: true } } },
      { kind: "bush", count: 14, side: "both", offset: 14, jitter: 3, scale: 0.9, seed: 7,
        materials: { leaf: { color: "#4f9a3c" }, flower: { color: "#ffb703" } } },
    ],
  },

  birth: {
    disc: { texture: { kind: "procedural", recipe: { type: "mandala", base: MAROON, ink: GOLD, accent: SAFFRON, rings: 6 } }, roughness: 0.85 },
    ring: GOLD,
    backdrop: "linear-gradient(180deg, #f6b26b 0%, #ffe6bf 100%)",
    lights: { hemiSky: "#fff0d6", hemiGround: "#9a6a3a", keyColor: "#ffd9a0" },
  },

  ui: {
    accent: "#d9480f",
    accentHover: "#b83c0a",
    ink: "#3b1f0e",
    paper: "#fff8ec",
    bg: "#f6dfb6",
    bgPattern: "radial-gradient(#e4b56e 1.4px, transparent 1.4px), radial-gradient(circle at 50% 50%, #f9e8c6, #f1d3a2)",
    go: INDIA_GREEN,
    goHover: "#0f6b06",
    canvasPaper: "#fff9ee",
    canvasGrid: "rgba(190, 120, 60, 0.26)",
  },

  music: {
    race: {
      file: "/styles/bollywood/music/race.mp3",
      volume: 0.8,
      procedural: {
        bpm: 126,
        root: 220,
        scale: [0, 1, 4, 5, 7, 8, 10],
        drums:
          "K.hhS.hKK.hhS.hh" + "K.hhS.hKK.hhSSTt" +
          "K.hhS.hKK.hhS.hh" + "K.hhS.hKK.hTSSTT",
        melody: [
          7, 7, 8, 7, 5, 4, 5, -100, 4, 4, 5, 4, 2, 1, 2, -100,
          0, 2, 4, 5, 7, 8, 7, 5, 4, 5, 4, 2, 1, 2, 0, -100,
          7, 9, 8, 7, 9, 8, 7, 5, 4, 5, 7, 8, 7, 5, 4, -100,
          2, 4, 5, 4, 2, 1, 2, 4, 0, 1, 0, -100, 0, 0, -100, -100,
        ],
        bass: [0, 0, 0, 7, 0, 0, 5, 4, 0, 0, 0, 7, 0, 0, 1, 0],
        melodyInstrument: "lead",
        bassInstrument: "bass",
        drone: true,
        swing: 0.08,
        gain: 0.9,
      },
    },
    menu: {
      volume: 0.5,
      procedural: {
        bpm: 92,
        root: 220,
        scale: [0, 1, 4, 5, 7, 8, 10],
        drums: "K...h...T...h..." + "K...h...T.t.h.h.",
        melody: [0, -100, 4, -100, 5, 4, 2, -100, 1, -100, 2, -100, 0, -100, -100, -100, 7, -100, 8, 7, 5, -100, 4, -100, 2, 4, 1, -100, 0, -100, -100, -100],
        bass: [0, -100, -100, -100, 5, -100, -100, -100, 0, -100, -100, -100, 1, -100, 0, -100],
        melodyInstrument: "pluck",
        bassInstrument: "drone",
        drone: true,
        gain: 0.7,
      },
    },
    birth: {
      volume: 0.55,
      procedural: {
        bpm: 110,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K.h.S.h.K.h.S.hh",
        melody: [0, 2, 4, 7, 4, 2, 0, -100, 4, 5, 7, 9, 7, 5, 4, -100, 7, 9, 11, 14, 11, 9, 7, -100, 4, 2, 0, -100, 0, -100, -100, -100],
        bass: [0, -100, 0, -100, 5, -100, 4, -100, 0, -100, 0, -100, 7, -100, 0, -100],
        melodyInstrument: "bell",
        bassInstrument: "bass",
        gain: 0.7,
      },
    },
  },

  sfx: {
    whip: { synth: "whipCrack", gain: 0.9 },
    impact: { synth: "dholHit", gain: 1 },
    fanfare: { synth: "shehnaiFanfare", gain: 0.9 },
    blast: { synth: "boom", gain: 1 },
    buckedOff: { synth: "slideWhistle", gain: 0.9 },
    countdown: { synth: "tablaTak", gain: 0.9 },
    go: { synth: "goBlast", gain: 1 },
    uiTap: { synth: "click", gain: 0.5 },
  },
});
