// props.ts —— 赛道装饰物库（机制）：风格包只声明 { kind, count, side, offset, materials }，
// 几何在此实现。每种装饰物定义自己的材质槽位与默认材质，风格包可逐槽覆盖。
import * as THREE from "three";
import type { MaterialResolver } from "../style/materials";
import type { MaterialSpec, PropKind, PropSpec } from "../style/types";

type Track = <T extends { dispose(): void }>(x: T) => T;
type Rand = () => number;

interface PropCtx {
  mat: (slot: string, fallback: MaterialSpec) => THREE.Material;
  track: Track;
  rand: Rand;
  /** 该装饰物是否放在赛道左侧（z<0），用于让物体朝向跑道 */
  left: boolean;
}

function seeded(seed: number): Rand {
  let a = (seed * 9301 + 49297) >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

const BUILDERS: Record<PropKind, (c: PropCtx) => THREE.Object3D> = {
  palm({ mat, track, rand }) {
    const g = new THREE.Group();
    const h = 7 + rand() * 3;
    const trunkGeo = track(new THREE.CylinderGeometry(0.22, 0.4, h, 8));
    const trunk = new THREE.Mesh(trunkGeo, mat("trunk", { color: "#8b5a2b", roughness: 1 }));
    trunk.position.y = h / 2;
    trunk.rotation.z = (rand() - 0.5) * 0.25;
    g.add(trunk);
    const leafGeo = track(new THREE.BoxGeometry(4.2, 0.12, 1.1));
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(leafGeo, mat("leaf", { color: "#3e8f3e", roughness: 0.9 }));
      leaf.position.set(0, h, 0);
      leaf.rotation.y = (i / 7) * Math.PI * 2;
      leaf.rotation.z = -0.45 - rand() * 0.3;
      leaf.translateX(1.8);
      g.add(leaf);
    }
    return g;
  },
  roundTree({ mat, track, rand }) {
    const g = new THREE.Group();
    const h = 2.5 + rand() * 1.5;
    const trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.4, h, 8)), mat("trunk", { color: "#8b5a2b", roughness: 1 }));
    trunk.position.y = h / 2;
    g.add(trunk);
    const leafGeo = track(new THREE.SphereGeometry(1, 10, 8));
    for (const [x, y, z, s] of [[0, h + 1.2, 0, 2.0], [1.1, h + 0.6, 0.4, 1.4], [-0.9, h + 0.8, -0.5, 1.3]]) {
      const puff = new THREE.Mesh(leafGeo, mat("leaf", { color: "#3f9b4a", roughness: 0.9 }));
      puff.position.set(x, y, z);
      puff.scale.setScalar(s);
      g.add(puff);
    }
    return g;
  },
  bush({ mat, track, rand }) {
    const g = new THREE.Group();
    const geo = track(new THREE.SphereGeometry(1, 8, 6));
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(geo, mat("leaf", { color: "#4f9a3c", roughness: 0.95 }));
      puff.position.set((rand() - 0.5) * 1.6, 0.6 + rand() * 0.3, (rand() - 0.5) * 1.2);
      puff.scale.setScalar(0.7 + rand() * 0.5);
      g.add(puff);
    }
    const flowerGeo = track(new THREE.SphereGeometry(0.16, 6, 5));
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(flowerGeo, mat("flower", { color: "#ffb703", roughness: 0.6 }));
      f.position.set((rand() - 0.5) * 2.2, 0.9 + rand() * 0.8, (rand() - 0.5) * 1.6);
      g.add(f);
    }
    return g;
  },
  rock({ mat, track, rand }) {
    const geo = track(new THREE.DodecahedronGeometry(1, 0));
    const m = new THREE.Mesh(geo, mat("rock", { color: "#9aa3ad", roughness: 1 }));
    m.scale.set(1 + rand(), 0.6 + rand() * 0.4, 0.8 + rand() * 0.6);
    m.rotation.y = rand() * Math.PI;
    m.position.y = 0.4;
    return m;
  },
  temple({ mat, track, rand }) {
    // 印度神庙剪影：基座 + 主殿 + 大圆顶 + 尖顶 + 四角小圆顶
    const g = new THREE.Group();
    const wall = mat("wall", { color: "#f3d9a4", roughness: 0.9 });
    const dome = mat("dome", { color: "#e3b23c", metalness: 0.5, roughness: 0.35 });
    const trim = mat("trim", { color: "#8a1c2b", roughness: 0.8 });
    const w = 9 + rand() * 3;
    const base = new THREE.Mesh(track(new THREE.BoxGeometry(w * 1.3, 1.2, w * 1.3)), trim);
    base.position.y = 0.6;
    g.add(base);
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(w, 6, w)), wall);
    body.position.y = 4.2;
    g.add(body);
    const band = new THREE.Mesh(track(new THREE.BoxGeometry(w * 1.06, 0.6, w * 1.06)), trim);
    band.position.y = 7.3;
    g.add(band);
    const big = new THREE.Mesh(track(new THREE.SphereGeometry(w * 0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), dome);
    big.position.y = 7.4;
    g.add(big);
    const spire = new THREE.Mesh(track(new THREE.ConeGeometry(0.5, 2.6, 8)), dome);
    spire.position.y = 7.4 + w * 0.42 + 1.0;
    g.add(spire);
    const miniGeo = track(new THREE.SphereGeometry(1.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55));
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const mini = new THREE.Mesh(miniGeo, dome);
      mini.position.set(x * w * 0.42, 7.6, z * w * 0.42);
      g.add(mini);
    }
    // 门洞
    const door = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 3.2, 2.2)), trim);
    door.position.set(0, 2.8, w / 2 + 0.05);
    door.rotation.y = Math.PI / 2;
    g.add(door);
    return g;
  },
  torana({ mat, track }) {
    // 托拉纳：横跨赛道的仪式门（两柱 + 横梁 + 垂幔）
    const g = new THREE.Group();
    const pillar = mat("pillar", { color: "#e3b23c", metalness: 0.5, roughness: 0.35 });
    const beam = mat("beam", { color: "#8a1c2b", roughness: 0.8 });
    const drape = mat("drape", { color: "#ff9933", roughness: 0.8 });
    const pGeo = track(new THREE.CylinderGeometry(0.35, 0.45, 8, 10));
    for (const z of [-10.5, 10.5]) {
      const p = new THREE.Mesh(pGeo, pillar);
      p.position.set(0, 4, z);
      g.add(p);
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.7, 10, 8)), pillar);
      cap.position.set(0, 8.3, z);
      g.add(cap);
    }
    const b = new THREE.Mesh(track(new THREE.BoxGeometry(1.0, 0.9, 22)), beam);
    b.position.set(0, 7.9, 0);
    g.add(b);
    const b2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.5, 20)), pillar);
    b2.position.set(0, 8.6, 0);
    g.add(b2);
    const dGeo = track(new THREE.ConeGeometry(0.3, 0.7, 4));
    for (let i = -9; i <= 9; i += 1.5) {
      const d = new THREE.Mesh(dGeo, drape);
      d.position.set(0, 7.1, i);
      d.rotation.x = Math.PI;
      g.add(d);
    }
    return g;
  },
  bunting({ mat, track }) {
    // 横跨赛道的三角彩旗绳
    const g = new THREE.Group();
    const rope = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.06, 20)), mat("rope", { color: "#6b4a2b" }));
    rope.position.set(0, 4.6, 0);
    g.add(rope);
    const flagGeo = track(new THREE.ConeGeometry(0.22, 0.5, 3));
    const flags = [
      mat("flag", { color: "#ff9933" }),
      mat("flag2", { color: "#138808" }),
      mat("flag3", { color: "#ffffff" }),
    ];
    let k = 0;
    for (let z = -9.5; z <= 9.5; z += 1.0) {
      const f = new THREE.Mesh(flagGeo, flags[k++ % 3]);
      f.position.set(0, 4.1 - Math.cos((z / 9.5) * Math.PI / 2) * 0.5, z);
      f.rotation.x = Math.PI;
      g.add(f);
    }
    return g;
  },
  lantern({ mat, track }) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 6)), mat("post", { color: "#5a3a1e" }));
    post.position.y = 1.3;
    g.add(post);
    const lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.26, 10, 8)), mat("lamp", { color: "#ffb347", emissive: "#ff7a00", emissiveIntensity: 0.8 }));
    lamp.position.y = 2.9;
    g.add(lamp);
    return g;
  },
  lamppost({ mat, track, left }) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.16, 5, 8)), mat("post", { color: "#333b44", metalness: 0.4, roughness: 0.5 }));
    post.position.y = 2.5;
    g.add(post);
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.12, 1.6)), mat("post", { color: "#333b44" }));
    arm.position.set(0, 5, left ? 0.8 : -0.8);
    g.add(arm);
    const lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.35, 10, 8)), mat("lamp", { color: "#fff2b0", emissive: "#ffd766", emissiveIntensity: 0.8 }));
    lamp.position.set(0, 4.85, left ? 1.5 : -1.5);
    g.add(lamp);
    return g;
  },
  flag({ mat, track }) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.1, 5, 6)), mat("pole", { color: "#d9d9d9", metalness: 0.5 }));
    pole.position.y = 2.5;
    g.add(pole);
    const cloth = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 1.3)), mat("cloth", { color: "#e63946" }));
    (cloth.material as THREE.Material).side = THREE.DoubleSide;
    cloth.position.set(1.1, 4.3, 0);
    g.add(cloth);
    return g;
  },
  mountain({ mat, track, rand }) {
    const h = 18 + rand() * 22;
    const geo = track(new THREE.ConeGeometry(h * 0.9, h, 7));
    const m = new THREE.Mesh(geo, mat("rock", { color: "#b58d6a", roughness: 1 }));
    m.position.y = h / 2 - 0.5;
    m.rotation.y = rand() * Math.PI;
    return m;
  },
};

/** 按风格包声明沿赛道铺设一种装饰物 */
export function buildProps(
  scene: THREE.Scene,
  spec: PropSpec,
  resolver: MaterialResolver,
  trackLenWorld: number,
  track: Track,
): void {
  const rand = seeded((spec.seed ?? 1) * 7919 + spec.kind.length);
  const mat = (slot: string, fallback: MaterialSpec) => resolver.get(spec.materials?.[slot] ?? fallback);
  const side = spec.side ?? "both";
  const span = trackLenWorld + 24;
  for (let i = 0; i < spec.count; i++) {
    const left = side === "left" ? true : side === "right" ? false : i % 2 === 0;
    const obj = BUILDERS[spec.kind]({ mat, track, rand, left });
    // 横跨型装饰（托拉纳、彩旗）居中并避开起点附近；其余按侧放置
    const crossing = spec.kind === "torana" || spec.kind === "bunting";
    const x = crossing
      ? 14 + ((trackLenWorld - 20) * (i + 1)) / (spec.count + 1)
      : -12 + (span * (i + 0.5)) / spec.count + (rand() - 0.5) * (spec.jitter ?? 0) * 2;
    const offset = (spec.offset ?? 20) + (rand() - 0.5) * (spec.jitter ?? 0);
    obj.position.set(x, 0, crossing ? 0 : (left ? -offset : offset));
    const s = spec.scale ?? 1;
    obj.scale.setScalar(s);
    if (!crossing && spec.kind === "temple") obj.rotation.y = left ? 0 : Math.PI;   // 门洞朝向跑道
    scene.add(obj);
  }
}
