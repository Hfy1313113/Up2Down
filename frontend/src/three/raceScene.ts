// raceScene.ts —— three.js 真实 3D 赛跑场景：地面/终点门/天空/灯光，
// 马匹由 horseMesh 生成、按 raceSim 状态驱动（raceSim 仍是唯一确定性来源，本层只消费）。
import * as THREE from "three";
import { computePose } from "../game/gait";
import { TRACK_LEN } from "../game/raceSim";
import type { RaceState } from "../game/raceSim";
import { buildHorse, WORLD_SCALE, type HorseRig } from "./horseMesh";

export type ViewMode = "third" | "first";

interface HorseObj {
  rig: HorseRig;
}

export class RaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private horses: HorseObj[] = [];
  private disposables: { dispose(): void }[] = [];
  private myIndex: number;
  private cameraX = 0;

  constructor(canvas: HTMLCanvasElement, entries: { name: string; color: string; model: import("../game/types").HorseModel }[], myIndex: number) {
    this.myIndex = myIndex;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#6ec1f5");
    this.scene.fog = new THREE.Fog("#bfe6ff", 60, 240);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
    this.track(this.camera);

    // 灯光
    const hemi = new THREE.HemisphereLight("#dff3ff", "#5da84a", 1.1);
    const sun = new THREE.DirectionalLight("#fff4d6", 1.4);
    sun.position.set(40, 80, 30);
    this.scene.add(hemi, sun);

    const S = WORLD_SCALE;
    // 地面
    const groundGeo = this.track(new THREE.PlaneGeometry(TRACK_LEN * S + 400, 400));
    const groundMat = this.track(new THREE.MeshStandardMaterial({ color: "#6fbf58", roughness: 1 }));
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(TRACK_LEN * S / 2, 0, 0);
    this.scene.add(ground);

    // 跑道（稍深的色带）
    const laneGeo = this.track(new THREE.PlaneGeometry(TRACK_LEN * S + 40, 18));
    const laneMat = this.track(new THREE.MeshStandardMaterial({ color: "#8fce6e", roughness: 1 }));
    const lane = new THREE.Mesh(laneGeo, laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(TRACK_LEN * S / 2, 0.01, 0);
    this.scene.add(lane);

    // 栅栏（沿赛道两侧重复）
    const postGeo = this.track(new THREE.BoxGeometry(0.18, 0.9, 0.18));
    const postMat = this.track(new THREE.MeshStandardMaterial({ color: "#a5713f" }));
    const railGeo = this.track(new THREE.BoxGeometry(4, 0.1, 0.08));
    const railMat = postMat;
    const spacing = 4;
    const count = Math.ceil((TRACK_LEN * S + 20) / spacing);
    const posts = new THREE.InstancedMesh(postGeo, postMat, count * 2);
    const rails = new THREE.InstancedMesh(railGeo, railMat, count * 2);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const x = i * spacing - 10;
      m4.makeTranslation(x, 0.45, -9);
      posts.setMatrixAt(i * 2, m4);
      m4.makeTranslation(x, 0.45, 9);
      posts.setMatrixAt(i * 2 + 1, m4);
      m4.makeTranslation(x + spacing / 2, 0.7, -9);
      rails.setMatrixAt(i * 2, m4);
      m4.makeTranslation(x + spacing / 2, 0.7, 9);
      rails.setMatrixAt(i * 2 + 1, m4);
    }
    this.scene.add(posts, rails);

    // 终点门（在 x = TRACK_LEN*S）
    const gateX = TRACK_LEN * S;
    const poleGeo = this.track(new THREE.CylinderGeometry(0.25, 0.25, 6, 10));
    const poleMat = this.track(new THREE.MeshStandardMaterial({ color: "#e2703a" }));
    for (const z of [-9, 9]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(gateX, 3, z);
      this.scene.add(pole);
    }
    // 黑白格横幅
    const bannerCanvas = document.createElement("canvas");
    bannerCanvas.width = 128; bannerCanvas.height = 16;
    const bctx = bannerCanvas.getContext("2d")!;
    for (let i = 0; i < 16; i++) {
      bctx.fillStyle = i % 2 ? "#111" : "#fff";
      bctx.fillRect(i * 8, 0, 8, 16);
    }
    const bannerTex = this.track(new THREE.CanvasTexture(bannerCanvas));
    const bannerGeo = this.track(new THREE.PlaneGeometry(16, 1.6));
    const bannerMat = this.track(new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }));
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(gateX, 5.4, 0);
    banner.rotation.y = Math.PI / 2;
    this.scene.add(banner);

    // 云朵（简单球簇）
    const cloudGeo = this.track(new THREE.SphereGeometry(1.6, 10, 8));
    const cloudMat = this.track(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }));
    for (let i = 0; i < 14; i++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(j * 1.4 - 1.4, j === 1 ? 0.4 : 0, 0);
        puff.scale.setScalar(1 - Math.abs(j - 1) * 0.3);
        cl.add(puff);
      }
      cl.position.set((i * 37) % (TRACK_LEN * S), 14 + (i * 13) % 10, -20 - (i * 17) % 40);
      this.scene.add(cl);
    }

    // 马匹
    entries.forEach((e) => {
      const rig = buildHorse(e.model, e.color);
      rig.group.scale.setScalar(S);
      this.scene.add(rig.group);
      this.horses.push({ rig });
    });

    this.resize();
  }

  private track<T extends { dispose(): void }>(x: T): T { this.disposables.push(x); return x; }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(st: RaceState, view: ViewMode, dt: number): void {
    const S = WORLD_SCALE;
    const leaderX = Math.max(...st.runners.map(r => Math.min(r.x, TRACK_LEN))) * S;
    this.cameraX += (Math.max(0, Math.min(leaderX, TRACK_LEN * S - 20)) - this.cameraX) * Math.min(1, dt * 4 + 0.08);

    st.runners.forEach((r, i) => {
      const obj = this.horses[i];
      if (!obj) return;
      const pose = computePose(r.model, r.phase);
      obj.rig.setPose(pose);
      obj.rig.group.position.x = r.x * S;
      obj.rig.group.position.z = (i - (st.runners.length - 1) / 2) * 4;
      obj.rig.group.visible = true;
    });

    if (view === "first") {
      const me = st.runners[this.myIndex] ?? st.runners[0];
      const myObj = this.horses[this.myIndex] ?? this.horses[0];
      const pose = computePose(me.model, me.phase);
      const head = myObj.rig.headLocal.clone().multiplyScalar(S);
      const z = myObj.rig.group.position.z;
      const bob = pose.bob * S;
      this.camera.position.set(me.x * S - 1.8, head.y + 0.95 + bob, z);
      this.camera.lookAt(me.x * S + 16, head.y - 0.9 + bob, z);
    } else {
      this.camera.position.set(this.cameraX - 10, 7.5, 14);
      this.camera.lookAt(this.cameraX + 5, 1.2, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.horses.forEach(h => h.rig.dispose());
    this.disposables.forEach(d => d.dispose());
    this.renderer.dispose();
  }
}
