// horseMesh.ts —— 由识别模型生成 3D 马（THREE.Group），Birth 与 Race 共用。
// 连杆动画：每帧按 gait.ts 的 computePose 得到 thigh/fold 角度，
// 大腿绕髋旋转、小腿相对膝盖旋转（与 legPoints 前向运动学一致）。
import * as THREE from "three";
import { computePose } from "../game/gait";
import type { HorseModel, LegModel, Pose } from "../game/types";

// 模型本地坐标（躯干 120 单位）→ 世界尺度
export const WORLD_SCALE = 0.02;

export interface HorseRig {
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

function mat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// 一条腿：hipGroup(髋) → 大腿 mesh + kneeGroup(膝) → 小腿 mesh + 蹄
interface LegRig {
  hipGroup: THREE.Group;
  kneeGroup: THREE.Group;
  dir: 1 | -1;   // hind=-1(前收)/fore=1，与 legPoints 的 dir 一致
}

function buildLeg(leg: LegModel, color: string): { root: THREE.Group; rig: LegRig } {
  const dir = (leg.type === "hind" ? -1 : 1) as 1 | -1;
  const hipGroup = new THREE.Group();
  hipGroup.position.set(leg.hip[0], leg.hip[1], 0);

  const thighGeo = new THREE.CylinderGeometry(4.2, 3.4, leg.L1, 10);
  thighGeo.translate(0, -leg.L1 / 2, 0);   // 顶端对齐髋，向下伸
  const thigh = new THREE.Mesh(thighGeo, mat(color));
  hipGroup.add(thigh);

  const kneeGroup = new THREE.Group();
  kneeGroup.position.set(0, -leg.L1, 0);
  const shinGeo = new THREE.CylinderGeometry(3.0, 2.2, leg.L2, 10);
  shinGeo.translate(0, -leg.L2 / 2, 0);
  const shin = new THREE.Mesh(shinGeo, mat(shade(color, 0.85)));
  kneeGroup.add(shin);

  const hoofGeo = new THREE.CylinderGeometry(3.4, 3.8, 5, 10);
  hoofGeo.translate(0, -leg.L2 - 2, 0);
  const hoof = new THREE.Mesh(hoofGeo, mat("#3a2e26"));
  kneeGroup.add(hoof);

  hipGroup.add(kneeGroup);
  return { root: hipGroup, rig: { hipGroup, kneeGroup, dir } };
}

export function buildHorse(model: HorseModel, color: string): HorseRig {
  const T = model.torso;
  const dark = shade(color, 0.72);
  const darker = shade(color, 0.5);
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const track = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };

  // ---- 躯干（胶囊，沿 x）----
  const radius = T.thick / 2;
  const torsoGeo = track(new THREE.CapsuleGeometry(radius, T.len - radius * 2, 6, 14));
  const torso = new THREE.Mesh(torsoGeo, mat(color));
  torso.rotation.z = Math.PI / 2;
  torso.position.set(T.cx, T.cy, 0);
  group.add(torso);

  // ---- 脖子 + 头 ----
  const H = model.head;
  const neckBase = new THREE.Vector3(T.cx + T.len * 0.38, T.cy + T.thick * 0.28, 0);
  const neckEnd = new THREE.Vector3(H.neckX, H.neckY, 0);
  const neckDir = neckEnd.clone().sub(neckBase);
  const neckGeo = track(new THREE.CylinderGeometry(T.thick * 0.26, T.thick * 0.34, neckDir.length(), 10));
  const neck = new THREE.Mesh(neckGeo, mat(color));
  neck.position.copy(neckBase.clone().add(neckEnd).multiplyScalar(0.5));
  neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), neckDir.clone().normalize());
  group.add(neck);

  const headGeo = track(new THREE.SphereGeometry(H.size * 0.55, 14, 10));
  headGeo.scale(1.35, 0.8, 0.8);
  const head = new THREE.Mesh(headGeo, mat(color));
  head.position.set(H.x, H.y, 0);
  head.rotation.z = 0.35;
  group.add(head);
  // 吻部
  const muzzleGeo = track(new THREE.SphereGeometry(H.size * 0.3, 10, 8));
  muzzleGeo.scale(1.4, 0.9, 0.9);
  const muzzle = new THREE.Mesh(muzzleGeo, mat(darker));
  muzzle.position.set(H.x + H.size * 0.55, H.y - H.size * 0.15, 0);
  group.add(muzzle);
  // 双耳
  for (const s of [-1, 1]) {
    const earGeo = track(new THREE.ConeGeometry(2.6, H.size * 0.5, 6));
    const ear = new THREE.Mesh(earGeo, mat(dark));
    ear.position.set(H.x - H.size * 0.15, H.y + H.size * 0.5, s * 3.5);
    ear.rotation.z = -0.15;
    group.add(ear);
  }
  // 双眼
  const eyeGeo = track(new THREE.SphereGeometry(1.6, 8, 6));
  const eyeMat = track(new THREE.MeshStandardMaterial({ color: "#222", roughness: 0.4 }));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(H.x + H.size * 0.25, H.y + H.size * 0.12, s * H.size * 0.4);
    group.add(eye);
  }

  // ---- 四条腿 ----
  const legRoots: THREE.Group[] = [];
  const legRigs: LegRig[] = [];
  model.legs.forEach((leg, i) => {
    const { root, rig } = buildLeg(leg, i % 2 ? color : dark);
    root.position.z = i % 2 ? 5.5 : -5.5;   // 近/远侧
    group.add(root);
    legRoots.push(root);
    legRigs.push(rig);
    disposables.push((root.children[0] as THREE.Mesh).geometry,
      ((root.children[0] as THREE.Mesh).material as THREE.Material),
      (rig.kneeGroup.children[0] as THREE.Mesh).geometry,
      (rig.kneeGroup.children[0] as THREE.Mesh).material as THREE.Material,
      (rig.kneeGroup.children[1] as THREE.Mesh).geometry,
      (rig.kneeGroup.children[1] as THREE.Mesh).material as THREE.Material);
  });

  // ---- 尾巴 ----
  const tailGeo = track(new THREE.CylinderGeometry(2.2, 1.0, T.thick * 1.6, 8));
  tailGeo.translate(0, -T.thick * 0.8, 0);
  const tail = new THREE.Mesh(tailGeo, mat(darker));
  tail.position.set(T.cx - T.len * 0.5, T.cy + T.thick * 0.1, 0);
  tail.rotation.z = -0.7;
  group.add(tail);

  // ---- 默认人类骑手形象与马鞭 ----
  const riderGroup = new THREE.Group();
  riderGroup.position.set(T.cx, T.cy + radius * 0.85, 0);
  group.add(riderGroup);

  // 1. 马鞍垫
  const saddleGeo = track(new THREE.BoxGeometry(T.len * 0.36, 3, radius * 1.7));
  const saddleMat = track(new THREE.MeshStandardMaterial({ color: "#221c18", roughness: 0.9 }));
  const saddle = new THREE.Mesh(saddleGeo, saddleMat);
  saddle.position.set(0, 1.5, 0);
  riderGroup.add(saddle);

  // 2. 骑手上身 / 骑手服
  const jacketGeo = track(new THREE.CylinderGeometry(radius * 0.38, radius * 0.34, radius * 1.2, 8));
  jacketGeo.translate(0, radius * 0.6, 0);
  const jacketMat = track(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }));
  const jacket = new THREE.Mesh(jacketGeo, jacketMat);
  jacket.position.set(-radius * 0.1, 2, 0);
  jacket.rotation.z = -0.22; // 竞速俯身冲刺姿态
  riderGroup.add(jacket);

  // 3. 骑手头部与头盔面罩
  const headR = radius * 0.35;
  const riderHeadGeo = track(new THREE.SphereGeometry(headR, 12, 10));
  const skinMat = track(new THREE.MeshStandardMaterial({ color: "#ffcaa0", roughness: 0.7 }));
  const riderHead = new THREE.Mesh(riderHeadGeo, skinMat);
  riderHead.position.set(radius * 0.15, radius * 1.55, 0);
  riderGroup.add(riderHead);

  const helmetGeo = track(new THREE.SphereGeometry(headR * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55));
  const helmetMat = track(new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, headR * 0.12, 0);
  riderHead.add(helmet);

  const visorGeo = track(new THREE.BoxGeometry(headR * 0.9, 1.2, headR * 1.1));
  const visorMat = track(new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.3 }));
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(headR * 0.65, headR * 0.1, 0);
  visor.rotation.z = -0.15;
  riderHead.add(visor);

  // 4. 双腿跨骑
  const legColorMat = track(new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 }));
  const bootMat = track(new THREE.MeshStandardMaterial({ color: "#1a1614", roughness: 0.5 }));
  const riderThighs: THREE.Mesh[] = [];
  const riderShins: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const thighGeo = track(new THREE.CylinderGeometry(1.6, 1.3, radius * 0.85, 6));
    thighGeo.translate(0, -radius * 0.42, 0);
    const rThigh = new THREE.Mesh(thighGeo, legColorMat);
    rThigh.position.set(radius * 0.1, 3, s * (radius * 0.92));
    rThigh.rotation.z = -0.65; // 大腿前倾夹住马身
    riderGroup.add(rThigh);
    riderThighs.push(rThigh);

    const shinGeo = track(new THREE.CylinderGeometry(1.3, 1.0, radius * 0.8, 6));
    shinGeo.translate(0, -radius * 0.4, 0);
    const rShin = new THREE.Mesh(shinGeo, legColorMat);
    rShin.position.set(radius * 0.4, -radius * 0.25, s * (radius * 0.96));
    rShin.rotation.z = 0.35; // 小腿踩在马镫
    riderGroup.add(rShin);
    riderShins.push(rShin);

    const bootGeo = track(new THREE.BoxGeometry(2.4, 1.6, 2.2));
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(radius * 0.45, -radius * 0.7, s * (radius * 0.96));
    riderGroup.add(boot);
  }

  // 5. 左臂与缰绳（左手握缰）
  const armMat = jacketMat;
  const leftArmGeo = track(new THREE.CylinderGeometry(1.2, 0.9, radius * 0.9, 6));
  leftArmGeo.translate(0, -radius * 0.45, 0);
  const leftArm = new THREE.Mesh(leftArmGeo, armMat);
  leftArm.position.set(radius * 0.1, radius * 1.1, -radius * 0.45);
  leftArm.rotation.z = -0.9;
  riderGroup.add(leftArm);

  // 6. 右臂挥鞭关节（马鞭抽打马儿屁股）
  const whipArmGroup = new THREE.Group();
  whipArmGroup.position.set(-radius * 0.05, radius * 1.15, radius * 0.45);
  riderGroup.add(whipArmGroup);

  const rightArmGeo = track(new THREE.CylinderGeometry(1.2, 0.9, radius * 0.85, 6));
  rightArmGeo.translate(0, -radius * 0.42, 0);
  const rightArm = new THREE.Mesh(rightArmGeo, armMat);
  rightArm.rotation.z = -0.3;
  whipArmGroup.add(rightArm);

  // 鞭杆与皮鞭尖
  const whipGroup = new THREE.Group();
  whipGroup.position.set(0, -radius * 0.8, 0);
  whipArmGroup.add(whipGroup);

  const whipStickGeo = track(new THREE.CylinderGeometry(0.5, 0.25, T.len * 0.45, 6));
  whipStickGeo.translate(0, -T.len * 0.22, 0);
  const whipStickMat = track(new THREE.MeshStandardMaterial({ color: "#2d1810", roughness: 0.6 }));
  const whipStick = new THREE.Mesh(whipStickGeo, whipStickMat);
  whipStick.rotation.z = -0.6; // 鞭身朝后指向马屁股
  whipGroup.add(whipStick);

  const whipLashGeo = track(new THREE.CylinderGeometry(0.25, 0.08, T.len * 0.22, 4));
  whipLashGeo.translate(0, -T.len * 0.11, 0);
  const whipLashMat = track(new THREE.MeshStandardMaterial({ color: "#e88024", roughness: 0.8 }));
  const whipLash = new THREE.Mesh(whipLashGeo, whipLashMat);
  whipLash.position.set(-T.len * 0.24, -T.len * 0.35, 0);
  whipLash.rotation.z = -0.2;
  whipGroup.add(whipLash);

  let whipPhase = 0;

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
      rig.hipGroup.rotation.z = pl.thigh;             // 与 legPoints: knee = hip + L1(sin th, -cos th)
      rig.kneeGroup.rotation.z = rig.dir * pl.fold;   // 小腿相对折叠
    });
    group.rotation.z = pose.pitch;
    // pose.bob 是模型本地单位，需换算到父级世界尺度
    group.position.y = pose.bob * group.scale.y;

    if (buckedOff) {
      // 抽象大风车狂甩肢体与高空弹射旋转
      riderGroup.position.set(
        T.cx - radius * 0.1 - riderFlyX,
        T.cy + radius * 0.85 + riderFlyY * 20,
        Math.sin(riderFlyRot * 4) * 6
      );
      // 三维多轴失控狂转
      riderGroup.rotation.set(riderFlyRot * 1.4, riderFlyRot * 0.9, riderFlyRot * 1.8);

      // 四肢抽象大风车狂甩
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

      // 战马扭过头来回眸看着颠飞的你（第二人称回望）
      head.rotation.set(0.1, -1.35, -0.2);
    } else {
      // 正常跑动
      riderGroup.position.set(T.cx, T.cy + radius * 0.85, 0);
      riderGroup.rotation.set(0, 0, -pose.pitch * 0.3);
      head.rotation.set(0, 0, 0.35);
      leftArm.rotation.set(0, 0, -0.9);
      riderHead.rotation.set(0, 0, 0);
      riderThighs.forEach(t => t.rotation.set(0, 0, -0.65));
      riderShins.forEach(s => s.rotation.set(0, 0, 0.35));

      if (whipIntensity > 0.02) {
        // 点击屏幕越激烈，挥鞭频率越快，幅度越大
        whipPhase += dt * (10 + whipIntensity * 32);
        const swing = Math.sin(whipPhase);
        // 扬起手臂并全力抽下
        whipArmGroup.rotation.z = -0.4 - whipIntensity * 0.6 + swing * (0.8 + whipIntensity * 0.9);
        whipGroup.rotation.z = swing * (0.6 + whipIntensity * 0.8);
      } else {
        // 未连点时处于准备挥鞭姿势，轻微怠速晃动
        whipArmGroup.rotation.z = -0.25;
        whipGroup.rotation.z = 0.05;
      }
    }
  }

  return {
    group, setPose, headLocal,
    dispose() {
      disposables.forEach(d => d.dispose());
      group.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) {
            m.forEach(x => x.dispose());
          } else {
            m.dispose();
          }
        }
      });
    },
  };
}

export { computePose };
