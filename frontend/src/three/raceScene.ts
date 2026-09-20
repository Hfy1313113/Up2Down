// raceScene.ts —— three.js 真实 3D 赛跑场景：地面/终点门/天空/灯光，
// 马匹由 horseMesh 生成、按 raceSim 状态驱动（raceSim 仍是唯一确定性来源，本层只消费）。
// 支持第三人称追踪自身、第一人称自由转头环视、物理碰撞渲染与头名冲线礼花筒动画。
import * as THREE from "three";
import { computePose } from "../game/gait";
import { TRACK_LEN } from "../game/raceSim";
import type { RaceState } from "../game/raceSim";
import { buildHorse, WORLD_SCALE, type HorseRig } from "./horseMesh";

export type ViewMode = "third" | "first";

interface HorseObj {
  rig: HorseRig;
  textSprite: THREE.Sprite;
  spriteCanvas: HTMLCanvasElement;
  spriteTex: THREE.CanvasTexture;
  lastText: string | null;
}

interface ConfettiPiece {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
}

export class RaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private horses: HorseObj[] = [];
  private disposables: { dispose(): void }[] = [];
  private myIndex: number;
  private cameraX = 0;
  private cameraZ = 0;

  // 第一人称转头环视角度
  private lookYaw = 0;
  private lookPitch = 0;
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // 礼花筒粒子系统
  private confettiGroup: THREE.Group;
  private confettiPieces: ConfettiPiece[] = [];
  private confettiFired = false;

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

    // 礼花筒发射器基座模型
    const cannonGeo = this.track(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 8));
    const cannonMat = this.track(new THREE.MeshStandardMaterial({ color: "#f59e0b", metalness: 0.6, roughness: 0.3 }));
    for (const z of [-8.5, 8.5]) {
      const cannon = new THREE.Mesh(cannonGeo, cannonMat);
      cannon.position.set(gateX - 0.5, 0.8, z);
      cannon.rotation.z = (z < 0 ? -1 : 1) * 0.35;
      this.scene.add(cannon);
    }

    // 礼花粒子容器
    this.confettiGroup = new THREE.Group();
    this.scene.add(this.confettiGroup);
    this.initConfettiSystem();

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

    // 马匹与碰撞浮动文案 Sprite
    entries.forEach((e) => {
      const rig = buildHorse(e.model, e.color);
      rig.group.scale.setScalar(S);
      this.scene.add(rig.group);

      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = 256;
      spriteCanvas.height = 80;
      const spriteTex = this.track(new THREE.CanvasTexture(spriteCanvas));
      const spriteMat = this.track(new THREE.SpriteMaterial({ map: spriteTex, transparent: true }));
      const textSprite = new THREE.Sprite(spriteMat);
      textSprite.scale.set(3.6, 1.1, 1);
      textSprite.visible = false;
      this.scene.add(textSprite);

      this.horses.push({ rig, textSprite, spriteCanvas, spriteTex, lastText: null });
    });

    // 绑定第一人称视角转头手势
    this.bindLookControls(canvas);
    this.resize();
  }

  private initConfettiSystem() {
    const confettiColors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#fbbf24"];
    const confettiGeo = this.track(new THREE.PlaneGeometry(0.22, 0.42));

    for (let i = 0; i < 220; i++) {
      const color = confettiColors[i % confettiColors.length];
      const mat = this.track(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(confettiGeo, mat);
      mesh.visible = false;
      this.confettiGroup.add(mesh);

      this.confettiPieces.push({
        mesh,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        life: 0,
      });
    }
  }

  // 触发礼花筒爆发
  private triggerConfetti(gateX: number) {
    if (this.confettiFired) return;
    this.confettiFired = true;

    this.confettiPieces.forEach((p, i) => {
      const side = i % 2 === 0 ? -8.5 : 8.5;
      p.mesh.position.set(gateX + (Math.random() - 0.5) * 3, 1.2, side);
      p.mesh.visible = true;
      // 向斜上方与赛道中央喷射
      p.vx = (Math.random() - 0.5) * 6 - 2;
      p.vy = 12 + Math.random() * 14;
      p.vz = (side < 0 ? 1 : -1) * (4 + Math.random() * 8);
      p.rx = Math.random() * 12;
      p.ry = Math.random() * 12;
      p.rz = Math.random() * 12;
      p.life = 4.0 + Math.random() * 2.0;
    });
  }

  private updateConfetti(dt: number, gateX: number) {
    if (!this.confettiFired) return;

    this.confettiPieces.forEach((p) => {
      if (p.life <= 0) {
        // 持续微喷循环
        p.mesh.position.set(gateX + (Math.random() - 0.5) * 4, 1.2, (Math.random() > 0.5 ? 8.5 : -8.5));
        p.vy = 8 + Math.random() * 12;
        p.vz = (p.mesh.position.z > 0 ? -1 : 1) * (3 + Math.random() * 7);
        p.vx = (Math.random() - 0.5) * 5;
        p.life = 3.0 + Math.random() * 2;
      }
      p.life -= dt;
      p.vy -= 14 * dt; // 重力
      p.vx *= 0.98;
      p.vz *= 0.98;

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;

      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
      p.mesh.rotation.z += p.rz * dt;
    });
  }

  // 绑定第一人称自由转头查看周围对手
  private bindLookControls(canvas: HTMLCanvasElement) {
    const onDown = (e: PointerEvent) => {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      // 允许左右转头 ±75°，上下抬头俯视 ±25°
      this.lookYaw = Math.max(-1.3, Math.min(1.3, this.lookYaw - dx * 0.006));
      this.lookPitch = Math.max(-0.45, Math.min(0.35, this.lookPitch - dy * 0.004));
    };
    const onUp = () => {
      this.isPointerDown = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    this.disposables.push({
      dispose: () => {
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      },
    });
  }

  private updateInteractionSprite(obj: HorseObj, text: string | null, posX: number, posY: number, posZ: number) {
    if (!text) {
      obj.textSprite.visible = false;
      obj.lastText = null;
      return;
    }
    obj.textSprite.position.set(posX, posY + 2.4, posZ);
    obj.textSprite.visible = true;

    if (obj.lastText !== text) {
      obj.lastText = text;
      const ctx = obj.spriteCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 80);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(10, 10, 236, 60, 14);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f59e0b";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 40);
      obj.spriteTex.needsUpdate = true;
    }
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
    const gateX = TRACK_LEN * S;

    // 检查是否有马冲线，触发礼花筒动画
    const winnerFinished = st.runners.some(r => r.finished || r.finishTime != null || r.x >= TRACK_LEN);
    if (winnerFinished) {
      this.triggerConfetti(gateX);
    }
    this.updateConfetti(dt, gateX);

    // 渲染马匹、骑手连击马鞭动作与物理姿态
    st.runners.forEach((r, i) => {
      const obj = this.horses[i];
      if (!obj) return;
      const pose = computePose(r.model, r.phase);
      obj.rig.setPose(
        pose,
        r.whipIntensity,
        dt,
        r.buckedOff,
        r.riderFlyY,
        r.riderFlyRot,
        r.riderFlyX
      );

      const posX = r.x * S;
      const posZ = r.z;
      const posY = (pose.bob * S) + (r.y * S);

      obj.rig.group.position.set(posX, posY, posZ);
      obj.rig.group.rotation.x = r.rotX;
      obj.rig.group.rotation.y = r.rotY;
      obj.rig.group.rotation.z = pose.pitch + r.rotZ;
      obj.rig.group.visible = true;

      this.updateInteractionSprite(obj, r.interactionText, posX, posY, posZ);
    });

    const me = st.runners[this.myIndex] ?? st.runners[0];
    const myObj = this.horses[this.myIndex] ?? this.horses[0];

    if (view === "first") {
      const pose = computePose(me.model, me.phase);
      const head = myObj.rig.headLocal.clone().multiplyScalar(S);
      const z = me.z;
      const bob = (pose.bob + me.y) * S;

      // 如果未按住拖拽，相机视角轻微自然回正
      if (!this.isPointerDown) {
        this.lookYaw *= Math.max(0, 1 - 1.2 * dt);
        this.lookPitch *= Math.max(0, 1 - 1.2 * dt);
      }

      // 结合自由转头 yaw 和 pitch 计算第一人称观察点
      const eyeX = me.x * S - 1.8;
      const eyeY = head.y + 1.1 + bob;
      const forwardDist = 16;
      const forwardX = Math.cos(this.lookYaw) * forwardDist;
      const forwardZ = Math.sin(-this.lookYaw) * forwardDist;
      const forwardY = Math.sin(this.lookPitch) * forwardDist - 0.8;

      this.camera.position.set(eyeX, eyeY, z);
      this.camera.lookAt(eyeX + forwardX, eyeY + forwardY, z + forwardZ);
    } else {
      // 第三人称上帝视角：精确跟随用户自己的马儿
      const myTargetX = Math.min(me.x, TRACK_LEN) * S;
      const myTargetZ = me.z;

      this.cameraX += (myTargetX - this.cameraX) * Math.min(1, dt * 5 + 0.1);
      this.cameraZ += (myTargetZ - this.cameraZ) * Math.min(1, dt * 4 + 0.08);

      this.camera.position.set(this.cameraX - 10, 7.5, this.cameraZ + 14);
      this.camera.lookAt(this.cameraX + 5, 1.2, this.cameraZ * 0.4);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.horses.forEach(h => {
      h.rig.dispose();
      h.spriteTex.dispose();
      h.spriteCanvas.remove?.();
    });
    this.disposables.forEach(d => d.dispose());
    this.renderer.dispose();
  }
}

