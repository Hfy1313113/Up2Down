// elephantMesh.ts —— 由识别模型生成 3D 大象（THREE.Group），Birth 与 Race 共用。
// 连杆动画：每帧按 gait.ts 的 computePose 得到 thigh/fold 角度，
// 大腿绕髋旋转、小腿相对膝盖旋转（与 legPoints 前向运动学一致）。
// 外观完全由风格包决定：材质经 MaterialResolver 解析，驭象师附件按风格包清单从附件库挂载。
// 识别出的长度数值不改（速度公式不受影响），只在建模时乘以大象体型的视觉比例系数。
import * as THREE from "three";
import { computePose } from "../game/gait";
import type { ElephantModel, LegModel, Pose, TorsoModel, Vec2 } from "../game/types";
import type { MaterialResolver } from "../style/materials";
import type { ElephantAccessory, ElephantSlot, MaterialSpec, RiderAccessory, RiderSlot, StylePack } from "../style/types";

// 模型本地坐标（躯干 120 单位）→ 世界尺度
export const WORLD_SCALE = 0.02;
// 驭象师颠飞高度：raceSim.riderFlyY（0~35）× 该系数 = 模型本地单位；
// 取 9 使最高约 6 个世界单位，第二人称相机能把大象与驭象师同时框进画面
export const RIDER_FLY_HEIGHT = 9;

// 大象体型视觉系数（只影响几何粗细，不影响识别长度与速度）
const BULK = 1.22;      // 躯干半径
const LEG_R = 1.9;      // 腿部半径
const LEG_SPREAD = 8;   // 近/远侧腿的 z 间距

export interface ElephantRig {
  group: THREE.Group;
  setPose(
    pose: Pose,
    whipIntensity?: number,
    dt?: number,
    buckedOff?: boolean,
    riderFlyY?: number,
    riderFlyRot?: number,
    riderFlyX?: number
  ): void;
  /** 头部世界锚点（本地坐标，未乘 group 变换） */
  headLocal: THREE.Vector3;
  dispose(): void;
}

export interface BuildOptions {
  materials: MaterialResolver;
  pack: StylePack;
  /** 决定 "$player" 取哪一色 */
  playerIndex: number;
}

// 一条腿：hipGroup(髋) → 大腿 mesh + kneeGroup(膝) → 小腿 mesh + 象足
interface LegRig {
  hipGroup: THREE.Group;
  kneeGroup: THREE.Group;
  dir: 1 | -1;   // hind=-1(前收)/fore=1，与 legPoints 的 dir 一致
  /** 小腿长度（膝→足），附件库在足部挂件时用 */
  L2: number;
}

type Track = <T extends { dispose(): void }>(x: T) => T;

function buildLeg(leg: LegModel, mat: (slot: ElephantSlot) => THREE.Material, track: Track): { root: THREE.Group; rig: LegRig } {
  const dir = (leg.type === "hind" ? -1 : 1) as 1 | -1;
  const hipGroup = new THREE.Group();
  hipGroup.position.set(leg.hip[0], leg.hip[1], 0);

  const thighGeo = track(new THREE.CylinderGeometry(4.2 * LEG_R, 3.4 * LEG_R, leg.L1, 12));
  thighGeo.translate(0, -leg.L1 / 2, 0);   // 顶端对齐髋，向下伸
  hipGroup.add(new THREE.Mesh(thighGeo, mat("thigh")));

  const kneeGroup = new THREE.Group();
  kneeGroup.position.set(0, -leg.L1, 0);
  const shinGeo = track(new THREE.CylinderGeometry(3.2 * LEG_R, 2.6 * LEG_R, leg.L2, 12));
  shinGeo.translate(0, -leg.L2 / 2, 0);
  kneeGroup.add(new THREE.Mesh(shinGeo, mat("shin")));

  // 象足：圆柱趾足 + 三枚趾甲
  const footGeo = track(new THREE.CylinderGeometry(3.0 * LEG_R, 3.4 * LEG_R, 5, 12));
  footGeo.translate(0, -leg.L2 - 2, 0);
  kneeGroup.add(new THREE.Mesh(footGeo, mat("foot")));
  const nailGeo = track(new THREE.SphereGeometry(1.5, 6, 5));
  for (const a of [-0.55, 0, 0.55]) {
    const nail = new THREE.Mesh(nailGeo, mat("toenail"));
    nail.position.set(Math.cos(a) * 3.3 * LEG_R, -leg.L2 - 3.6, Math.sin(a) * 3.3 * LEG_R);
    kneeGroup.add(nail);
  }

  hipGroup.add(kneeGroup);
  return { root: hipGroup, rig: { hipGroup, kneeGroup, dir, L2: leg.L2 } };
}

/** 两点之间放一段圆柱（用于象鼻分节） */
function segmentBetween(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, material: THREE.Material, track: Track): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = Math.max(dir.length(), 0.1);
  const geo = track(new THREE.CylinderGeometry(r1, r0, len, 10));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// ---------- 驭象师附件库：风格包只写附件名，几何在此实现 ----------
interface AccessoryCtx {
  head: THREE.Mesh;
  headR: number;
  body: THREE.Group;
  bodyR: number;
  mat: (slot: RiderSlot) => THREE.Material;
  track: Track;
}
const ACCESSORIES: Record<RiderAccessory, (c: AccessoryCtx) => void> = {
  helmet({ head, headR, mat, track }) {
    const geo = track(new THREE.SphereGeometry(headR * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55));
    const m = new THREE.Mesh(geo, mat("headwear"));
    m.position.set(0, headR * 0.12, 0);
    head.add(m);
  },
  visor({ head, headR, mat, track }) {
    const geo = track(new THREE.BoxGeometry(headR * 0.9, 1.2, headR * 1.1));
    const m = new THREE.Mesh(geo, mat("jewel"));
    m.position.set(headR * 0.65, headR * 0.1, 0);
    m.rotation.z = -0.15;
    head.add(m);
  },
  turban({ head, headR, mat, track }) {
    // 缠绕层 + 顶部圆顶 + 额前宝石
    const band = new THREE.Mesh(track(new THREE.TorusGeometry(headR * 0.92, headR * 0.42, 10, 20)), mat("headwear"));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, headR * 0.35, 0);
    head.add(band);
    const band2 = new THREE.Mesh(track(new THREE.TorusGeometry(headR * 0.8, headR * 0.36, 10, 20)), mat("headwear"));
    band2.rotation.x = Math.PI / 2;
    band2.rotation.z = 0.25;
    band2.position.set(0, headR * 0.72, 0);
    head.add(band2);
    const dome = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.78, 12, 10)), mat("headwear"));
    dome.position.set(0, headR * 0.85, 0);
    head.add(dome);
    const jewel = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.2, 8, 6)), mat("jewel"));
    jewel.position.set(headR * 0.98, headR * 0.5, 0);
    head.add(jewel);
  },
  cap({ head, headR, mat, track }) {
    const geo = track(new THREE.BoxGeometry(headR * 1.7, headR * 0.55, headR * 1.05));
    const m = new THREE.Mesh(geo, mat("headwear"));
    m.position.set(0, headR * 0.85, 0);
    head.add(m);
  },
  plume({ head, headR, mat, track }) {
    const geo = track(new THREE.ConeGeometry(headR * 0.2, headR * 1.3, 6));
    const m = new THREE.Mesh(geo, mat("jewel"));
    m.position.set(-headR * 0.1, headR * 1.9, 0);
    m.rotation.z = 0.35;
    head.add(m);
  },
  mustache({ head, headR, mat, track }) {
    const geo = track(new THREE.CylinderGeometry(headR * 0.1, headR * 0.05, headR * 0.55, 6));
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat("hair"));
      m.position.set(headR * 0.9, -headR * 0.22, s * headR * 0.26);
      m.rotation.x = s * (Math.PI / 2 - 0.35);   // 两端微微下垂
      head.add(m);
    }
  },
  beard({ head, headR, mat, track }) {
    const geo = track(new THREE.SphereGeometry(headR * 0.5, 8, 6));
    const m = new THREE.Mesh(geo, mat("hair"));
    m.scale.set(1.0, 0.9, 0.9);
    m.position.set(headR * 0.55, -headR * 0.6, 0);
    head.add(m);
  },
  bindi({ head, headR, mat, track }) {
    const m = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.1, 6, 5)), mat("jewel"));
    m.position.set(headR * 0.97, headR * 0.22, 0);
    head.add(m);
  },
  sash({ body, bodyR, mat, track }) {
    const geo = track(new THREE.BoxGeometry(bodyR * 0.16, bodyR * 1.25, bodyR * 0.9));
    const m = new THREE.Mesh(geo, mat("headwear"));
    m.position.set(-bodyR * 0.02, bodyR * 0.6, 0);
    m.rotation.z = -0.22;
    m.rotation.x = 0.55;
    body.add(m);
  },
  curlyHair({ head, headR, mat, track }) {
    // 蓬松黑卷发：三圈小球绕头堆叠 + 头顶大球；正前方一圈抬高到额头，不遮眉眼（脸贴图在 +x）
    const geo = track(new THREE.SphereGeometry(headR * 0.34, 8, 6));
    const m = mat("hair");
    const rings: [number, number, number][] = [[0.95, 0.42, 10], [0.8, 0.72, 9], [0.5, 0.92, 7]];   // [半径比, 高度比, 个数]
    for (const [rr, hh, n] of rings) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + hh;
        const front = Math.max(0, Math.cos(a));
        const puff = new THREE.Mesh(geo, m);
        puff.position.set(Math.cos(a) * headR * rr, headR * (hh + front * 0.33), Math.sin(a) * headR * rr);
        head.add(puff);
      }
    }
    const top = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.62, 10, 8)), m);
    top.position.set(-headR * 0.1, headR * 0.8, 0);
    head.add(top);
  },
  seat({ body, bodyR, mat, track }) {
    // 汽车座椅：靠背 + 头枕，固定在驭象师身后（随身体、不随头转动）
    const m = mat("headwear");
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(bodyR * 0.22, bodyR * 1.35, bodyR * 1.1)), m);
    back.position.set(-bodyR * 0.55, bodyR * 0.75, 0);
    back.rotation.z = -0.12;
    body.add(back);
    const rest = new THREE.Mesh(track(new THREE.BoxGeometry(bodyR * 0.22, bodyR * 0.62, bodyR * 0.78)), m);
    rest.position.set(-bodyR * 0.3, bodyR * 1.62, 0);
    body.add(rest);
  },
  steeringWheel({ body, bodyR, mat, track }) {
    // 方向盘：轮圈 + 三辐 + 转向柱，立在驭象师胸前
    const m = mat("whipStick");
    const wheel = new THREE.Mesh(track(new THREE.TorusGeometry(bodyR * 0.36, bodyR * 0.05, 8, 24)), m);
    wheel.position.set(bodyR * 0.55, bodyR * 1.0, 0);
    wheel.rotation.y = Math.PI / 2;    // 轮面朝向 ±x
    wheel.rotation.x = 0.35;           // 上沿向驭象师后仰
    body.add(wheel);
    const spokeGeo = track(new THREE.BoxGeometry(bodyR * 0.05, bodyR * 0.68, bodyR * 0.06));
    for (const a of [0, 2.1, -2.1]) {
      const sp = new THREE.Mesh(spokeGeo, m);
      sp.rotation.z = a;
      sp.position.set(Math.sin(a) * bodyR * 0.02, 0, 0);
      wheel.add(sp);
    }
    const hub = new THREE.Mesh(track(new THREE.SphereGeometry(bodyR * 0.08, 8, 6)), m);
    wheel.add(hub);
    const column = new THREE.Mesh(track(new THREE.CylinderGeometry(bodyR * 0.045, bodyR * 0.045, bodyR * 0.5, 6)), m);
    column.position.set(bodyR * 0.72, bodyR * 0.8, 0);
    column.rotation.z = 1.1;
    body.add(column);
  },
};

// ---------- 大象附件库（车件）：风格包只写 { kind, materials? }，几何在此实现 ----------
interface ElephantAccCtx {
  /** 大象根组（模型本地坐标，躯干约 120 单位） */
  group: THREE.Group;
  /** 头组：原点在头心、x 轴沿识别朝向 */
  headGroup: THREE.Group;
  /** 头尺寸 */
  size: number;
  torso: TorsoModel;
  /** 躯干胶囊半径 */
  radius: number;
  legs: LegRig[];
  mat: (slot: string, fallback: MaterialSpec) => THREE.Material;
  track: Track;
}
const LAMP_ON: MaterialSpec = { color: "#fff6d0", unlit: true };
const SIGNAL_ON: MaterialSpec = { color: "#ffb020", unlit: true };
const TAIL_ON: MaterialSpec = { color: "#ff3b2f", unlit: true };
const CHROME: MaterialSpec = { color: "#d7dde3", metalness: 0.8, roughness: 0.25 };
const TIRE: MaterialSpec = { color: "#1d1f22", roughness: 0.95 };
const ELEPHANT_ACCESSORY_BUILDERS: Record<ElephantAccessory, (c: ElephantAccCtx) => void> = {
  headlights({ headGroup, size, mat, track }) {
    // 头球是 (1.12, 1, 0.95) × 0.72·size 的椭球；大灯与转向灯都半嵌在球面上
    const lampGeo = track(new THREE.BoxGeometry(size * 0.12, size * 0.17, size * 0.28));
    const sigGeo = track(new THREE.BoxGeometry(size * 0.1, size * 0.12, size * 0.12));
    const lamp = mat("lamp", LAMP_ON);
    const sig = mat("signal", SIGNAL_ON);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(lampGeo, lamp);
      l.position.set(size * 0.68, -size * 0.02, s * size * 0.4);
      headGroup.add(l);
      const g = new THREE.Mesh(sigGeo, sig);
      g.position.set(size * 0.33, -size * 0.02, s * size * 0.66);
      headGroup.add(g);
    }
  },
  taillights({ group, torso: T, radius, mat, track }) {
    const hemiC = T.cx - T.len / 2 + radius;   // 躯干后端半球心
    const geo = track(new THREE.BoxGeometry(radius * 0.16, radius * 0.26, radius * 0.36));
    const tail = mat("tailLamp", TAIL_ON);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(geo, tail);
      m.position.set(hemiC - radius * 0.83, T.cy + radius * 0.05, s * radius * 0.55);
      group.add(m);
    }
  },
  plate({ group, torso: T, radius, mat, track }) {
    // 车牌贴在屁股正后方（-x 面用标牌材质，其余面镀铬）
    const hemiC = T.cx - T.len / 2 + radius;
    const chrome = mat("chrome", CHROME);
    const label = mat("plate", {
      texture: { kind: "procedural", recipe: { type: "label", base: "#e9eef3", ink: "#1b2a4a", ring: "#1b2a4a", text: "象A·00001", shape: "rect" } },
      roughness: 0.5,
    });
    const m = new THREE.Mesh(
      track(new THREE.BoxGeometry(radius * 0.08, radius * 0.3, radius * 0.7)),
      [chrome, label, chrome, chrome, chrome, chrome],
    );
    m.position.set(hemiC - radius * 0.97, T.cy - radius * 0.25, 0);
    group.add(m);
  },
  mirrors({ headGroup, size, mat, track }) {
    // 两侧圆后视镜：短杆从头两侧伸出 + 扁球镜面
    const stalkGeo = track(new THREE.CylinderGeometry(size * 0.04, size * 0.04, size * 0.32, 6));
    const mirrorGeo = track(new THREE.SphereGeometry(size * 0.16, 10, 8));
    const body = mat("mirror", { color: "#2a2d33", roughness: 0.6 });
    const glass = mat("chrome", CHROME);
    for (const s of [-1, 1]) {
      const stalk = new THREE.Mesh(stalkGeo, body);
      stalk.rotation.x = Math.PI / 2;
      stalk.position.set(size * 0.25, size * 0.05, s * size * 0.78);
      headGroup.add(stalk);
      const shell = new THREE.Mesh(mirrorGeo, body);
      shell.scale.set(0.45, 1, 1);
      shell.position.set(size * 0.25, size * 0.05, s * size * 1.0);
      headGroup.add(shell);
      const face = new THREE.Mesh(mirrorGeo, glass);
      face.scale.set(0.2, 0.8, 0.8);
      face.position.set(size * 0.2, size * 0.05, s * size * 1.0);
      headGroup.add(face);
    }
  },
  hubcaps({ legs, mat, track }) {
    // 轮胎脚：每只象足外套一圈黑胎，外侧加镀铬轮毂盖
    const tire = mat("tire", TIRE);
    const chrome = mat("chrome", CHROME);
    const tireGeo = track(new THREE.TorusGeometry(3.3 * LEG_R, 1.1 * LEG_R, 8, 18));
    const capGeo = track(new THREE.CylinderGeometry(1.6 * LEG_R, 1.6 * LEG_R, 0.6, 12));
    legs.forEach((leg, i) => {
      const y = -leg.L2 - 2;
      const ring = new THREE.Mesh(tireGeo, tire);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, y, 0);
      leg.kneeGroup.add(ring);
      const outer = i % 2 ? 1 : -1;   // 与 buildElephant 中近/远侧 z 一致
      const cap = new THREE.Mesh(capGeo, chrome);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, y, outer * 4.4 * LEG_R);
      leg.kneeGroup.add(cap);
    });
  },
  bumper({ headGroup, size, mat, track }) {
    const bar = new THREE.Mesh(track(new THREE.BoxGeometry(size * 0.12, size * 0.12, size * 1.35)), mat("chrome", CHROME));
    bar.position.set(size * 0.62, -size * 0.55, 0);
    headGroup.add(bar);
  },
};

export function buildElephant(model: ElephantModel, opts: BuildOptions): ElephantRig {
  const { materials, pack, playerIndex } = opts;
  const T = model.torso;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track: Track = x => { disposables.push(x); return x; };
  const eMat = (slot: ElephantSlot) => materials.get(pack.elephant[slot], playerIndex);
  const rMat = (slot: RiderSlot) => materials.get(pack.rider.materials[slot], playerIndex);

  // ---- 躯干（胶囊，沿 x；大象更圆更壮）----
  const radius = (T.thick / 2) * BULK;
  const torsoGeo = track(new THREE.CapsuleGeometry(radius, Math.max(10, T.len - radius * 2), 6, 16));
  const torso = new THREE.Mesh(torsoGeo, eMat("torso"));
  torso.rotation.z = Math.PI / 2;
  torso.position.set(T.cx, T.cy, 0);
  group.add(torso);

  // ---- 脖子 + 头（由识别模型驱动：脖子根/头端/朝向/耳尖/象鼻）----
  const H = model.head;
  const headAngle = H.dirX != null && H.dirY != null ? Math.atan2(H.dirY, H.dirX) : 0.6;
  const neckBase = H.neckBaseX != null && H.neckBaseY != null
    ? new THREE.Vector3(H.neckBaseX, H.neckBaseY, 0)
    : new THREE.Vector3(T.cx + T.len * 0.38, T.cy + T.thick * 0.28, 0);
  const neckEnd = new THREE.Vector3(H.neckX, H.neckY, 0);
  const neckDir = neckEnd.clone().sub(neckBase);
  const neckLen = Math.max(neckDir.length(), H.size * 0.4);
  const neckGeo = track(new THREE.CylinderGeometry(T.thick * 0.32, T.thick * 0.42, neckLen, 12));
  const neck = new THREE.Mesh(neckGeo, eMat("torso"));
  neck.position.copy(neckBase.clone().add(neckBase.clone().add(neckDir.clone().normalize().multiplyScalar(neckLen))).multiplyScalar(0.5));
  neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), neckDir.clone().normalize());
  group.add(neck);

  // 头组：原点在头心，x 轴 = 识别朝向，所有面部件随之一体旋转
  const headGroup = new THREE.Group();
  headGroup.position.set(H.x, H.y, 0);
  headGroup.rotation.z = headAngle;
  group.add(headGroup);
  const size = H.size;
  const cosA = Math.cos(-headAngle), sinA = Math.sin(-headAngle);
  // 模型本地坐标 → 头组本地坐标
  const toHead = (p: Vec2): THREE.Vector3 => {
    const x = p[0] - H.x, y = p[1] - H.y;
    return new THREE.Vector3(x * cosA - y * sinA, x * sinA + y * cosA, 0);
  };

  const headGeo = track(new THREE.SphereGeometry(size * 0.72, 16, 12));
  headGeo.scale(1.12, 1.0, 0.95);
  headGroup.add(new THREE.Mesh(headGeo, eMat("head")));
  // 额头隆起
  const browGeo = track(new THREE.SphereGeometry(size * 0.5, 12, 10));
  const brow = new THREE.Mesh(browGeo, eMat("head"));
  brow.position.set(-size * 0.08, size * 0.42, 0);
  headGroup.add(brow);

  // 象鼻：玩家画了就按曲线分节建模，否则程序化下垂回卷
  const trunkGroup = new THREE.Group();
  const trunkRoot = new THREE.Vector3(size * 0.62, -size * 0.3, 0);
  let trunkPts: THREE.Vector3[];
  if (H.trunk && H.trunk.length >= 2) {
    trunkPts = H.trunk.map(toHead);
    trunkRoot.copy(trunkPts[0]);
  } else {
    // 程序化象鼻：以世界方向「向前再向下垂、尾端回卷」生成，再逆旋转到头组本地系，
    // 这样无论玩家把头画得多仰，鼻子都自然下垂
    const cosB = Math.cos(-headAngle), sinB = Math.sin(-headAngle);
    trunkPts = [
      [0.0, 0.0], [0.28, -0.3], [0.46, -0.72], [0.52, -1.18], [0.46, -1.62], [0.3, -1.98], [0.06, -2.18], [-0.16, -2.12],
    ].map(([x, y]) => {
      const wx = x * size, wy = y * size;
      return new THREE.Vector3(wx * cosB - wy * sinB, wx * sinB + wy * cosB, 0).add(trunkRoot);
    });
  }
  trunkGroup.position.copy(trunkRoot);
  const trunkMat = eMat("trunk");
  for (let i = 0; i < trunkPts.length - 1; i++) {
    const f0 = i / (trunkPts.length - 1), f1 = (i + 1) / (trunkPts.length - 1);
    const r0 = size * (0.24 - 0.14 * f0), r1 = size * (0.24 - 0.14 * f1);
    const a = trunkPts[i].clone().sub(trunkRoot), b = trunkPts[i + 1].clone().sub(trunkRoot);
    trunkGroup.add(segmentBetween(a, b, r0, r1, trunkMat, track));
    const joint = new THREE.Mesh(track(new THREE.SphereGeometry(r1, 8, 6)), trunkMat);
    joint.position.copy(b);
    trunkGroup.add(joint);
  }
  headGroup.add(trunkGroup);

  // 象牙：两根前伸下弯的圆锥
  const tuskGeo = track(new THREE.ConeGeometry(size * 0.09, size * 0.72, 8));
  tuskGeo.translate(0, size * 0.36, 0);
  for (const s of [-1, 1]) {
    const tusk = new THREE.Mesh(tuskGeo, eMat("tusk"));
    tusk.position.set(size * 0.5, -size * 0.28, s * size * 0.26);
    tusk.rotation.z = -Math.PI / 2 - 0.42;
    tusk.rotation.y = s * 0.12;
    headGroup.add(tusk);
  }

  // 大扇耳：识别到耳尖 → 由耳根指向耳尖的扇形薄片；否则默认一对
  const earGeo = track(new THREE.SphereGeometry(1, 14, 10));
  const earRoot = new THREE.Vector3(-size * 0.18, size * 0.12, 0);
  const ears: THREE.Mesh[] = [];
  const earTips = (H.earTips ?? []).slice(0, 2).map(toHead);
  if (earTips.length === 1) earTips.push(earTips[0].clone());
  for (const s of [-1, 1] as const) {
    const ear = new THREE.Mesh(earGeo, eMat("ear"));
    const tip = earTips[s === -1 ? 0 : 1];
    if (tip) {
      const v = tip.clone().sub(earRoot);
      const len = Math.max(v.length(), size * 0.5);
      ear.scale.set(len * 0.5, len * 0.65, size * 0.08);
      ear.position.copy(earRoot.clone().add(v.clone().multiplyScalar(0.5)));
      ear.position.z = s * size * 0.6;
      ear.rotation.z = Math.atan2(v.y, v.x) - Math.PI / 2;
    } else {
      ear.scale.set(size * 0.6, size * 0.78, size * 0.08);
      ear.position.set(-size * 0.28, size * 0.1, s * size * 0.62);
    }
    ear.rotation.y = s * 0.45;
    headGroup.add(ear);
    ears.push(ear);
  }

  // 双眼（贴在头两侧，随头组朝向）
  const eyeGeo = track(new THREE.SphereGeometry(size * 0.075, 8, 6));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eMat("eye"));
    eye.position.set(size * 0.48, size * 0.2, s * size * 0.55);
    headGroup.add(eye);
  }

  // ---- 四条腿 ----
  const legRigs: LegRig[] = [];
  model.legs.forEach((leg, i) => {
    const { root, rig } = buildLeg(leg, eMat, track);
    root.position.z = i % 2 ? LEG_SPREAD : -LEG_SPREAD;   // 近/远侧
    group.add(root);
    legRigs.push(rig);
  });

  // ---- 大象附件（车灯 / 后视镜 / 车牌 / 轮胎脚 / 保险杠……）按风格包清单挂载 ----
  for (const spec of pack.elephantAccessories ?? []) {
    ELEPHANT_ACCESSORY_BUILDERS[spec.kind]?.({
      group, headGroup, size, torso: T, radius, legs: legRigs, track,
      mat: (slot, fallback) => materials.get(spec.materials?.[slot] ?? fallback, playerIndex),
    });
  }

  // ---- 尾巴（识别曲线 → 管状细尾；否则默认尾柱）----
  const tailGroup = new THREE.Group();
  group.add(tailGroup);
  let tailSwingPhase = 0;
  if (model.tail?.curve && model.tail.curve.length >= 2) {
    const cvs = model.tail.curve;
    const base = new THREE.Vector3(cvs[0][0], cvs[0][1], 0);
    const pts = cvs.map((c, i) => new THREE.Vector3(c[0] - base.x, c[1] - base.y, Math.sin(i * 1.4) * 1.2));
    const curve = new THREE.CatmullRomCurve3(pts);
    tailGroup.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 14, 1.5, 6, false)), eMat("tail")));
    const tuft = new THREE.Mesh(track(new THREE.SphereGeometry(2.4, 8, 6)), eMat("tail"));
    tuft.scale.set(1.6, 1, 1);
    tuft.position.copy(pts[pts.length - 1]);
    tailGroup.add(tuft);
    tailGroup.position.copy(base);
  } else {
    const tailGeo = track(new THREE.CylinderGeometry(1.6, 0.8, T.thick * 1.5, 8));
    tailGeo.translate(0, -T.thick * 0.75, 0);
    const tail = new THREE.Mesh(tailGeo, eMat("tail"));
    tail.position.set(T.cx - T.len * 0.5, T.cy + T.thick * 0.1, 0);
    tail.rotation.z = -0.5;
    group.add(tail);
  }

  // ---- 象毯（固定在象背上，驭象师颠飞时留在象身上）----
  const blanketGeo = track(new THREE.BoxGeometry(T.len * 0.46, 2.6, radius * 2.3));
  const blanket = new THREE.Mesh(blanketGeo, eMat("blanket"));
  blanket.position.set(T.cx, T.cy + radius * 0.74, 0);
  group.add(blanket);
  const drapeGeo = track(new THREE.BoxGeometry(T.len * 0.46, radius * 0.75, 1.2));
  for (const s of [-1, 1]) {
    const drape = new THREE.Mesh(drapeGeo, eMat("blanket"));
    drape.position.set(T.cx, T.cy + radius * 0.42, s * radius * 1.12);
    group.add(drape);
  }

  // ---- 驭象师与长鞭 ----
  const riderGroup = new THREE.Group();
  riderGroup.position.set(T.cx, T.cy + radius * 0.85, 0);
  group.add(riderGroup);

  const jacketGeo = track(new THREE.CylinderGeometry(radius * 0.38, radius * 0.34, radius * 1.2, 8));
  jacketGeo.translate(0, radius * 0.6, 0);
  const jacket = new THREE.Mesh(jacketGeo, rMat("jacket"));
  jacket.position.set(-radius * 0.1, 2, 0);
  jacket.rotation.z = -0.22; // 俯身冲刺姿态
  riderGroup.add(jacket);

  const headR = radius * 0.35;
  // 脸：风格包给了 face 档位就按连点强度切换表情（calm → tense → furious），否则用 skin
  const faceSpec = pack.rider.face;
  const faceMats = faceSpec
    ? (() => {
        const calm = materials.get(faceSpec.calm, playerIndex);
        const tense = faceSpec.tense ? materials.get(faceSpec.tense, playerIndex) : calm;
        const furious = faceSpec.furious ? materials.get(faceSpec.furious, playerIndex) : tense;
        return { calm, tense, furious };
      })()
    : null;
  const riderHead = new THREE.Mesh(track(new THREE.SphereGeometry(headR, 24, 16)), faceMats?.calm ?? rMat("skin"));
  riderHead.position.set(radius * 0.15, radius * 1.55, 0);
  riderGroup.add(riderHead);
  // 头发：后脑一块（phi 从 -π/2 到 π/2 → x≤0 的后半球，正脸 +x 留给脸贴图）
  const hair = new THREE.Mesh(track(new THREE.SphereGeometry(headR * 0.98, 10, 8, -Math.PI * 0.5, Math.PI, 0, Math.PI * 0.6)), rMat("hair"));
  hair.position.set(-headR * 0.05, headR * 0.05, 0);
  riderHead.add(hair);

  // 附件按风格包清单挂载
  const accCtx: AccessoryCtx = { head: riderHead, headR, body: riderGroup, bodyR: radius, mat: rMat, track };
  for (const acc of pack.rider.accessories) ACCESSORIES[acc]?.(accCtx);

  // 双腿跨骑
  const riderThighs: THREE.Mesh[] = [];
  const riderShins: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const thighGeo = track(new THREE.CylinderGeometry(1.6, 1.3, radius * 0.85, 6));
    thighGeo.translate(0, -radius * 0.42, 0);
    const rThigh = new THREE.Mesh(thighGeo, rMat("pants"));
    rThigh.position.set(radius * 0.1, 3, s * (radius * 0.92));
    rThigh.rotation.z = -0.65;
    riderGroup.add(rThigh);
    riderThighs.push(rThigh);

    const shinGeo = track(new THREE.CylinderGeometry(1.3, 1.0, radius * 0.8, 6));
    shinGeo.translate(0, -radius * 0.4, 0);
    const rShin = new THREE.Mesh(shinGeo, rMat("pants"));
    rShin.position.set(radius * 0.4, -radius * 0.25, s * (radius * 0.96));
    rShin.rotation.z = 0.35;
    riderGroup.add(rShin);
    riderShins.push(rShin);

    const boot = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 1.6, 2.2)), rMat("boots"));
    boot.position.set(radius * 0.45, -radius * 0.7, s * (radius * 0.96));
    riderGroup.add(boot);
  }

  // 左臂握缰
  const leftArmGeo = track(new THREE.CylinderGeometry(1.2, 0.9, radius * 0.9, 6));
  leftArmGeo.translate(0, -radius * 0.45, 0);
  const leftArm = new THREE.Mesh(leftArmGeo, rMat("jacket"));
  leftArm.position.set(radius * 0.1, radius * 1.1, -radius * 0.45);
  leftArm.rotation.z = -0.9;
  riderGroup.add(leftArm);
  const leftHand = new THREE.Mesh(track(new THREE.SphereGeometry(1.3, 6, 5)), rMat("skin"));
  leftHand.position.set(0, -radius * 0.9, 0);
  leftArm.add(leftHand);

  // 右臂挥鞭关节
  const whipArmGroup = new THREE.Group();
  whipArmGroup.position.set(-radius * 0.05, radius * 1.15, radius * 0.45);
  riderGroup.add(whipArmGroup);
  const rightArmGeo = track(new THREE.CylinderGeometry(1.2, 0.9, radius * 0.85, 6));
  rightArmGeo.translate(0, -radius * 0.42, 0);
  const rightArm = new THREE.Mesh(rightArmGeo, rMat("jacket"));
  rightArm.rotation.z = -0.3;
  whipArmGroup.add(rightArm);

  const whipGroup = new THREE.Group();
  whipGroup.position.set(0, -radius * 0.8, 0);
  whipArmGroup.add(whipGroup);
  const rightHand = new THREE.Mesh(track(new THREE.SphereGeometry(1.3, 6, 5)), rMat("skin"));
  whipGroup.add(rightHand);
  const whipStickGeo = track(new THREE.CylinderGeometry(0.5, 0.25, T.len * 0.45, 6));
  whipStickGeo.translate(0, -T.len * 0.22, 0);
  const whipStick = new THREE.Mesh(whipStickGeo, rMat("whipStick"));
  whipStick.rotation.z = -0.6;
  whipGroup.add(whipStick);
  const whipLashGeo = track(new THREE.CylinderGeometry(0.25, 0.08, T.len * 0.22, 4));
  whipLashGeo.translate(0, -T.len * 0.11, 0);
  const whipLash = new THREE.Mesh(whipLashGeo, rMat("whipLash"));
  whipLash.position.set(-T.len * 0.24, -T.len * 0.35, 0);
  whipLash.rotation.z = -0.2;
  whipGroup.add(whipLash);

  let whipPhase = 0;
  let earPhase = 0;
  let trunkLift = 0;

  const headLocal = new THREE.Vector3(H.x, H.y + H.size * 0.2, 0);

  function setPose(
    pose: Pose,
    whipIntensity = 0,
    dt = 0.016,
    buckedOff = false,
    riderFlyY = 0,
    riderFlyRot = 0,
    riderFlyX = 0
  ) {
    legRigs.forEach((rig, i) => {
      const pl = pose.legs[i];
      if (!pl) return;
      rig.hipGroup.rotation.z = pl.thigh;
      rig.kneeGroup.rotation.z = rig.dir * pl.fold;
    });
    group.rotation.z = pose.pitch;
    group.position.y = pose.bob * group.scale.y;

    // 扇耳随步伐扇动
    earPhase += dt * 7;
    ears.forEach((ear, i) => { ear.rotation.y = (i === 0 ? -1 : 1) * (0.45 + Math.sin(earPhase + i) * 0.18); });

    // 表情：甩飞或猛抽 → 暴怒；轻抽 → 紧绷；否则常态
    if (faceMats) {
      const face = buckedOff || whipIntensity > 0.7 ? faceMats.furious : whipIntensity > 0.2 ? faceMats.tense : faceMats.calm;
      if (riderHead.material !== face) riderHead.material = face;
    }

    if (buckedOff) {
      // 抽象大风车狂甩肢体与高空弹射旋转（抛飞高度系数与 raceScene 的第二人称相机取景一致）
      riderGroup.position.set(
        T.cx - radius * 0.1 - riderFlyX,
        T.cy + radius * 0.85 + riderFlyY * RIDER_FLY_HEIGHT,
        Math.sin(riderFlyRot * 4) * 6
      );
      riderGroup.rotation.set(riderFlyRot * 1.4, riderFlyRot * 0.9, riderFlyRot * 1.8);
      const flail = Math.sin(riderFlyRot * 15);
      const flailCos = Math.cos(riderFlyRot * 15);
      leftArm.rotation.set(flail * 2.2, 0, flailCos * 2.5);
      whipArmGroup.rotation.set(-flail * 2.5, 0, -flailCos * 2.8);
      whipGroup.rotation.set(flailCos * 3.5, flail * 3.5, flail * 4);
      if (riderThighs[0]) riderThighs[0].rotation.set(flail * 1.4, 0, -0.65 + flail * 1.8);
      if (riderThighs[1]) riderThighs[1].rotation.set(-flail * 1.4, 0, -0.65 - flail * 1.8);
      if (riderShins[0]) riderShins[0].rotation.set(0, 0, 0.35 + flailCos * 2.2);
      if (riderShins[1]) riderShins[1].rotation.set(0, 0, 0.35 - flailCos * 2.2);
      riderHead.rotation.set(Math.sin(riderFlyRot * 18) * 0.8, Math.cos(riderFlyRot * 15) * 1.2, 0);
      // 大象扭头回眸，象鼻高高扬起目送驭象师升天（第二人称回望）
      headGroup.rotation.set(0.1, -1.35, -0.2);
      trunkGroup.rotation.z = 1.1 + Math.sin(riderFlyRot * 6) * 0.15;
    } else {
      riderGroup.position.set(T.cx, T.cy + radius * 0.85, 0);
      riderGroup.rotation.set(0, 0, -pose.pitch * 0.3);
      headGroup.rotation.set(0, 0, headAngle);
      leftArm.rotation.set(0, 0, -0.9);
      riderHead.rotation.set(0, 0, 0);
      riderThighs.forEach(t => t.rotation.set(0, 0, -0.65));
      riderShins.forEach(s => s.rotation.set(0, 0, 0.35));

      tailSwingPhase += dt * 9;
      tailGroup.rotation.z = Math.sin(tailSwingPhase) * 0.18 * (model.tail?.swing ?? 0.5);
      tailGroup.rotation.x = Math.cos(tailSwingPhase * 0.7) * 0.1 * (model.tail?.swing ?? 0.5);

      // 象鼻：随步伐轻摆；连点加速越猛，象鼻扬得越高（象鸣姿态）
      const targetLift = whipIntensity * 0.95;
      trunkLift += (targetLift - trunkLift) * Math.min(1, dt * 6);
      trunkGroup.rotation.z = trunkLift + Math.sin(tailSwingPhase * 0.9) * 0.08;
      trunkGroup.rotation.x = Math.sin(tailSwingPhase * 0.6) * 0.06;

      if (whipIntensity > 0.02) {
        whipPhase += dt * (10 + whipIntensity * 32);
        const swing = Math.sin(whipPhase);
        whipArmGroup.rotation.z = -0.4 - whipIntensity * 0.6 + swing * (0.8 + whipIntensity * 0.9);
        whipGroup.rotation.z = swing * (0.6 + whipIntensity * 0.8);
      } else {
        whipArmGroup.rotation.z = -0.25;
        whipGroup.rotation.z = 0.05;
      }
    }
  }

  return {
    group, setPose, headLocal,
    dispose() {
      // 材质由 MaterialResolver 统一持有与释放，这里只释放几何
      disposables.forEach(d => d.dispose());
    },
  };
}

export { computePose };
