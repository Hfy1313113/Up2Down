// style/materials.ts —— 材质解析机制：MaterialSpec → THREE.Material。
// 程序化纹理在此由配方画到 Canvas（按配方缓存一次），图片纹理走 TextureLoader；
// 任一纹理失败都回落到纯色。材质在解析器内共享与统一释放，网格层不再各自 dispose 材质。
import * as THREE from "three";
import type { MaterialSpec, ProceduralRecipe, TextureSpec } from "./types";

/** 确定性伪随机（配方 seed 相同 → 纹理相同） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FACE_VARIANTS = 4;
/** 脸配方的长相序号：variant 为 "$player" 时按玩家序号轮选 */
export function faceVariant(recipe: Extract<ProceduralRecipe, { type: "face" }>, playerIndex: number): number {
  const v = recipe.variant === "$player" ? playerIndex : (recipe.variant ?? 0);
  return ((Math.floor(v) % FACE_VARIANTS) + FACE_VARIANTS) % FACE_VARIANTS;
}
/** 配方是否按玩家序号（而非仅玩家色）变化：这类纹理与材质的缓存键要带上序号 */
export function recipeUsesIndex(recipe: ProceduralRecipe): boolean {
  return recipe.type === "face" && (recipe.variant === "$player" || Array.isArray(recipe.skin));
}

/** 把配方画到 canvas；纯函数式：同配方同尺寸同输出 */
export function paintRecipe(ctx: CanvasRenderingContext2D, size: number, recipe: ProceduralRecipe, player: string, playerIndex = 0): void {
  const sub = (c: string) => (c === "$player" ? player : c);
  const rand = mulberry32(("seed" in recipe && recipe.seed) || 1);
  ctx.clearRect(0, 0, size, size);
  switch (recipe.type) {
    case "solid": {
      ctx.fillStyle = sub(recipe.color);
      ctx.fillRect(0, 0, size, size);
      break;
    }
    case "stripes": {
      const colors = recipe.colors.map(sub);
      const w = recipe.width ?? 16;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(((recipe.angle ?? 0) * Math.PI) / 180);
      const n = Math.ceil((size * 1.5) / w) + 2;
      for (let i = -n; i < n; i++) {
        ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
        ctx.fillRect(i * w, -size, w, size * 2);
      }
      ctx.restore();
      break;
    }
    case "spots": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = sub(recipe.spot);
      const n = Math.round((recipe.density ?? 1) * 40);
      const r = (recipe.radius ?? 0.05) * size;
      for (let i = 0; i < n; i++) {
        const x = rand() * size, y = rand() * size, rr = r * (0.6 + rand() * 0.8);
        for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
          ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case "noise": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      const cell = Math.max(2, Math.floor(size / ((recipe.scale ?? 8) * 8)));
      const strength = recipe.strength ?? 0.4;
      ctx.fillStyle = sub(recipe.tint);
      for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
          ctx.globalAlpha = rand() * strength;
          ctx.fillRect(x, y, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "wrinkle": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = sub(recipe.line);
      ctx.lineCap = "round";
      const n = Math.round((recipe.density ?? 1) * 60);
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = 0.25 + rand() * 0.4;
        ctx.lineWidth = 1 + rand() * 2.2;
        const x = rand() * size, y = rand() * size, len = size * (0.08 + rand() * 0.22);
        const ang = (rand() - 0.5) * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5 * Math.cos(ang), y + len * 0.5 * Math.sin(ang) + (rand() - 0.5) * 8, x + len * Math.cos(ang), y + len * Math.sin(ang));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "checker": {
      const s = recipe.size ?? 32;
      for (let y = 0; y < size; y += s) {
        for (let x = 0; x < size; x += s) {
          ctx.fillStyle = sub(recipe.colors[((x / s + y / s) % 2) | 0]);
          ctx.fillRect(x, y, s, s);
        }
      }
      break;
    }
    case "grid": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = sub(recipe.line);
      ctx.lineWidth = 2;
      const s = recipe.size ?? 32;
      for (let i = 0; i <= size; i += s) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
      break;
    }
    case "paisley": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      const ink = sub(recipe.ink), accent = sub(recipe.accent);
      const cell = size / 4;
      for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          const cx = gx * cell + cell / 2 + (gy % 2 ? cell / 2 : 0), cy = gy * cell + cell / 2;
          const r = cell * 0.3;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((gx + gy) % 2 ? 0.6 : -0.6);
          // 泪滴形
          ctx.fillStyle = ink;
          ctx.beginPath();
          ctx.moveTo(0, -r * 1.4);
          ctx.bezierCurveTo(r * 1.2, -r * 0.6, r * 1.0, r * 1.0, 0, r);
          ctx.bezierCurveTo(-r * 1.0, r * 1.0, -r * 1.2, -r * 0.6, 0, -r * 1.4);
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = Math.max(1.5, size / 128);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.9);
          ctx.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.6, r * 0.6, 0, r * 0.6);
          ctx.bezierCurveTo(-r * 0.6, r * 0.6, -r * 0.7, -r * 0.4, 0, -r * 0.9);
          ctx.stroke();
          ctx.fillStyle = accent;
          for (let k = 0; k < 5; k++) {
            ctx.beginPath(); ctx.arc(Math.cos(k * 1.26) * r * 0.45, Math.sin(k * 1.26) * r * 0.45, r * 0.08, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }
      // 散点
      ctx.fillStyle = accent;
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(rand() * size, rand() * size, size * 0.006, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "mandala": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      const ink = sub(recipe.ink), accent = sub(recipe.accent);
      const cx = size / 2, cy = size / 2, rings = recipe.rings ?? 5;
      ctx.lineWidth = Math.max(1.5, size / 160);
      for (let k = 1; k <= rings; k++) {
        const r = (size * 0.46 * k) / rings;
        ctx.strokeStyle = k % 2 ? ink : accent;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        const petals = 6 + k * 2;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
          ctx.fillStyle = k % 2 ? accent : ink;
          ctx.beginPath();
          ctx.ellipse(px, py, size * 0.03, size * 0.015, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.04, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "fringe": {
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = sub(recipe.fringe);
      const n = recipe.count ?? 16, w = size / n;
      for (let i = 0; i < n; i++) ctx.fillRect(i * w + w * 0.2, size * 0.7, w * 0.6, size * 0.3);
      break;
    }
    case "road": {
      // 沥青路面：画布 x 为行车方向（跑道平面的 u 轴），实线路缘在上下边，车道间虚线水平排布；
      // 细碎白点模拟沥青颗粒
      ctx.fillStyle = sub(recipe.base);
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < size * 1.2; i++) {
        ctx.globalAlpha = rand() * 0.07;
        ctx.fillRect(rand() * size, rand() * size, 2, 2);
      }
      ctx.globalAlpha = 1;
      const lanes = Math.max(1, Math.round(recipe.lanes ?? 2));
      const lw = Math.max(2, size * 0.022);
      ctx.fillStyle = sub(recipe.edge ?? recipe.line);
      ctx.fillRect(0, size * 0.035, size, lw);
      ctx.fillRect(0, size * 0.965 - lw, size, lw);
      ctx.fillStyle = sub(recipe.line);
      const dash = Math.min(0.9, Math.max(0.1, recipe.dash ?? 0.5));
      for (let k = 1; k < lanes; k++) {
        ctx.fillRect(size * (0.5 - dash / 2), (size * k) / lanes - lw / 2, size * dash, lw);
      }
      break;
    }
    case "face": {
      // 卡通脸贴在球面 u=0.5（+x，驭象师正前方）附近；画布上方对应头顶。
      // 五官集中在横向 ±8%（球面约 ±29°）、纵向 40%~66%（眉在赤道上方、嘴在赤道下方）。
      // variant 决定长相，mood 决定情绪档；颜色数组按玩家序号取。
      const v = faceVariant(recipe, playerIndex);
      const skins = Array.isArray(recipe.skin) ? recipe.skin : [recipe.skin];
      ctx.fillStyle = sub(skins[((playerIndex % skins.length) + skins.length) % skins.length]);
      ctx.fillRect(0, 0, size, size);
      const ink = sub(recipe.ink);
      const s = size, cx = s * 0.5;
      const eyeDx = s * 0.078;
      const browY = s * 0.40, eyeY = s * 0.47, noseY = s * 0.555, mouthY = s * 0.655;
      const mood = recipe.mood;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const stroke = (w: number, draw: () => void) => { ctx.lineWidth = w; ctx.beginPath(); draw(); ctx.stroke(); };
      const fill = (draw: () => void) => { ctx.beginPath(); draw(); ctx.fill(); };

      // ---- 眉毛 ----
      for (const sd of [-1, 1]) {
        const x = cx + sd * eyeDx;
        if (mood !== "calm") {
          // 怒视 / 咬牙：眉头压向鼻梁、眉尾上扬；咬牙更粗并加两道皱纹
          stroke(mood === "grit" ? s * 0.03 : s * 0.022, () => {
            ctx.moveTo(x - sd * s * 0.036, browY - s * 0.024);
            ctx.lineTo(x + sd * s * 0.032, browY + s * 0.018);
          });
          if (mood === "grit") {
            stroke(s * 0.006, () => { ctx.moveTo(x - sd * s * 0.055, browY - s * 0.045); ctx.lineTo(x - sd * s * 0.04, browY - s * 0.028); });
            stroke(s * 0.006, () => { ctx.moveTo(x - sd * s * 0.07, browY - s * 0.03); ctx.lineTo(x - sd * s * 0.052, browY - s * 0.016); });
          }
          continue;
        }
        switch (v) {
          case 0:   // 闷闷：短粗眉，外侧微垂
            stroke(s * 0.02, () => { ctx.moveTo(x - sd * s * 0.026, browY - s * 0.004); ctx.lineTo(x + sd * s * 0.026, browY + s * 0.012); });
            break;
          case 1:   // 八字胡：细长微拱眉
            stroke(s * 0.011, () => { ctx.moveTo(x - sd * s * 0.045, browY + s * 0.006); ctx.quadraticCurveTo(x, browY - s * 0.02, x + sd * s * 0.045, browY + s * 0.004); });
            break;
          case 2:   // 乐呵：短短的拱形眉
            stroke(s * 0.016, () => { ctx.moveTo(x - sd * s * 0.03, browY + s * 0.006); ctx.quadraticCurveTo(x, browY - s * 0.016, x + sd * s * 0.03, browY + s * 0.006); });
            break;
          default:  // 困倦：粗重眉条
            stroke(s * 0.03, () => { ctx.moveTo(x - sd * s * 0.04, browY + s * 0.002); ctx.lineTo(x + sd * s * 0.036, browY + s * 0.004); });
        }
      }

      // ---- 眼睛 ----
      for (const sd of [-1, 1]) {
        const x = cx + sd * eyeDx;
        if (v === 3 && mood === "calm") {
          // 困倦：眯成一道横线 + 眼袋小钩
          stroke(s * 0.012, () => { ctx.moveTo(x - s * 0.02, eyeY); ctx.lineTo(x + s * 0.02, eyeY); });
          stroke(s * 0.008, () => { ctx.moveTo(x + sd * s * 0.004, eyeY + s * 0.004); ctx.lineTo(x + sd * s * 0.004, eyeY + s * 0.02); ctx.lineTo(x + sd * s * 0.018, eyeY + s * 0.02); });
        } else if (mood === "grit") {
          // 咬牙：眼睛眯成竖点 + 下眼睑线
          fill(() => ctx.ellipse(x, eyeY, s * 0.009, s * 0.014, 0, 0, Math.PI * 2));
          stroke(s * 0.006, () => { ctx.moveTo(x - s * 0.018, eyeY + s * 0.024); ctx.lineTo(x + s * 0.018, eyeY + s * 0.024); });
        } else {
          const r = v === 2 ? s * 0.009 : s * 0.011;
          fill(() => ctx.ellipse(x, eyeY, r, r * 1.4, 0, 0, Math.PI * 2));
        }
      }

      // ---- 鼻子 ----
      if (v === 1) {
        // 大鼻头带鼻翼
        stroke(s * 0.012, () => {
          ctx.moveTo(cx - s * 0.04, noseY - s * 0.006);
          ctx.quadraticCurveTo(cx - s * 0.03, noseY + s * 0.022, cx, noseY + s * 0.02);
          ctx.quadraticCurveTo(cx + s * 0.03, noseY + s * 0.022, cx + s * 0.04, noseY - s * 0.006);
        });
      } else {
        stroke(s * 0.012, () => { ctx.moveTo(cx - s * 0.03, noseY); ctx.quadraticCurveTo(cx, noseY + s * 0.02, cx + s * 0.03, noseY); });
      }
      if (mood === "grit") {
        // 鼻梁皱纹
        for (const dy of [-0.03, -0.018]) stroke(s * 0.006, () => { ctx.moveTo(cx - s * 0.02, noseY + s * dy); ctx.lineTo(cx + s * 0.02, noseY + s * dy - s * 0.004); });
      }

      // ---- 八字胡（长相 1 常驻） ----
      const mustache = v === 1;
      if (mustache) {
        fill(() => {
          ctx.moveTo(cx - s * 0.085, mouthY - s * 0.028);
          ctx.quadraticCurveTo(cx, mouthY - s * 0.062, cx + s * 0.085, mouthY - s * 0.028);
          ctx.quadraticCurveTo(cx + s * 0.04, mouthY - s * 0.012, cx, mouthY - s * 0.024);
          ctx.quadraticCurveTo(cx - s * 0.04, mouthY - s * 0.012, cx - s * 0.085, mouthY - s * 0.028);
        });
      }

      // ---- 嘴 ----
      const my = mustache ? mouthY + s * 0.016 : mouthY;
      if (mood === "grit") {
        // 咬牙：白牙块 + 中缝 + 两道牙缝
        ctx.fillStyle = "#ffffff";
        fill(() => ctx.roundRect(cx - s * 0.08, my - s * 0.03, s * 0.16, s * 0.06, s * 0.022));
        ctx.strokeStyle = ink;
        stroke(s * 0.01, () => ctx.roundRect(cx - s * 0.08, my - s * 0.03, s * 0.16, s * 0.06, s * 0.022));
        stroke(s * 0.008, () => { ctx.moveTo(cx - s * 0.08, my); ctx.lineTo(cx + s * 0.08, my); });
        for (const dx of [-0.04, 0.04]) stroke(s * 0.005, () => { ctx.moveTo(cx + s * dx, my - s * 0.02); ctx.lineTo(cx + s * dx, my + s * 0.02); });
        ctx.fillStyle = ink;
      } else if (mood === "angry") {
        // 怒视：张开的深色嘴
        ctx.fillStyle = sub(recipe.mouth ?? (v === 3 ? "#b3261e" : "#5a1a12"));
        fill(() => ctx.ellipse(cx, my + s * 0.006, s * 0.055, s * 0.026, 0, 0, Math.PI * 2));
        ctx.fillStyle = ink;
      } else {
        switch (v) {
          case 1:   // 八字胡：胡子下一张微张的小嘴
            ctx.fillStyle = sub(recipe.mouth ?? "#5a1a12");
            fill(() => ctx.ellipse(cx, my + s * 0.004, s * 0.03, s * 0.012, 0, 0, Math.PI * 2));
            ctx.fillStyle = ink;
            break;
          case 2:   // 乐呵：小小的 D 形笑嘴
            ctx.fillStyle = sub(recipe.mouth ?? "#8a2a1e");
            fill(() => { ctx.moveTo(cx - s * 0.03, my - s * 0.006); ctx.lineTo(cx + s * 0.03, my - s * 0.006); ctx.quadraticCurveTo(cx, my + s * 0.04, cx - s * 0.03, my - s * 0.006); });
            stroke(s * 0.006, () => { ctx.moveTo(cx - s * 0.03, my - s * 0.006); ctx.lineTo(cx + s * 0.03, my - s * 0.006); });
            ctx.fillStyle = ink;
            break;
          case 3:   // 困倦：红色下弯月牙嘴
            ctx.fillStyle = sub(recipe.mouth ?? "#b3261e");
            fill(() => { ctx.moveTo(cx - s * 0.05, my + s * 0.012); ctx.quadraticCurveTo(cx, my - s * 0.03, cx + s * 0.05, my + s * 0.012); ctx.quadraticCurveTo(cx, my - s * 0.004, cx - s * 0.05, my + s * 0.012); });
            ctx.fillStyle = ink;
            break;
          default:  // 闷闷：嘴角向下的「不爽」弧
            stroke(s * 0.012, () => { ctx.moveTo(cx - s * 0.05, my + s * 0.012); ctx.quadraticCurveTo(cx, my - s * 0.02, cx + s * 0.05, my + s * 0.012); });
        }
      }

      // ---- 汗滴（给定颜色即画在右额） ----
      if (recipe.sweat) {
        ctx.fillStyle = sub(recipe.sweat);
        const sx = cx + s * 0.15, sy = s * 0.44;
        fill(() => {
          ctx.moveTo(sx, sy - s * 0.032);
          ctx.quadraticCurveTo(sx + s * 0.026, sy + s * 0.012, sx, sy + s * 0.024);
          ctx.quadraticCurveTo(sx - s * 0.026, sy + s * 0.012, sx, sy - s * 0.032);
        });
      }
      break;
    }
    case "label": {
      // 圆牌（圆柱端面 UV 为整幅贴图）或矩形牌：底色 + 环/边框 + 居中文字
      const circle = (recipe.shape ?? "circle") === "circle";
      ctx.fillStyle = sub(recipe.base);
      if (circle) { ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(0, 0, size, size);
      if (recipe.ring) {
        ctx.strokeStyle = sub(recipe.ring);
        ctx.lineWidth = size * 0.09;
        if (circle) { ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2); ctx.stroke(); }
        else ctx.strokeRect(size * 0.045, size * 0.045, size * 0.91, size * 0.91);
      }
      ctx.fillStyle = sub(recipe.ink);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = recipe.text;
      const fontPx = Math.min(size * 0.5, (size * (circle ? 0.6 : 0.86)) / Math.max(1, text.length * 0.62));
      ctx.font = `bold ${fontPx}px sans-serif`;
      ctx.fillText(text, size / 2, size / 2 + fontPx * 0.05);
      break;
    }
  }
}

/** 稳定的缓存键：配方 + 玩家色 */
export function recipeKey(recipe: ProceduralRecipe, size: number, player: string): string {
  return `${size}|${player}|${JSON.stringify(recipe)}`;
}

export function specUsesPlayer(spec: MaterialSpec): boolean {
  if (spec.color === "$player") return true;
  const t = spec.texture;
  return !!t && t.kind === "procedural" && JSON.stringify(t.recipe).includes("$player");
}

/**
 * 材质解析器：一个场景一个实例。按「材质描述 + 玩家色」缓存，场景销毁时统一释放。
 */
export class MaterialResolver {
  private materials = new Map<string, THREE.Material>();
  private textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private playerColors: readonly string[];

  constructor(playerColors: readonly string[]) {
    this.playerColors = playerColors;
  }

  playerColor(index: number): string {
    return this.playerColors[((index % this.playerColors.length) + this.playerColors.length) % this.playerColors.length];
  }

  /** 解析材质；playerIndex 决定 "$player" 取哪一色 */
  get(spec: MaterialSpec, playerIndex = 0): THREE.Material {
    const player = this.playerColor(playerIndex);
    const idxTag = spec.texture?.kind === "procedural" && recipeUsesIndex(spec.texture.recipe) ? `|i${playerIndex}` : "";
    const key = `${player}${idxTag}|${JSON.stringify(spec)}`;
    const hit = this.materials.get(key);
    if (hit) return hit;

    const color = spec.color === "$player" ? player : spec.color ?? "#ffffff";
    const map = spec.texture ? this.texture(spec.texture, player, playerIndex, spec.repeat) : null;
    let mat: THREE.Material;
    if (spec.unlit) {
      mat = new THREE.MeshBasicMaterial({ color: map ? "#ffffff" : color, map: map ?? undefined, transparent: spec.opacity != null, opacity: spec.opacity ?? 1 });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: map ? "#ffffff" : color,
        map: map ?? undefined,
        roughness: spec.roughness ?? 0.85,
        metalness: spec.metalness ?? 0,
        emissive: spec.emissive ? new THREE.Color(spec.emissive) : undefined,
        emissiveIntensity: spec.emissiveIntensity ?? 0,
        transparent: spec.opacity != null,
        opacity: spec.opacity ?? 1,
      });
    }
    this.materials.set(key, mat);
    return mat;
  }

  private texture(spec: TextureSpec, player: string, playerIndex: number, repeat?: [number, number]): THREE.Texture | null {
    const idxTag = spec.kind === "procedural" && recipeUsesIndex(spec.recipe) ? `|i${playerIndex}` : "";
    const key = spec.kind === "image" ? `img|${spec.url}|${repeat}` : `${recipeKey(spec.recipe, spec.size ?? 256, player)}${idxTag}|${repeat}`;
    const hit = this.textures.get(key);
    if (hit) return hit;
    let tex: THREE.Texture;
    if (spec.kind === "image") {
      // 加载失败：three 会保持空贴图（白色 × color），此处把 color 置为基础色即可自然回落
      tex = this.loader.load(spec.url, undefined, undefined, () => console.warn(`贴图加载失败，回落纯色：${spec.url}`));
    } else {
      const size = spec.size ?? 256;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      paintRecipe(ctx, size, spec.recipe, player, playerIndex);
      tex = new THREE.CanvasTexture(canvas);
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = 4;
    this.textures.set(key, tex);
    return tex;
  }

  dispose(): void {
    this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose());
    this.materials.clear();
    this.textures.clear();
  }
}
