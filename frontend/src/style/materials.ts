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

/** 把配方画到 canvas；纯函数式：同配方同尺寸同输出 */
export function paintRecipe(ctx: CanvasRenderingContext2D, size: number, recipe: ProceduralRecipe, player: string): void {
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
    const key = `${player}|${JSON.stringify(spec)}`;
    const hit = this.materials.get(key);
    if (hit) return hit;

    const color = spec.color === "$player" ? player : spec.color ?? "#ffffff";
    const map = spec.texture ? this.texture(spec.texture, player, spec.repeat) : null;
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

  private texture(spec: TextureSpec, player: string, repeat?: [number, number]): THREE.Texture | null {
    const key = spec.kind === "image" ? `img|${spec.url}|${repeat}` : `${recipeKey(spec.recipe, spec.size ?? 256, player)}|${repeat}`;
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
      paintRecipe(ctx, size, spec.recipe, player);
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
