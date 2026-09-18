// horseDraw.ts —— Canvas 2D 马体绘制（移植自 frontend-legacy/js/horse.js 的 Horse.draw），
// 配 Step1 的 gait.ts 使用。仅类型依赖 DOM，无运行期 DOM 依赖。
import { legPoints } from "./gait";
import type { HorseModel, LegModel, Pose, PoseLeg } from "./types";

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

export interface DrawOpts {
  phase?: number;
  showJoints?: boolean;
  jointColor?: string;
}

// 在 (x,y)（蹄部地面线，屏幕坐标 y 向下）以 scale 绘制马
export function drawHorse(
  ctx: CanvasRenderingContext2D,
  model: HorseModel,
  pose: Pose,
  x: number, y: number, scale: number, color: string,
  opts: DrawOpts = {},
): void {
  const T = model.torso;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, -scale);              // 本地 y 向上
  ctx.translate(T.cx, T.cy);
  ctx.rotate(-pose.pitch);
  ctx.translate(-T.cx, -T.cy);
  ctx.translate(0, -pose.bob);

  const dark = shade(color, 0.72);
  const darker = shade(color, 0.5);

  // 远侧腿（略深，先画）
  for (const i of [0, 2]) {
    if (!model.legs[i]) continue;
    drawLeg(ctx, model.legs[i], pose.legs[i], dark, darker, T, false, opts);
  }

  // 尾巴
  const tailSw = Math.sin((opts.phase || 0) * 2 * Math.PI) * 6;
  ctx.strokeStyle = darker;
  ctx.lineWidth = T.thick * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-T.len * 0.5, T.cy + T.thick * 0.1);
  ctx.quadraticCurveTo(-T.len * 0.5 - 18, T.cy - T.thick * 0.3,
    -T.len * 0.5 - 26 + tailSw, T.cy - T.thick * 0.9);
  ctx.stroke();

  // 躯干（胶囊体）
  ctx.save();
  ctx.translate(T.cx, T.cy);
  ctx.rotate(-T.angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = T.thick;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-T.len * 0.5, 0);
  ctx.lineTo(T.len * 0.5, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = T.thick * 0.55;
  ctx.beginPath();
  ctx.moveTo(-T.len * 0.42, -T.thick * 0.18);
  ctx.lineTo(T.len * 0.42, -T.thick * 0.18);
  ctx.stroke();
  ctx.restore();

  // 脖子 + 头
  const H = model.head;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = T.thick * 0.52;
  ctx.beginPath();
  ctx.moveTo(T.len * 0.38, T.cy + T.thick * 0.28);
  ctx.lineTo(H.neckX, H.neckY);
  ctx.stroke();
  ctx.lineWidth = T.thick * 0.42;
  ctx.beginPath();
  ctx.moveTo(H.neckX, H.neckY);
  ctx.lineTo(H.x - H.size * 0.1, H.y - H.size * 0.15);
  ctx.stroke();
  ctx.save();
  ctx.translate(H.x, H.y);
  ctx.rotate(0.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, H.size * 0.62, H.size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = darker;
  ctx.beginPath();
  ctx.ellipse(H.size * 0.42, -H.size * 0.05, H.size * 0.3, H.size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    const ex = H.x - H.size * 0.18, ey = H.y + H.size * 0.32;
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + 5 + s * 4, ey + H.size * 0.42);
    ctx.lineTo(ex + 10 + s * 3, ey + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(H.x + H.size * 0.05, H.y + H.size * 0.18, H.size * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(H.x + H.size * 0.08, H.y + H.size * 0.22, H.size * 0.035, 0, Math.PI * 2); ctx.fill();

  // 近侧腿
  for (const i of [1, 3]) {
    if (!model.legs[i]) continue;
    drawLeg(ctx, model.legs[i], pose.legs[i], color, darker, T, true, opts);
  }

  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  leg: LegModel, poseLeg: PoseLeg,
  color: string, darker: string, T: HorseModel["torso"],
  near: boolean, opts: DrawOpts,
) {
  const { knee, foot } = legPoints(leg, poseLeg);
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = T.thick * 0.34;
  ctx.beginPath();
  ctx.moveTo(leg.hip[0], leg.hip[1]);
  ctx.lineTo(knee[0], knee[1]);
  ctx.stroke();
  ctx.lineWidth = T.thick * 0.25;
  ctx.beginPath();
  ctx.moveTo(knee[0], knee[1]);
  ctx.lineTo(foot[0], foot[1]);
  ctx.stroke();
  const a2 = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
  ctx.save();
  ctx.translate(foot[0], foot[1]);
  ctx.rotate(a2);
  ctx.fillStyle = "#3a2e26";
  ctx.beginPath();
  ctx.ellipse(2.5, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (near || opts.showJoints) {
    const jc = opts.jointColor || "#fff";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(knee[0], knee[1], 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = jc;
    ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(knee[0], knee[1], 1.7, 0, Math.PI * 2); ctx.fill();
  }
}
