// types.ts —— 马模型的 TypeScript 类型定义（对应 recognize.js 的返回值）
export type Vec2 = [number, number];

export interface Stroke {
  points: Vec2[];
}

export interface RawStroke {
  points?: Vec2[];
}

export interface LegModel {
  hip: Vec2;
  knee: Vec2;
  foot: Vec2;
  L1: number;            // 大腿长度
  L2: number;            // 小腿长度
  quality: number;       // 1=手绘，0.7=合成兜底，0.6=完全兜底
  synthesized: boolean;
  type: "hind" | "fore"; // 排序后左两条=后腿，右两条=前腿
}

export interface TorsoModel {
  cx: number;
  cy: number;
  angle: number;
  len: number;
  thick: number;
}

export interface HeadModel {
  x: number;
  y: number;
  size: number;
  neckX: number;
  neckY: number;
}

export interface TailModel {
  x: number;
  y: number;
  found: boolean;
}

export interface HorseModel {
  torso: TorsoModel;
  legs: LegModel[];
  head: HeadModel;
  tail?: TailModel;
  bodyH: number;
  quality: number;
}

export interface PartStrokes {
  legs?: RawStroke[];
  head?: RawStroke[];
  butt?: RawStroke[];
}

export interface PoseLeg {
  thigh: number;
  fold: number;
}

export interface Pose {
  legs: PoseLeg[];
  pitch: number;
  bob: number;
}

export interface Metrics {
  speed: number;    // 像素/秒
  cadence: number;  // 步/秒
  quality: number;
}
