// 风格包：草稿纸经典 —— 项目最初的手绘线框工作台质感：纯色大象、草地跑道、
// 头盔驭象师、合成音效与芯片音乐。同时作为「任何风格包加载失败」时的保底形态。
import { defineStylePack } from "../../types";

export default defineStylePack({
  id: "classic",
  name: "草稿纸经典",
  tagline: "线框工作台、草地跑道、纯色抽象",
  swatch: ["#e2703a", "#233140", "#6fbf58", "#6ec1f5", "#fcfbf7"],
  playerColors: ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"],

  elephant: {
    torso: { color: "$player", roughness: 0.85 },
    head: { color: "$player", roughness: 0.85 },
    trunk: { color: "$player", roughness: 0.85 },
    ear: { color: "$player", roughness: 0.9 },
    tusk: { color: "#f5efe0", roughness: 0.4 },
    thigh: { color: "$player", roughness: 0.85 },
    shin: { color: "$player", roughness: 0.85 },
    foot: { color: "#3a2e26", roughness: 1 },
    toenail: { color: "#e9e2cf", roughness: 0.5 },
    tail: { color: "$player", roughness: 0.9 },
    blanket: { color: "#221c18", roughness: 0.9 },
    eye: { color: "#222222", roughness: 0.4 },
  },

  rider: {
    materials: {
      skin: { color: "#ffcaa0", roughness: 0.7 },
      hair: { color: "#2b1d14", roughness: 0.9 },
      headwear: { color: "$player", roughness: 0.4 },
      jewel: { color: "#111111", roughness: 0.3 },
      jacket: { color: "#ffffff", roughness: 0.6 },
      pants: { color: "#334155", roughness: 0.8 },
      boots: { color: "#1a1614", roughness: 0.5 },
      whipStick: { color: "#2d1810", roughness: 0.6 },
      whipLash: { color: "#e88024", roughness: 0.8 },
    },
    accessories: ["helmet", "visor"],
  },

  environment: {
    sky: "#6ec1f5",
    fog: { color: "#bfe6ff", near: 60, far: 240 },
    lights: { hemiSky: "#dff3ff", hemiGround: "#5da84a", hemiIntensity: 1.1, sunColor: "#fff4d6", sunIntensity: 1.4, sunPosition: [40, 80, 30] },
    ground: { color: "#6fbf58", roughness: 1 },
    lane: { color: "#8fce6e", roughness: 1 },
    fence: { color: "#a5713f", roughness: 0.9 },
    gate: {
      pole: { color: "#e2703a" },
      bannerColors: ["#111111", "#ffffff"],
      cannon: { color: "#f59e0b", metalness: 0.6, roughness: 0.3 },
    },
    confettiColors: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#fbbf24"],
    clouds: { color: "#ffffff", count: 14 },
    props: [
      { kind: "roundTree", count: 10, side: "both", offset: 22, jitter: 6, scale: 1.0, seed: 1,
        materials: { trunk: { color: "#8b5a2b" }, leaf: { color: "#3f9b4a" } } },
      { kind: "rock", count: 8, side: "both", offset: 15, jitter: 3, scale: 0.8, seed: 2, materials: { rock: { color: "#9aa3ad" } } },
    ],
  },

  birth: {
    disc: { color: "#e8d9b0", roughness: 0.9 },
    ring: "#e2703a",
    backdrop: "linear-gradient(180deg, #dae7f2 0%, #edf4f9 100%)",
    lights: { hemiSky: "#eaf6ff", hemiGround: "#8a6f55", keyColor: "#fff4d6" },
  },

  ui: {
    accent: "#e2703a",
    accentHover: "#d4632f",
    ink: "#233140",
    paper: "#ffffff",
    bg: "#e4edf3",
    bgPattern: "radial-gradient(#b8c9d6 1.2px, transparent 1.2px), linear-gradient(#dce8f0, #e8f0f6)",
    go: "#2ea043",
    goHover: "#278839",
    canvasPaper: "#fcfbf7",
    canvasGrid: "rgba(180, 170, 155, 0.28)",
  },

  music: {
    race: {
      volume: 0.7,
      procedural: {
        bpm: 150,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K.h.S.h.K.h.S.hh" + "K.h.S.h.K.hKS.SS",
        melody: [0, 4, 7, 4, 0, 4, 7, 9, 5, 9, 12, 9, 5, 9, 12, 14, 7, 11, 14, 11, 7, 11, 14, 16, 12, 11, 9, 7, 5, 4, 2, 0],
        bass: [0, 0, 7, 0, 5, 5, 12, 5, 7, 7, 14, 7, 5, 4, 2, 0],
        melodyInstrument: "square",
        bassInstrument: "bass",
        gain: 0.8,
      },
    },
    menu: {
      volume: 0.45,
      procedural: {
        bpm: 100,
        root: 261.6,
        scale: [0, 2, 4, 5, 7, 9, 11],
        drums: "K...h...S...h...",
        melody: [0, -100, 4, -100, 7, -100, 4, -100, 2, -100, 5, -100, 9, -100, 5, -100, 4, -100, 7, -100, 11, -100, 7, -100, 0, -100, -100, -100, -100, -100, -100, -100],
        bass: [0, -100, -100, -100, 5, -100, -100, -100, 7, -100, -100, -100, 0, -100, -100, -100],
        melodyInstrument: "pluck",
        bassInstrument: "drone",
        gain: 0.6,
      },
    },
  },

  sfx: {
    whip: { synth: "whipCrack" },
    impact: { synth: "thud" },
    fanfare: { synth: "brassFanfare" },
    blast: { synth: "boom" },
    buckedOff: { synth: "slideWhistle" },
    countdown: { synth: "tick" },
    go: { synth: "goBlast" },
    uiTap: { synth: "click" },
  },
});
