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
  /** 风格包声明的内部变体名（装饰物自行解释） */
  variant?: string;
}

/** 这些装饰物以 +x 为「正脸」建模，铺设时整体转向跑道（左侧朝 +z、右侧朝 -z） */
const FACING_PROPS: ReadonlySet<PropKind> = new Set(["milkBaby", "fuzzyBull", "chubbyRoo", "billboard"]);

const YELLOW: MaterialSpec = { color: "#f9c531", roughness: 0.95 };
const CREAM: MaterialSpec = { color: "#fff1cf", roughness: 0.9 };
const EYE_GREEN: MaterialSpec = { color: "#3bb273", roughness: 0.4 };
const INK: MaterialSpec = { color: "#151515", roughness: 0.3 };
const WHITE: MaterialSpec = { color: "#ffffff", roughness: 0.35 };
const GREY_PAW: MaterialSpec = { color: "#9a9a93", roughness: 0.9 };

/** 一对朝 +x 看的大圆眼（白球 + 绿虹膜 + 黑瞳 + 高光），供奶娃等装饰物复用 */
function addBigEyes(g: THREE.Group, c: PropCtx, center: [number, number], spread: number, R: number, irisMat: THREE.Material) {
  const sclera = c.mat("sclera", WHITE), pupil = c.mat("pupil", INK);
  const ballGeo = c.track(new THREE.SphereGeometry(R, 14, 10));
  const irisGeo = c.track(new THREE.SphereGeometry(R * 0.66, 12, 8));
  const pupilGeo = c.track(new THREE.SphereGeometry(R * 0.34, 8, 6));
  const shineGeo = c.track(new THREE.SphereGeometry(R * 0.14, 6, 5));
  const shine = c.mat("shine", { color: "#ffffff", unlit: true });
  const xAxis = new THREE.Vector3(1, 0, 0);
  for (const s of [-1, 1]) {
    const E = new THREE.Vector3(center[0], center[1], s * spread);
    const D = new THREE.Vector3(0.9, 0.05, s * 0.3).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(xAxis, D);
    const ball = new THREE.Mesh(ballGeo, sclera); ball.position.copy(E); g.add(ball);
    const ir = new THREE.Mesh(irisGeo, irisMat); ir.scale.set(0.4, 1, 1); ir.quaternion.copy(q); ir.position.copy(E).addScaledVector(D, R * 0.95); g.add(ir);
    const pu = new THREE.Mesh(pupilGeo, pupil); pu.scale.set(0.4, 1, 1); pu.quaternion.copy(q); pu.position.copy(E).addScaledVector(D, R * 1.04); g.add(pu);
    const sh = new THREE.Mesh(shineGeo, shine); sh.position.copy(E).addScaledVector(D, R * 1.08).add(new THREE.Vector3(0, R * 0.25, -s * R * 0.2)); g.add(sh);
  }
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
  hill({ mat, track, rand }) {
    // 连绵圆丘：几个压扁的球体并排（公路远景的卡通青山）
    const g = new THREE.Group();
    const geo = track(new THREE.SphereGeometry(1, 16, 10));
    const m = mat("grass", { color: "#2e7d4f", roughness: 1 });
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const r = 14 + rand() * 12;
      const puff = new THREE.Mesh(geo, m);
      puff.scale.set(r * (1.3 + rand() * 0.6), r * (0.45 + rand() * 0.25), r * (0.9 + rand() * 0.4));
      puff.position.set((i - (n - 1) / 2) * r * 1.4, -r * 0.08, (rand() - 0.5) * r * 0.6);
      g.add(puff);
    }
    return g;
  },
  highwayLamp({ mat, track, left }) {
    // 高速公路路灯：高杆 + 伸向路面的灯臂 + 扁平自发光灯头与光晕
    const g = new THREE.Group();
    const post = mat("post", { color: "#9aa3ad", metalness: 0.6, roughness: 0.4 });
    const lamp = mat("lamp", { color: "#ffd27a", unlit: true });
    const dir = left ? 1 : -1;   // 朝向跑道中线（z=0）
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.2, 9, 8)), post);
    pole.position.y = 4.5;
    g.add(pole);
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.14, 2.6)), post);
    arm.position.set(0, 8.9, dir * 1.3);
    arm.rotation.x = dir * 0.12;
    g.add(arm);
    const head = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.22, 0.5)), lamp);
    head.position.set(0, 8.75, dir * 2.5);
    g.add(head);
    const glow = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 8, 6)), lamp);
    glow.scale.set(1.3, 0.5, 1);
    glow.position.set(0, 8.58, dir * 2.5);
    g.add(glow);
    return g;
  },
  roadSign({ mat, track }) {
    // 圆形限速牌：立柱 + 轴沿 x 的薄圆柱，两个端面都贴标牌纹理（朝向来车 -x 与去向 +x）
    const g = new THREE.Group();
    const post = mat("post", { color: "#9aa3ad", metalness: 0.6, roughness: 0.4 });
    const face = mat("face", {
      texture: { kind: "procedural", recipe: { type: "label", base: "#ffffff", ring: "#d7261e", ink: "#111111", text: "100" } },
      roughness: 0.6,
    });
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6)), post);
    pole.position.y = 1.7;
    g.add(pole);
    const disc = new THREE.Mesh(track(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24)), [post, face, face]);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(0, 3.6, 0);
    g.add(disc);
    return g;
  },
  boxCar({ mat, track }) {
    // 驾考宝典式低多边形方块轿车：车身 + 座舱玻璃 + 四轮 + 前后灯 + 圆后视镜，车头朝 +x
    const g = new THREE.Group();
    const body = mat("body", { color: "#d9b35a", roughness: 0.5, metalness: 0.1 });
    const glass = mat("glass", { color: "#7fb6d8", roughness: 0.2, metalness: 0.3 });
    const tire = mat("tire", { color: "#1d1f22", roughness: 0.95 });
    const lamp = mat("lamp", { color: "#fff6d0", unlit: true });
    const tail = mat("tailLamp", { color: "#ff3b2f", unlit: true });
    const lower = new THREE.Mesh(track(new THREE.BoxGeometry(4.6, 1.0, 2.1)), body);
    lower.position.y = 0.95;
    g.add(lower);
    const cabin = new THREE.Mesh(track(new THREE.BoxGeometry(2.5, 0.95, 1.9)), body);
    cabin.position.set(-0.3, 1.9, 0);
    g.add(cabin);
    const wind = new THREE.Mesh(track(new THREE.BoxGeometry(2.56, 0.6, 1.94)), glass);
    wind.position.set(-0.3, 1.95, 0);
    g.add(wind);
    const wheelGeo = track(new THREE.CylinderGeometry(0.46, 0.46, 0.36, 12));
    for (const [x, z] of [[1.5, 1.0], [1.5, -1.0], [-1.5, 1.0], [-1.5, -1.0]]) {
      const w = new THREE.Mesh(wheelGeo, tire);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.46, z);
      g.add(w);
    }
    const lampGeo = track(new THREE.BoxGeometry(0.12, 0.3, 0.5));
    for (const z of [-0.65, 0.65]) {
      const h = new THREE.Mesh(lampGeo, lamp); h.position.set(2.32, 1.0, z); g.add(h);
      const t = new THREE.Mesh(lampGeo, tail); t.position.set(-2.32, 1.0, z); g.add(t);
    }
    const mirrorGeo = track(new THREE.SphereGeometry(0.16, 8, 6));
    for (const z of [-1.1, 1.1]) {
      const m = new THREE.Mesh(mirrorGeo, body);
      m.position.set(0.9, 1.75, z);
      g.add(m);
    }
    return g;
  },
  milkBaby(c) {
    // 奶娃（网传「奶蛙」：黄圆润 / 浅米腹 / 绿眼 / 灰爪）：蛋形身体 + 奶白肚皮 + 两只大绿眼 + 灰色短手短脚；
    // 变体 smile / laugh（张嘴大笑）/ sad（忧郁：下弯嘴 + 两行蓝泪、身色偏灰黄）/ mixed（随机），正脸朝 +x
    const { mat, track, rand } = c;
    const g = new THREE.Group();
    const v = c.variant ?? "mixed";
    const r = rand();
    const mood = v === "mixed" ? (r < 0.6 ? "smile" : r < 0.88 ? "laugh" : "sad") : v;
    const body = mat(mood === "sad" ? "sadBody" : "body", mood === "sad" ? { color: "#e6c65c", roughness: 0.95 } : YELLOW);
    const belly = mat("belly", CREAM), paw = mat("paw", GREY_PAW);
    const sphere = track(new THREE.SphereGeometry(1, 16, 12));
    const h = 0.85 + rand() * 0.35;
    const egg = new THREE.Mesh(sphere, body);
    egg.scale.set(1.0 * h, 1.25 * h, 1.0 * h);
    egg.position.y = 1.2 * h;
    g.add(egg);
    const tum = new THREE.Mesh(sphere, belly);
    tum.scale.set(0.42 * h, 0.78 * h, 0.66 * h);
    tum.position.set(0.72 * h, 0.95 * h, 0);
    g.add(tum);
    // 短手（贴身体两侧向前）与脚
    const limb = track(new THREE.CapsuleGeometry(0.16, 0.42, 4, 8));
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(limb, paw);
      arm.position.set(0.55 * h, 1.05 * h, s * 0.98 * h);
      arm.rotation.set(0, 0, -1.1);
      g.add(arm);
      const foot = new THREE.Mesh(sphere, paw);
      foot.scale.set(0.34 * h, 0.16 * h, 0.26 * h);
      foot.position.set(0.72 * h, 0.14 * h, s * 0.46 * h);
      g.add(foot);
    }
    addBigEyes(g, c, [0.68 * h, 1.78 * h], 0.4 * h, 0.3 * h, mat("iris", EYE_GREEN));
    if (mood === "sad") {
      // 忧郁奶娃：眼下两行大蓝泪
      const tearGeo = track(new THREE.SphereGeometry(0.11 * h, 8, 6));
      const tear = mat("tear", { color: "#5fb4ff", roughness: 0.3 });
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
        const t = new THREE.Mesh(tearGeo, tear);
        t.scale.set(0.6, 1.3 + k * 0.4, 1);
        t.position.set(0.9 * h - k * 0.02 * h, 1.42 * h - k * 0.26 * h, s * 0.46 * h);
        g.add(t);
      }
    }
    // 嘴
    const mouthMat = mat("mouth", { color: "#5a1a12", roughness: 0.8 });
    if (mood === "laugh") {
      const mouth = new THREE.Mesh(sphere, mouthMat);
      mouth.scale.set(0.16 * h, 0.3 * h, 0.44 * h);
      mouth.position.set(0.92 * h, 1.28 * h, 0);
      g.add(mouth);
      const teeth = new THREE.Mesh(track(new THREE.BoxGeometry(0.12 * h, 0.1 * h, 0.7 * h)), mat("teeth", WHITE));
      teeth.position.set(0.98 * h, 1.5 * h, 0);
      g.add(teeth);
      const tongue = new THREE.Mesh(sphere, mat("tongue", { color: "#ff6f91", roughness: 0.7 }));
      tongue.scale.set(0.1 * h, 0.1 * h, 0.22 * h);
      tongue.position.set(1.02 * h, 1.12 * h, 0);
      g.add(tongue);
    } else {
      // 一字微笑 / 下弯忧郁：薄弧
      const arc = new THREE.Mesh(track(new THREE.TorusGeometry(0.22 * h, 0.03 * h, 5, 14, Math.PI * 0.8)), mouthMat);
      arc.position.set(0.98 * h, mood === "sad" ? 1.22 * h : 1.36 * h, 0);
      arc.rotation.set(0, Math.PI / 2, mood === "sad" ? 0.1 : Math.PI + 0.1);
      g.add(arc);
    }
    return g;
  },
  fuzzyBull({ mat, track, rand }) {
    // 牛来：站立的黄毛牛人——胶囊身体 + 奶白肚皮 + 圆头 + 粉吻 + 灰角 + 牛耳 + 垂臂 + 短腿，正脸朝 +x
    const g = new THREE.Group();
    const fur = mat("fur", YELLOW), belly = mat("belly", CREAM);
    const horn = mat("horn", { color: "#8d8373", roughness: 0.7 });
    const pink = mat("muzzle", { color: "#f1c7b5", roughness: 0.8 });
    const dark = mat("ink", INK);
    const sphere = track(new THREE.SphereGeometry(1, 14, 10));
    const legGeo = track(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8));
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.set(0, 0.45, s * 0.32);
      g.add(leg);
      const hoof = new THREE.Mesh(sphere, mat("hoof", { color: "#6b5a4a", roughness: 0.8 }));
      hoof.scale.set(0.3, 0.14, 0.26);
      hoof.position.set(0.08, 0.1, s * 0.32);
      g.add(hoof);
    }
    const torso = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.62, 0.9, 6, 12)), fur);
    torso.position.y = 1.55;
    g.add(torso);
    const tum = new THREE.Mesh(sphere, belly);
    tum.scale.set(0.3, 0.62, 0.48);
    tum.position.set(0.48, 1.4, 0);
    g.add(tum);
    const armGeo = track(new THREE.CapsuleGeometry(0.17, 0.8, 4, 8));
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, fur);
      arm.position.set(0.05, 1.45, s * 0.8);
      arm.rotation.set(s * 0.15, 0, 0.12);
      g.add(arm);
    }
    const head = new THREE.Mesh(sphere, fur);
    head.scale.set(0.58, 0.56, 0.6);
    head.position.set(0.05, 2.55, 0);
    g.add(head);
    const muz = new THREE.Mesh(sphere, pink);
    muz.scale.set(0.3, 0.26, 0.4);
    muz.position.set(0.5, 2.36, 0);
    g.add(muz);
    const nGeo = track(new THREE.SphereGeometry(0.045, 6, 5));
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(nGeo, dark); n.position.set(0.78, 2.42, s * 0.13); g.add(n);
      // 半阖的不屑眼 + 粗眉
      const eye = new THREE.Mesh(sphere, dark); eye.scale.set(0.03, 0.05, 0.07); eye.position.set(0.56, 2.66, s * 0.22); g.add(eye);
      const brow = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.05, 0.2)), dark); brow.position.set(0.55, 2.8, s * 0.22); brow.rotation.x = s * 0.25; g.add(brow);
      const hornM = new THREE.Mesh(track(new THREE.ConeGeometry(0.1, 0.5, 8)), horn);
      hornM.position.set(-0.05, 3.05, s * 0.32);
      hornM.rotation.set(s * 0.7, 0, 0.2);
      g.add(hornM);
      const ear = new THREE.Mesh(sphere, fur); ear.scale.set(0.16, 0.1, 0.26); ear.position.set(0, 2.62, s * 0.66); g.add(ear);
    }
    g.rotation.y = (rand() - 0.5) * 0.4;
    return g;
  },
  chubbyRoo({ mat, track, rand }) {
    // 胆子肥嘟嘟：被养胖的黄袋鼠——蛋形身体 + 大浅黄肚皮 + 圆头 + 大棕鼻 + 圆白眼 + 高立耳 + 抱肚短手 + 大脚 + 粗尾巴，正脸朝 +x
    const g = new THREE.Group();
    const fur = mat("fur", YELLOW), belly = mat("belly", CREAM);
    const nose = mat("nose", { color: "#6b3a22", roughness: 0.55 });
    const white = mat("sclera", WHITE), dark = mat("pupil", { color: "#2b1608", roughness: 0.3 });
    const sphere = track(new THREE.SphereGeometry(1, 14, 10));
    const body = new THREE.Mesh(sphere, fur);
    body.scale.set(0.82, 0.95, 0.85);
    body.position.y = 0.95;
    g.add(body);
    const tum = new THREE.Mesh(sphere, belly);
    tum.scale.set(0.42, 0.72, 0.66);
    tum.position.set(0.52, 0.85, 0);
    g.add(tum);
    const head = new THREE.Mesh(sphere, fur);
    head.scale.set(0.6, 0.56, 0.6);
    head.position.set(0.12, 2.05, 0);
    g.add(head);
    const snout = new THREE.Mesh(sphere, fur);
    snout.scale.set(0.42, 0.32, 0.4);
    snout.position.set(0.42, 1.92, 0);
    g.add(snout);
    const bigNose = new THREE.Mesh(sphere, nose);
    bigNose.scale.set(0.22, 0.2, 0.26);
    bigNose.position.set(0.78, 1.96, 0);
    g.add(bigNose);
    const earGeo = track(new THREE.CapsuleGeometry(0.14, 0.62, 4, 8));
    const limb = track(new THREE.CapsuleGeometry(0.13, 0.36, 4, 8));
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(sphere, white); eye.scale.set(0.09, 0.12, 0.1); eye.position.set(0.6, 2.22, s * 0.2); g.add(eye);
      const pu = new THREE.Mesh(sphere, dark); pu.scale.set(0.05, 0.07, 0.06); pu.position.set(0.67, 2.21, s * 0.19); g.add(pu);
      const ear = new THREE.Mesh(earGeo, fur); ear.position.set(0.0, 2.75, s * 0.3); ear.rotation.set(s * -0.3, 0, -0.15); g.add(ear);
      const arm = new THREE.Mesh(limb, fur); arm.position.set(0.72, 1.05, s * 0.45); arm.rotation.set(s * 0.9, 0, -0.9); g.add(arm);
      const foot = new THREE.Mesh(sphere, fur); foot.scale.set(0.34, 0.16, 0.24); foot.position.set(0.72, 0.16, s * 0.5); g.add(foot);
    }
    const tail = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.1, 0.7, 4, 8)), fur);
    tail.position.set(-0.75, 0.25, 0.1);
    tail.rotation.set(0, 0, 1.25);
    g.add(tail);
    g.rotation.y = (rand() - 0.5) * 0.5;
    return g;
  },
  milkBottle({ mat, track, rand }) {
    // 奶瓶：半透明瓶身 + 内里奶液 + 彩色瓶盖环 + 奶嘴
    const g = new THREE.Group();
    const glass = mat("glass", { color: "#f4f8ff", roughness: 0.15, opacity: 0.55 });
    const milk = mat("milk", { color: "#fff6e3", roughness: 0.9 });
    const cap = mat("cap", { color: "#ff9fb8", roughness: 0.6 });
    const teat = mat("teat", { color: "#f0cfa8", roughness: 0.8 });
    const h = 2.0 + rand() * 0.8;
    const inner = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.42, h * 0.72, 14)), milk);
    inner.position.y = h * 0.36;
    g.add(inner);
    const bottle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.5, h, 16)), glass);
    bottle.position.y = h / 2;
    g.add(bottle);
    const ring = new THREE.Mesh(track(new THREE.CylinderGeometry(0.46, 0.5, 0.36, 16)), cap);
    ring.position.y = h + 0.18;
    g.add(ring);
    const nip = new THREE.Mesh(track(new THREE.SphereGeometry(0.26, 12, 8)), teat);
    nip.scale.set(1, 1.4, 1);
    nip.position.y = h + 0.6;
    g.add(nip);
    g.rotation.y = rand() * Math.PI;
    return g;
  },
  billboard({ mat, track }) {
    // 弹幕广告牌：两根立柱 + 横牌（正面朝 +x，贴 label 文字纹理，由风格包给文字与 aspect）
    const g = new THREE.Group();
    const post = mat("post", { color: "#8b6a3a", roughness: 0.9 });
    const W = 5.2, H = 4.0;
    const face = mat("face", {
      texture: { kind: "procedural", recipe: { type: "label", base: "#fff6d8", ring: "#f2a900", ink: "#3b2a12", text: "抽象", shape: "rect", aspect: W / H }, size: 512 },
      roughness: 0.7,
    });
    (face as THREE.Material).side = THREE.DoubleSide;
    const pGeo = track(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8));
    for (const z of [-W * 0.38, W * 0.38]) {
      const p = new THREE.Mesh(pGeo, post);
      p.position.set(-0.1, 1.3, z);
      g.add(p);
    }
    const board = new THREE.Mesh(track(new THREE.PlaneGeometry(W, H)), face);
    board.position.set(0, 2.4 + H / 2, 0);
    board.rotation.y = Math.PI / 2;
    g.add(board);
    const frame = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, H + 0.3, W + 0.3)), post);
    frame.position.set(-0.08, 2.4 + H / 2, 0);
    g.add(frame);
    return g;
  },
  boxTruck({ mat, track }) {
    // 低多边形厢式货车：车头驾驶室 + 大货箱 + 六轮 + 前后灯，车头朝 +x
    const g = new THREE.Group();
    const cab = mat("cab", { color: "#d8dde3", roughness: 0.5, metalness: 0.1 });
    const box = mat("box", { color: "#2b3fa8", roughness: 0.6 });
    const glass = mat("glass", { color: "#7fb6d8", roughness: 0.2, metalness: 0.3 });
    const tire = mat("tire", { color: "#1d1f22", roughness: 0.95 });
    const lamp = mat("lamp", { color: "#fff6d0", unlit: true });
    const tail = mat("tailLamp", { color: "#ff3b2f", unlit: true });
    const chassis = new THREE.Mesh(track(new THREE.BoxGeometry(9.6, 0.5, 2.3)), tire);
    chassis.position.set(-0.4, 0.95, 0);
    g.add(chassis);
    const cabMesh = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 2.6, 2.5)), cab);
    cabMesh.position.set(3.2, 2.5, 0);
    g.add(cabMesh);
    const windshield = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 1.2, 2.2)), glass);
    windshield.position.set(4.42, 3.05, 0);
    g.add(windshield);
    const container = new THREE.Mesh(track(new THREE.BoxGeometry(6.6, 3.1, 2.6)), box);
    container.position.set(-1.5, 2.75, 0);
    g.add(container);
    const wheelGeo = track(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12));
    for (const x of [3.0, -1.6, -3.2, -4.4]) {
      for (const z of [-1.15, 1.15]) {
        const w = new THREE.Mesh(wheelGeo, tire);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.6, z);
        g.add(w);
      }
    }
    const lampGeo = track(new THREE.BoxGeometry(0.12, 0.34, 0.6));
    for (const z of [-0.85, 0.85]) {
      const h = new THREE.Mesh(lampGeo, lamp); h.position.set(4.44, 1.7, z); g.add(h);
      const t = new THREE.Mesh(lampGeo, tail); t.position.set(-4.84, 1.5, z); g.add(t);
    }
    return g;
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
    const obj = BUILDERS[spec.kind]({ mat, track, rand, left, variant: spec.variant });
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
    if (FACING_PROPS.has(spec.kind)) obj.rotation.y += left ? -Math.PI / 2 : Math.PI / 2;   // +x 正脸转向跑道
    scene.add(obj);
  }
}
