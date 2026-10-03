// types.ts —— 大象模型的 TypeScript 类型定义（对应 recognize.ts 的返回值）
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
  /** 脖子根（靠躯干端，本地坐标）；缺省由网格层按躯干前端推算 */
  neckBaseX?: number;
  neckBaseY?: number;
  /** 头部朝向单位向量（本地坐标 y 向上）；缺省视为朝右上 */
  dirX?: number;
  dirY?: number;
  /** 识别到的耳尖（本地坐标，最多 2 个；缺省/空 = 使用默认大扇耳） */
  earTips?: Vec2[];
  /** 玩家手绘的象鼻中心线（本地坐标，鼻根→鼻尖，约 8 点）；缺省 = 程序化象鼻 */
  trunk?: Vec2[];
  /** 头部是否来自玩家手绘 */
  found?: boolean;
}

export interface TailModel {
  x: number;
  y: number;
  found: boolean;
  /** 尾巴中心线（本地坐标，尾根→尾尖，约 8 点）；缺省/空 = 使用默认尾柱 */
  curve?: Vec2[];
  /** 尾巴横向摆动幅度 0~1 */
  swing?: number;
}

export interface ElephantModel {
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
