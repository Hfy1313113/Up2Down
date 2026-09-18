/* recognize.ts —— 马形识别：从手绘笔画中定位躯干与四条腿，
   并把每条腿转化为「髋关节 + 膝关节」双关节连杆模型。
   纯函数移植自 frontend-legacy/js/recognize.js，无 DOM 依赖。 */
import type { HorseModel, PartStrokes, RawStroke, Stroke, Vec2 } from "./types";

// ---------- 基础几何 ----------
function strokeBBox(pts: Vec2[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0,
           cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function arcLength(pts: Vec2[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

function arcMidpoint(pts: Vec2[]): Vec2 {
  const total = arcLength(pts);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= total / 2) {
      const f = (total / 2 - acc) / (d || 1);
      return [
        pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
      ];
    }
    acc += d;
  }
  return pts[Math.floor(pts.length / 2)].slice() as Vec2;
}

// 按弧长把笔画重采样为 N 个等距点
function resample(pts: Vec2[], N: number): Vec2[] {
  const total = arcLength(pts);
  const step = total / (N - 1);
  const out: Vec2[] = [pts[0].slice() as Vec2];
  let px = pts[0][0], py = pts[0][1];
  let need = step;
  for (let i = 1; i < pts.length && out.length < N; i++) {
    const cx = pts[i][0], cy = pts[i][1];
    let d = Math.hypot(cx - px, cy - py);
    while (d >= need && out.length < N) {
      const f = need / d;
      px += (cx - px) * f;
      py += (cy - py) * f;
      out.push([px, py]);
      d = Math.hypot(cx - px, cy - py);
      need = step;
    }
    need -= d;
    px = cx; py = cy;
  }
  while (out.length < N) out.push([px, py]);
  return out;
}

// 膝关节 = 笔画转向最明显的位置（用户手绘的弯折处）；
// 接近直线时退化为弧长中点
function findKnee(pts: Vec2[]): Vec2 {
  const N = 25;
  const rs = resample(pts, N);
  const h0 = Math.atan2(rs[1][1] - rs[0][1], rs[1][0] - rs[0][0]);
  let maxC = 0;
  const changes: number[] = [];
  for (let i = 1; i < N - 1; i++) {
    const h = Math.atan2(rs[i + 1][1] - rs[i][1], rs[i + 1][0] - rs[i][0]);
    let dh = h - h0;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    changes.push(dh);
    maxC = Math.max(maxC, Math.abs(dh));
  }
  if (maxC < 0.15) return arcMidpoint(pts);
  let idx = changes.findIndex(c => Math.abs(c) > maxC * 0.5);
  if (idx < 0) idx = Math.floor(N / 2);
  idx = Math.max(2, Math.min(N - 3, idx + 1));
  return rs[idx];
}

function pcaAxis(pts: Vec2[]) {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { cx: mx, cy: my, angle };
}

// ---------- 主入口 ----------
// rawStrokes: [{points: [[x,y],...]}, ...]，画布逻辑坐标（y 向下）
// 返回标准化的马模型（本地坐标：x 向右=马头方向，y 向下，脚底 y=0，躯干中心在 y=-bodyH）
function analyze(rawStrokes: RawStroke[]): HorseModel {
  let strokes: Stroke[] = rawStrokes
    .map(s => ({ points: (s.points || []).filter(p => isFinite(p[0]) && isFinite(p[1])) as Vec2[] }))
    .filter(s => s.points.length >= 3 && arcLength(s.points) > 6);

  const fallback = fallbackModel();
  if (strokes.length === 0) return fallback;

  // 全局包围盒
  let g = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const s of strokes) {
    const b = strokeBBox(s.points);
    g.x0 = Math.min(g.x0, b.x0); g.y0 = Math.min(g.y0, b.y0);
    g.x1 = Math.max(g.x1, b.x1); g.y1 = Math.max(g.y1, b.y1);
  }
  const W = g.x1 - g.x0, H = g.y1 - g.y0;
  if (W < 20 || H < 20) return fallback;

  // ---------- 1. 识别四条腿 ----------
  const candidates: { s: Stroke; b: ReturnType<typeof strokeBBox>; len: number; score: number; idx: number }[] = [];
  strokes.forEach((s, idx) => {
    const b = strokeBBox(s.points);
    const len = arcLength(s.points);
    const vertical = b.h > b.w * 1.1;
    const inLower = b.cy > g.y0 + H * 0.42;
    const reachesGround = b.y1 > g.y0 + H * 0.60;
    if (vertical && inLower && reachesGround && len > H * 0.15) {
      const score = (b.h / H) * Math.min(len / (H * 0.4), 1.6);
      candidates.push({ s, b, len, score, idx });
    }
  });
  candidates.sort((a, b) => a.b.cx - b.b.cx);

  let chosen = candidates;
  if (candidates.length > 4) {
    chosen = candidates.slice().sort((a, b) => b.score - a.score).slice(0, 4)
      .sort((a, b) => a.b.cx - b.b.cx);
  }

  const usedIdx = new Set(chosen.map(c => c.idx));

  // 提取每条腿的双关节
  let legs = chosen.map(c => {
    const pts = c.s.points;
    const first = pts[0], last = pts[pts.length - 1];
    let hip: Vec2, foot: Vec2;
    if (first[1] <= last[1]) { hip = first.slice() as Vec2; foot = last.slice() as Vec2; }
    else { hip = last.slice() as Vec2; foot = first.slice() as Vec2; }
    const knee = findKnee(pts);
    return {
      hip, knee, foot,
      L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
      L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
      quality: 1,
      synthesized: false,
    };
  });

  // ---------- 2. 躯干 ----------
  const rest = strokes.filter((_, idx) => !usedIdx.has(idx));
  let torsoStroke: Stroke | null = null, bestW = -1;
  for (const s of rest) {
    const b = strokeBBox(s.points);
    if (b.w > bestW && b.w > W * 0.3) { bestW = b.w; torsoStroke = s; }
  }
  let torso: { cx: number; cy: number; angle: number; len: number; thick: number; found: boolean };
  if (torsoStroke) {
    const axis = pcaAxis(torsoStroke.points);
    const dx = Math.cos(axis.angle), dy = Math.sin(axis.angle);
    let acc = 0;
    for (const [x, y] of torsoStroke.points) {
      acc += Math.abs(-(x - axis.cx) * dy + (y - axis.cy) * dx);
    }
    const halfThick = Math.max(10, Math.min(acc / torsoStroke.points.length * 2.2, H * 0.3));
    let pMin = Infinity, pMax = -Infinity;
    for (const [x, y] of torsoStroke.points) {
      const p = (x - axis.cx) * dx + (y - axis.cy) * dy;
      pMin = Math.min(pMin, p); pMax = Math.max(pMax, p);
    }
    let angle = axis.angle;
    if (Math.abs(Math.sin(angle)) > 0.6) angle = 0;
    torso = {
      cx: axis.cx, cy: axis.cy, angle,
      len: Math.max(pMax - pMin, W * 0.35),
      thick: halfThick * 2,
      found: true,
    };
  } else {
    const hx = legs.map(l => l.hip[0]);
    const cx = (Math.min(...hx) + Math.max(...hx)) / 2;
    torso = {
      cx, cy: g.y0 + H * 0.42, angle: 0,
      len: Math.max(...hx) - Math.min(...hx) + W * 0.28,
      thick: H * 0.3, found: false,
    };
  }

  // 髋部吸附到躯干下缘
  for (const leg of legs) {
    const tx = Math.max(torso.cx - torso.len / 2, Math.min(torso.cx + torso.len / 2, leg.hip[0]));
    leg.hip = [tx, torso.cy + torso.thick * 0.32];
  }

  // 不足 4 条腿 → 合成兜底（速度打折）
  if (legs.length < 4) {
    const existing = legs.map(l => l.hip[0]);
    const x0 = torso.cx - torso.len * 0.38, x1 = torso.cx + torso.len * 0.38;
    const slots = [x0, x0 + (x1 - x0) / 3, x0 + 2 * (x1 - x0) / 3, x1];
    const legLen = H * 0.42;
    for (const sx of slots) {
      if (legs.length >= 4) break;
      if (existing.some(x => Math.abs(x - sx) < torso.len * 0.12)) continue;
      const hip: Vec2 = [sx, torso.cy + torso.thick * 0.32];
      const knee: Vec2 = [sx + legLen * 0.06, hip[1] + legLen / 2];
      const foot: Vec2 = [sx + legLen * 0.1, hip[1] + legLen];
      legs.push({
        hip, knee, foot,
        L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
        L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
        quality: 0.7, synthesized: true,
      });
    }
    legs.sort((a, b) => a.hip[0] - b.hip[0]);
  }

  // ---------- 3. 头/颈 与 尾巴 ----------
  const headStroke = rest.find(s => {
    if (s === torsoStroke) return false;
    const b = strokeBBox(s.points);
    return b.y1 < torso.cy + torso.thick * 0.2 &&
           b.cx > torso.cx && b.cy < torso.cy - torso.thick * 0.1;
  });
  let head: { x: number; y: number; size: number; neckX: number; neckY: number; found: boolean };
  if (headStroke) {
    const b = strokeBBox(headStroke.points);
    head = {
      x: b.cx, y: b.cy, size: Math.max(b.w, b.h) * 0.7,
      neckX: torso.cx + Math.cos(torso.angle) * torso.len * 0.45,
      neckY: torso.cy + Math.sin(torso.angle) * torso.len * 0.45 - torso.thick * 0.3,
      found: true,
    };
  } else {
    head = {
      neckX: torso.cx + Math.cos(torso.angle) * torso.len * 0.48,
      neckY: torso.cy - torso.thick * 0.25,
      x: torso.cx + Math.cos(torso.angle) * torso.len * 0.48 + W * 0.1,
      y: torso.cy - torso.thick * 0.75,
      size: torso.thick * 0.55, found: false,
    };
  }
  const tailStroke = rest.find(s => {
    if (s === torsoStroke || s === headStroke) return false;
    const b = strokeBBox(s.points);
    return b.cx < torso.cx - torso.len * 0.3 && b.cy > torso.cy - torso.thick;
  });
  const tail = tailStroke ? { found: true } : { found: false };

  // ---------- 4. 判断朝向并镜像 ----------
  if (head.x < torso.cx) {
    const mx = torso.cx;
    const mir = (p: Vec2): Vec2 => [2 * mx - p[0], p[1]];
    legs.forEach(l => { l.hip = mir(l.hip); l.knee = mir(l.knee); l.foot = mir(l.foot); });
    head.x = 2 * mx - head.x; head.neckX = 2 * mx - head.neckX;
    legs.sort((a, b) => a.hip[0] - b.hip[0]);
  }

  // ---------- 5. 标准化到本地坐标系 ----------
  const feetY = Math.max(...legs.map(l => l.foot[1]));
  const scale = 120 / Math.max(torso.len, 1);
  const toLocal = (p: Vec2): Vec2 => [(p[0] - torso.cx) * scale, (feetY - p[1]) * scale];

  const model: HorseModel = {
    torso: {
      cx: 0,
      cy: (feetY - torso.cy) * scale,
      angle: -torso.angle,
      len: torso.len * scale,
      thick: Math.max(34, Math.min(56, torso.len * scale * 0.40)),
    },
    legs: legs.map((l, i) => {
      const hip = toLocal(l.hip), knee = toLocal(l.knee), foot = toLocal(l.foot);
      return {
        hip, knee, foot,
        L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
        L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
        quality: l.quality,
        synthesized: l.synthesized,
        type: (i < 2 ? "hind" : "fore") as "hind" | "fore",
      };
    }),
    head: (() => {
      const t = Math.max(34, Math.min(56, torso.len * scale * 0.40));
      const size = Math.max(head.size * scale, t * 0.62);
      return {
        x: (head.x - torso.cx) * scale,
        y: (feetY - head.y) * scale + size * 0.35,
        size: Math.min(size, t * 0.95),
        neckX: (head.neckX - torso.cx) * scale,
        neckY: (feetY - head.neckY) * scale + size * 0.15,
      };
    })(),
    tail: tail.found
      ? { x: 0, y: 0, found: true }
      : { x: -70, y: (feetY - torso.cy) * scale, found: false },
    bodyH: (feetY - torso.cy) * scale,
    quality: legs.reduce((a, l) => a + l.quality, 0) / legs.length,
  };

  // 后腿髋关节略高（马的后躯更高）
  model.legs[0].hip[1] += model.torso.thick * 0.10;
  model.legs[1].hip[1] += model.torso.thick * 0.10;
  return model;
}

function fallbackModel(): HorseModel {
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const x = -45 + i * 30;
    legs.push({
      hip: [x, 78] as Vec2, knee: [x + 3, 40] as Vec2, foot: [x + 6, 0] as Vec2,
      L1: 38, L2: 40, quality: 0.6, synthesized: true,
      type: (i < 2 ? "hind" : "fore") as "hind" | "fore",
    });
  }
  return {
    torso: { cx: 0, cy: 95, angle: 0, len: 120, thick: 46 },
    legs,
    head: { x: 78, y: 140, size: 26, neckX: 55, neckY: 112 },
    bodyH: 95, quality: 0.6,
  };
}

// ---------- 分部位识别 ----------
// parts: { legs: [stroke...], head: [stroke...], butt: [stroke...] }
// 躯干为一条线，由髋部自动生成，无需绘制。
interface RawLeg { hip: Vec2; knee: Vec2; foot: Vec2; L1: number; L2: number; quality: number; synthesized: boolean; }

function analyzeParts(parts: PartStrokes): HorseModel {
  parts = parts || {};
  const legStrokes: Stroke[] = (parts.legs || [])
    .map(s => ({ points: (s.points || []).filter(p => isFinite(p[0]) && isFinite(p[1])) as Vec2[] }))
    .filter(s => s.points.length >= 3 && arcLength(s.points) > 6);
  const headStrokes: Stroke[] = (parts.head || [])
    .map(s => ({ points: (s.points || []).filter(p => isFinite(p[0]) && isFinite(p[1])) as Vec2[] }))
    .filter(s => s.points.length >= 3);
  const buttStrokes: Stroke[] = (parts.butt || [])
    .map(s => ({ points: (s.points || []).filter(p => isFinite(p[0]) && isFinite(p[1])) as Vec2[] }))
    .filter(s => s.points.length >= 3);

  // ---- 腿：直接使用「腿部」画布的笔画，按 x 排序取 4 ----
  let chosen = legStrokes
    .map(s => ({ s, b: strokeBBox(s.points) }))
    .sort((a, b) => a.b.cx - b.b.cx);
  if (chosen.length > 4) {
    chosen = chosen.sort((a, b) => (b.b.h - a.b.h)).slice(0, 4)
      .sort((a, b) => a.b.cx - b.b.cx);
  }
  let legs: RawLeg[] = chosen.map(c => {
    const pts = c.s.points;
    const first = pts[0], last = pts[pts.length - 1];
    let hip: Vec2, foot: Vec2;
    if (first[1] <= last[1]) { hip = first.slice() as Vec2; foot = last.slice() as Vec2; }
    else { hip = last.slice() as Vec2; foot = first.slice() as Vec2; }
    const knee = findKnee(pts);
    return {
      hip, knee, foot,
      L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
      L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
      quality: 1, synthesized: false,
    };
  });

  // ---- 全局参考框 ----
  const all = [...legStrokes, ...headStrokes, ...buttStrokes];
  let g = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  if (all.length) {
    for (const s of all) {
      const b = strokeBBox(s.points);
      g.x0 = Math.min(g.x0, b.x0); g.y0 = Math.min(g.y0, b.y0);
      g.x1 = Math.max(g.x1, b.x1); g.y1 = Math.max(g.y1, b.y1);
    }
  } else {
    g = { x0: 0, y0: 0, x1: 400, y1: 300 };
  }
  const H = Math.max(g.y1 - g.y0, 60);

  // ---- 躯干：由腿髋部 + 屁股/头部位置推出 ----
  let hipXs = legs.map(l => l.hip[0]);
  if (!hipXs.length) hipXs = [g.x0 + (g.x1 - g.x0) * 0.35, g.x0 + (g.x1 - g.x0) * 0.65];
  let rearX = Math.min(...hipXs) - (g.x1 - g.x0) * 0.10;
  let frontX = Math.max(...hipXs) + (g.x1 - g.x0) * 0.18;
  if (buttStrokes.length) {
    let bx = Infinity;
    for (const s of buttStrokes) for (const [x] of s.points) { bx = Math.min(bx, x); }
    rearX = Math.min(rearX, bx - 8);
  }
  let headCx: number | null = null, headCy: number | null = null, headSize = H * 0.22;
  if (headStrokes.length) {
    let sx = 0, sy = 0, n = 0, hb: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (const s of headStrokes) {
      const b = strokeBBox(s.points);
      hb = hb ? {
        x0: Math.min(hb.x0, b.x0), y0: Math.min(hb.y0, b.y0),
        x1: Math.max(hb.x1, b.x1), y1: Math.max(hb.y1, b.y1),
      } : b;
      for (const [x, y] of s.points) { sx += x; sy += y; n++; }
    }
    headCx = sx / n; headCy = sy / n;
    headSize = Math.max((hb as NonNullable<typeof hb>).x1 - (hb as any).x0, (hb as any).y1 - (hb as any).y0) * 0.6;
    frontX = Math.max(frontX, headCx - (headSize || 30) * 0.2);
  }
  const torsoCx = (rearX + frontX) / 2;
  const torsoLen = Math.max(frontX - rearX, 80);
  const thick = H * 0.26;
  const hipMeanY = legs.length
    ? legs.reduce((a, l) => a + l.hip[1], 0) / legs.length
    : g.y0 + H * 0.45;
  const torsoCy = hipMeanY - thick * 0.30;

  // 髋部吸附到躯干下缘
  for (const leg of legs) {
    const tx = Math.max(rearX + torsoLen * 0.08, Math.min(frontX - torsoLen * 0.08, leg.hip[0]));
    leg.hip = [tx, torsoCy + thick * 0.32];
  }
  // 不足 4 条 → 合成兜底
  if (legs.length < 4) {
    const x0 = torsoCx - torsoLen * 0.36, x1 = torsoCx + torsoLen * 0.36;
    const slots = [x0, x0 + (x1 - x0) / 3, x0 + 2 * (x1 - x0) / 3, x1];
    const legLen = H * 0.5;
    for (const sx of slots) {
      if (legs.length >= 4) break;
      if (legs.some(l => Math.abs(l.hip[0] - sx) < torsoLen * 0.12)) continue;
      const hip: Vec2 = [sx, torsoCy + thick * 0.32];
      const knee: Vec2 = [sx + legLen * 0.06, hip[1] + legLen / 2];
      const foot: Vec2 = [sx + legLen * 0.1, hip[1] + legLen];
      legs.push({
        hip, knee, foot,
        L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
        L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
        quality: 0.7, synthesized: true,
      });
    }
    legs.sort((a, b) => a.hip[0] - b.hip[0]);
  }
  const feetY = Math.max(...legs.map(l => l.foot[1]), torsoCy + thick);
  const headX = headCx != null ? headCx : frontX + torsoLen * 0.16;
  const headY = headCy != null ? headCy : torsoCy - thick * 0.8;

  return normalize({
    legs,
    cx: torsoCx,
    feetY,
    torsoCy, torsoLen,
    headX, headY, headSize,
    neckX: frontX - torsoLen * 0.04,
    neckY: torsoCy - thick * 0.2,
    tail: buttStrokes.length ? (() => {
      let bx = Infinity, by = 0, n = 0;
      for (const s of buttStrokes) for (const [x, y] of s.points) { bx = Math.min(bx, x); by += y; n++; }
      return [bx, by / n] as Vec2;
    })() : null,
  });
}

// ---------- 标准化到本地坐标系 ----------
interface NormalizeRaw {
  legs: RawLeg[];
  cx: number;
  feetY: number;
  torsoCy: number;
  torsoLen: number;
  headX: number;
  headY: number;
  headSize: number;
  neckX: number;
  neckY: number;
  tail: Vec2 | null;
}

function normalize(raw: NormalizeRaw): HorseModel {
  const scale = 120 / Math.max(raw.torsoLen, 1);
  const toLocal = (p: Vec2): Vec2 => [(p[0] - raw.cx) * scale, (raw.feetY - p[1]) * scale];
  const t = Math.max(34, Math.min(56, 120 * 0.40));
  const headSize = Math.max(raw.headSize * scale, t * 0.62);
  const model: HorseModel = {
    torso: {
      cx: 0, cy: (raw.feetY - raw.torsoCy) * scale, angle: 0, len: 120, thick: t,
    },
    legs: raw.legs.map((l, i) => {
      const hip = toLocal(l.hip), knee = toLocal(l.knee), foot = toLocal(l.foot);
      return {
        hip, knee, foot,
        L1: Math.hypot(knee[0] - hip[0], knee[1] - hip[1]),
        L2: Math.hypot(foot[0] - knee[0], foot[1] - knee[1]),
        quality: l.quality,
        synthesized: l.synthesized,
        type: (i < 2 ? "hind" : "fore") as "hind" | "fore",
      };
    }),
    head: {
      x: (raw.headX - raw.cx) * scale,
      y: (raw.feetY - raw.headY) * scale + headSize * 0.35,
      size: Math.min(headSize, t * 0.95),
      neckX: (raw.neckX - raw.cx) * scale,
      neckY: (raw.feetY - raw.neckY) * scale + headSize * 0.15,
    },
    tail: raw.tail
      ? { x: (raw.tail[0] - raw.cx) * scale, y: (raw.feetY - raw.tail[1]) * scale, found: true }
      : { x: -70, y: (raw.feetY - raw.torsoCy) * scale, found: false },
    bodyH: (raw.feetY - raw.torsoCy) * scale,
    quality: raw.legs.reduce((a, l) => a + l.quality, 0) / raw.legs.length,
  };
  model.legs[0].hip[1] += model.torso.thick * 0.10;
  model.legs[1].hip[1] += model.torso.thick * 0.10;
  return model;
}

export const Recognize = { analyze, analyzeParts };
