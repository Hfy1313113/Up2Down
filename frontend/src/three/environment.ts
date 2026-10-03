// environment.ts —— 赛道环境构建机制：天空、雾、灯光、地面、跑道、栅栏、终点门、礼花筒、云朵与装饰物，
// 全部读自风格包 environment 声明；本文件不含任何具体风格的颜色。
import * as THREE from "three";
import type { MaterialResolver } from "../style/materials";
import type { StylePack } from "../style/types";
import { buildProps } from "./props";

type Track = <T extends { dispose(): void }>(x: T) => T;

export interface EnvironmentHandles {
  gateX: number;
  cannonPositions: [number, number, number][];
}

/** 渐变天空：画成 2×256 的 Canvas 纹理作为场景背景 */
function skyTexture(top: string, bottom: string, track: Track): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 2; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildEnvironment(
  scene: THREE.Scene,
  pack: StylePack,
  resolver: MaterialResolver,
  trackLenWorld: number,
  track: Track,
): EnvironmentHandles {
  const env = pack.environment;

  // 天空与雾
  if (typeof env.sky === "string") scene.background = new THREE.Color(env.sky);
  else scene.background = skyTexture(env.sky.top, env.sky.bottom, track);
  scene.fog = new THREE.Fog(env.fog.color, env.fog.near, env.fog.far);

  // 灯光
  const hemi = new THREE.HemisphereLight(env.lights.hemiSky, env.lights.hemiGround, env.lights.hemiIntensity);
  const sun = new THREE.DirectionalLight(env.lights.sunColor, env.lights.sunIntensity);
  const sp = env.lights.sunPosition ?? [40, 80, 30];
  sun.position.set(sp[0], sp[1], sp[2]);
  scene.add(hemi, sun);

  // 地面与跑道
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(trackLenWorld + 400, 400)), resolver.get(env.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(trackLenWorld / 2, 0, 0);
  scene.add(ground);
  const lane = new THREE.Mesh(track(new THREE.PlaneGeometry(trackLenWorld + 40, 18)), resolver.get(env.lane));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(trackLenWorld / 2, 0.01, 0);
  scene.add(lane);

  // 栅栏（沿赛道两侧重复）
  const postGeo = track(new THREE.BoxGeometry(0.18, 0.9, 0.18));
  const railGeo = track(new THREE.BoxGeometry(4, 0.1, 0.08));
  const fenceMat = resolver.get(env.fence);
  const spacing = 4;
  const count = Math.ceil((trackLenWorld + 20) / spacing);
  const posts = new THREE.InstancedMesh(postGeo, fenceMat, count * 2);
  const rails = new THREE.InstancedMesh(railGeo, fenceMat, count * 2);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = i * spacing - 10;
    m4.makeTranslation(x, 0.45, -9); posts.setMatrixAt(i * 2, m4);
    m4.makeTranslation(x, 0.45, 9); posts.setMatrixAt(i * 2 + 1, m4);
    m4.makeTranslation(x + spacing / 2, 0.7, -9); rails.setMatrixAt(i * 2, m4);
    m4.makeTranslation(x + spacing / 2, 0.7, 9); rails.setMatrixAt(i * 2 + 1, m4);
  }
  scene.add(posts, rails);
  track(posts); track(rails);

  // 终点门
  const gateX = trackLenWorld;
  const poleGeo = track(new THREE.CylinderGeometry(0.25, 0.25, 6, 10));
  const poleMat = resolver.get(env.gate.pole);
  for (const z of [-9, 9]) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(gateX, 3, z);
    scene.add(pole);
  }
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = 128; bannerCanvas.height = 16;
  const bctx = bannerCanvas.getContext("2d")!;
  for (let i = 0; i < 16; i++) {
    bctx.fillStyle = env.gate.bannerColors[i % 2];
    bctx.fillRect(i * 8, 0, 8, 16);
  }
  const bannerTex = track(new THREE.CanvasTexture(bannerCanvas));
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(track(new THREE.PlaneGeometry(16, 1.6)), track(new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })));
  banner.position.set(gateX, 5.4, 0);
  banner.rotation.y = Math.PI / 2;
  scene.add(banner);

  // 礼花筒基座
  const cannonGeo = track(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 8));
  const cannonMat = resolver.get(env.gate.cannon);
  const cannonPositions: [number, number, number][] = [];
  for (const z of [-8.5, 8.5]) {
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.position.set(gateX - 0.5, 0.8, z);
    cannon.rotation.z = (z < 0 ? -1 : 1) * 0.35;
    scene.add(cannon);
    cannonPositions.push([gateX - 0.5, 0.8, z]);
  }

  // 云朵
  if (env.clouds && env.clouds.count > 0) {
    const cloudGeo = track(new THREE.SphereGeometry(1.6, 10, 8));
    const cloudMat = track(new THREE.MeshStandardMaterial({ color: env.clouds.color, roughness: 1 }));
    for (let i = 0; i < env.clouds.count; i++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(j * 1.4 - 1.4, j === 1 ? 0.4 : 0, 0);
        puff.scale.setScalar(1 - Math.abs(j - 1) * 0.3);
        cl.add(puff);
      }
      cl.position.set((i * 37) % trackLenWorld, 14 + (i * 13) % 10, -20 - (i * 17) % 40);
      scene.add(cl);
    }
  }

  // 装饰物
  for (const spec of env.props) buildProps(scene, spec, resolver, trackLenWorld, track);

  return { gateX, cannonPositions };
}
