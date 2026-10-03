// style/types.ts —— 风格包（StylePack）契约：只描述「有什么」，不描述「怎么画」。
// 渲染机制（three 场景、材质解析、音频播放）只认这份契约；任何新风格只需在
// src/style/packs/<id>/index.ts 里导出一个满足 StylePack 的对象即可被自动发现。

// ---------- 纹理 ----------
/** 程序化纹理配方：由 materials.ts 在运行时画到 Canvas 上，零资源下载 */
export type ProceduralRecipe =
  | { type: "solid"; color: string }
  | { type: "stripes"; colors: string[]; width?: number; angle?: number }
  | { type: "spots"; base: string; spot: string; density?: number; radius?: number; seed?: number }
  | { type: "noise"; base: string; tint: string; scale?: number; strength?: number; seed?: number }
  | { type: "wrinkle"; base: string; line: string; density?: number; seed?: number }
  | { type: "checker"; colors: [string, string]; size?: number }
  | { type: "paisley"; base: string; ink: string; accent: string; seed?: number }
  | { type: "mandala"; base: string; ink: string; accent: string; rings?: number }
  | { type: "grid"; base: string; line: string; size?: number }
  | { type: "fringe"; base: string; fringe: string; count?: number }
  /** 沥青路面：u 方向为行车方向；实线路缘 + 车道间虚线（lanes 条车道），dash 为虚线占比 */
  | { type: "road"; base: string; line: string; edge?: string; lanes?: number; dash?: number; seed?: number }
  /**
   * 卡通脸：画在驭象师头球的正前方（+x）。mood 决定情绪档（平静 / 怒视 / 咬牙冒汗）；
   * variant 决定长相（0 闷闷 / 1 八字胡 / 2 乐呵 / 3 困倦），写 "$player" 则按玩家序号轮选，用于区分不同玩家；
   * skin 可给数组，同样按玩家序号取色。
   */
  | { type: "face"; skin: string | string[]; ink: string; mood: "calm" | "angry" | "grit"; variant?: number | "$player"; mouth?: string; sweat?: string }
  /** 圆形标牌 / 车牌：底色 + 环 + 居中文字（限速牌、车牌号等） */
  | { type: "label"; base: string; ink: string; text: string; ring?: string; shape?: "circle" | "rect" };

export type TextureSpec =
  | { kind: "image"; url: string }
  | { kind: "procedural"; recipe: ProceduralRecipe; size?: 128 | 256 | 512 };

/** 材质描述；color 可写 "$player" 表示使用该玩家的身份强调色 */
export interface MaterialSpec {
  color?: string;
  texture?: TextureSpec;
  /** 纹理平铺次数 [u, v]，默认 [1, 1] */
  repeat?: [number, number];
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** 不受光照（MeshBasicMaterial），用于霓虹/描边等 */
  unlit?: boolean;
  opacity?: number;
}

// ---------- 大象与驭象师 ----------
export const ELEPHANT_SLOTS = [
  "torso", "head", "trunk", "ear", "tusk", "thigh", "shin", "foot", "toenail", "tail", "blanket", "eye",
] as const;
export type ElephantSlot = (typeof ELEPHANT_SLOTS)[number];
export type ElephantSkin = Record<ElephantSlot, MaterialSpec>;
/** 大象附件（车件）：几何由 elephantMesh 的附件库实现；风格包只声明挂哪些、可逐槽覆盖材质 */
export const ELEPHANT_ACCESSORIES = ["headlights", "taillights", "mirrors", "plate", "hubcaps", "bumper"] as const;
export type ElephantAccessory = (typeof ELEPHANT_ACCESSORIES)[number];
export interface ElephantAccessorySpec {
  kind: ElephantAccessory;
  /** 覆盖该附件内部材质槽位（槽位名由附件库定义，如 lamp / signal / tailLamp / chrome / plate / tire） */
  materials?: Record<string, MaterialSpec>;
}

export const RIDER_SLOTS = [
  "skin", "hair", "headwear", "jewel", "jacket", "pants", "boots", "whipStick", "whipLash",
] as const;
export type RiderSlot = (typeof RIDER_SLOTS)[number];
/** 附件几何由 elephantMesh 的附件库实现；风格包只列出要挂哪些 */
export const RIDER_ACCESSORIES = [
  "turban", "helmet", "visor", "cap", "plume", "mustache", "beard", "bindi", "sash",
  "curlyHair", "seat", "steeringWheel",
] as const;
export type RiderAccessory = (typeof RIDER_ACCESSORIES)[number];
/**
 * 驭象师脸部材质（可选）：calm 为常态；tense / furious 在连点加速强度升高时依次切换
 * （未提供的档位沿用上一档；整体缺省则头部用 skin 材质）。
 */
export interface RiderFaceSpec {
  calm: MaterialSpec;
  tense?: MaterialSpec;
  furious?: MaterialSpec;
}
export interface RiderOutfit {
  materials: Record<RiderSlot, MaterialSpec>;
  accessories: RiderAccessory[];
  face?: RiderFaceSpec;
}

// ---------- 赛道环境 ----------
/** 装饰物由 three/props.ts 的装饰库实现；风格包只声明种类、数量、分布与材质 */
export const PROP_KINDS = [
  "palm", "roundTree", "bush", "rock", "temple", "torana", "bunting", "lantern", "lamppost", "flag", "mountain",
  "hill", "highwayLamp", "roadSign", "boxCar", "boxTruck",
] as const;
export type PropKind = (typeof PROP_KINDS)[number];
export interface PropSpec {
  kind: PropKind;
  /** 沿赛道放置的数量（两侧合计） */
  count: number;
  side?: "both" | "left" | "right";
  /** 距离跑道中线的横向偏移（世界单位） */
  offset?: number;
  /** 横向随机抖动 */
  jitter?: number;
  scale?: number;
  seed?: number;
  /** 覆盖该装饰物内部材质槽位（槽位名由装饰库定义） */
  materials?: Record<string, MaterialSpec>;
}

export interface EnvironmentSpec {
  sky: { top: string; bottom: string } | string;
  fog: { color: string; near: number; far: number };
  lights: {
    hemiSky: string; hemiGround: string; hemiIntensity: number;
    sunColor: string; sunIntensity: number; sunPosition?: [number, number, number];
  };
  ground: MaterialSpec;
  lane: MaterialSpec;
  fence: MaterialSpec;
  gate: { pole: MaterialSpec; bannerColors: [string, string]; cannon: MaterialSpec };
  confettiColors: string[];
  clouds?: { color: string; count: number } | null;
  props: PropSpec[];
}

// ---------- 诞生展台 ----------
export interface BirthStageSpec {
  disc: MaterialSpec;
  ring: string;
  /** 展台容器的 CSS background */
  backdrop: string;
  lights: { hemiSky: string; hemiGround: string; keyColor: string };
}

// ---------- 2D 界面配色（写入 CSS 变量） ----------
export interface UiTheme {
  accent: string;
  accentHover: string;
  ink: string;
  paper: string;
  bg: string;
  /** body 的 background-image */
  bgPattern: string;
  go: string;
  goHover: string;
  canvasPaper: string;
  canvasGrid: string;
}

// ---------- 音乐与音效 ----------
export type Instrument = "pluck" | "lead" | "drone" | "bass" | "bell" | "square";
export interface ProceduralTrack {
  bpm: number;
  /** 根音（Hz） */
  root: number;
  /** 音阶半音偏移，如 [0,1,4,5,7,8,11] */
  scale: number[];
  /** 鼓机：每拍 4 个十六分音符；字符 K/S/H/T/t/.（底鼓/军鼓/踩镲/高音鼓/低音鼓/休止） */
  drums: string;
  /** 旋律：音阶度数（从 0 起，可用负数或 7+ 跨八度），-100 表示休止；每项占一个八分音符 */
  melody: number[];
  bass: number[];
  melodyInstrument: Instrument;
  bassInstrument: Instrument;
  drone?: boolean;
  swing?: number;
  gain?: number;
}
export interface TrackSpec {
  /** 音频文件 URL（相对站点根）；加载失败或缺失时回落到 procedural */
  file?: string;
  procedural?: ProceduralTrack;
  volume?: number;
  /**
   * 文件曲目的循环淡变时长（秒，默认 2.5）：每遍播放结尾渐出；从第二遍起开头渐入。
   * 第一遍开头不渐入。程序化乐谱是无缝循环，不受此项影响。
   */
  fadeSec?: number;
}
export interface MusicSpec {
  race: TrackSpec;
  menu?: TrackSpec;
  birth?: TrackSpec;
}

export const SFX_IDS = ["whip", "impact", "fanfare", "blast", "buckedOff", "countdown", "go", "uiTap"] as const;
export type SfxId = (typeof SFX_IDS)[number];
/** 合成预设由 audio/sfx.ts 的预设库实现 */
export const SYNTH_PRESETS = [
  "whipCrack", "dholHit", "tablaTak", "thud", "brassFanfare", "shehnaiFanfare", "boom", "slideWhistle",
  "trumpetTrunk", "tick", "goBlast", "click",
  "hornHonk", "engineRev", "tireScreech", "crash",
] as const;
export type SynthPreset = (typeof SYNTH_PRESETS)[number];
export interface SfxSpec {
  file?: string;
  synth?: SynthPreset;
  gain?: number;
}

// ---------- 风格包 ----------
export interface StylePack {
  id: string;
  name: string;
  tagline: string;
  /** 大厅选择器色带 */
  swatch: string[];
  /** 四位玩家的身份强调色 */
  playerColors: [string, string, string, string];
  elephant: ElephantSkin;
  /** 大象附件（车灯 / 后视镜 / 车牌 / 轮胎脚 / 保险杠……），缺省为空 */
  elephantAccessories?: ElephantAccessorySpec[];
  rider: RiderOutfit;
  environment: EnvironmentSpec;
  birth: BirthStageSpec;
  ui: UiTheme;
  music: MusicSpec;
  sfx: Partial<Record<SfxId, SfxSpec>>;
}

/** 类型辅助：让风格包文件在编写时就获得完整类型提示 */
export function defineStylePack(pack: StylePack): StylePack {
  return pack;
}
