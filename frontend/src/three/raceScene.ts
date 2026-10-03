// raceScene.ts —— three.js 真实 3D 赛跑场景：环境由风格包声明经 environment.ts 构建，
// 大象由 elephantMesh 生成、按 raceSim 状态驱动（raceSim 仍是唯一确定性来源，本层只消费）。
// 支持第三人称追踪自身、第一人称自由转头环视、物理碰撞渲染与头名冲线礼花筒动画。
import * as THREE from "three";
import { computePose } from "../game/gait";
import { TRACK_LEN } from "../game/raceSim";
import type { RaceState } from "../game/raceSim";
import { MaterialResolver } from "../style/materials";
import type { StylePack } from "../style/types";
import { buildElephant, RIDER_FLY_HEIGHT, WORLD_SCALE, type ElephantRig } from "./elephantMesh";
import { buildEnvironment } from "./environment";

export type ViewMode = "third" | "first";

interface ElephantObj {
  rig: ElephantRig;
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
  private elephants: ElephantObj[] = [];
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

  private pack: StylePack;
  private materials: MaterialResolver;

  constructor(canvas: HTMLCanvasElement, entries: { name: string; model: import("../game/types").ElephantModel }[], myIndex: number, pack: StylePack) {
    this.myIndex = myIndex;
    this.pack = pack;
    this.materials = new MaterialResolver(pack.playerColors);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
    this.track(this.camera);

    const S = WORLD_SCALE;
    // 天空/雾/灯光/地面/跑道/栅栏/终点门/礼花筒/云朵/装饰物：全部来自风格包声明
    buildEnvironment(this.scene, pack, this.materials, TRACK_LEN * S, x => this.track(x));

    // 礼花粒子容器
    this.confettiGroup = new THREE.Group();
    this.scene.add(this.confettiGroup);
    this.initConfettiSystem();

    // 大象与碰撞浮动文案 Sprite
    entries.forEach((e, i) => {
      const rig = buildElephant(e.model, { materials: this.materials, pack, playerIndex: i });
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

      this.elephants.push({ rig, textSprite, spriteCanvas, spriteTex, lastText: null });
    });

    // 绑定第一人称视角转头手势
    this.bindLookControls(canvas);
    this.resize();
  }

  private initConfettiSystem() {
    const confettiColors = this.pack.environment.confettiColors;
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

  private updateInteractionSprite(obj: ElephantObj, text: string | null, posX: number, posY: number, posZ: number) {
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
      ctx.strokeStyle = this.pack.ui.accent;
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

  /** 当前领跑者：未出局且未冲线者中 x 最大；都冲线/出局则取 x 最大者 */
  private leaderOf(st: RaceState) {
    const running = st.runners.filter(r => !r.failed && !r.finished);
    const pool = running.length ? running : st.runners;
    return pool.reduce((a, b) => (b.x > a.x ? b : a), pool[0]);
  }

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

    // 检查是否有大象冲线，触发礼花筒动画
    const winnerFinished = st.runners.some(r => r.finished || r.finishTime != null || r.x >= TRACK_LEN);
    if (winnerFinished) {
      this.triggerConfetti(gateX);
    }
    this.updateConfetti(dt, gateX);

    // 渲染大象、驭象师连击挥鞭动作与物理姿态
    st.runners.forEach((r, i) => {
      const obj = this.elephants[i];
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
    const myObj = this.elephants[this.myIndex] ?? this.elephants[0];
    const pose = computePose(me.model, me.phase);

    // 出局且抛飞动画已播完 → 观战：第三人称跟随当前领跑者，直到全场完赛
    const spectating = me.buckedOff && me.interactionTimer <= 0;
    const leader = spectating ? this.leaderOf(st) : me;

    if (me.buckedOff && !spectating) {
      // 第二人称特写：相机架在象前侧方，同时框住回眸的大象与螺旋升天的驭象师
      const elephantHead = myObj.rig.headLocal.clone().multiplyScalar(S);
      const hx = me.x * S + elephantHead.x;
      const hy = (pose.bob + me.y) * S + elephantHead.y;
      const hz = me.z;

      const riderH = me.riderFlyY * RIDER_FLY_HEIGHT * S;        // 0 ~ 约 6.3
      const riderX = me.x * S - me.riderFlyX * S;
      const riderY = hy + riderH;
      const riderZ = hz + Math.sin(me.riderFlyRot * 4) * 6 * S;

      // 驭象师越高相机越退，保证象身（约 0~2 高）与驭象师同时在 60° 视锥内
      const dist = 5.5 + riderH * 0.55;
      const camX = hx + dist * 0.55 + Math.sin(me.riderFlyRot * 3) * 0.15;
      const camY = hy + 1.0 + riderH * 0.45;
      const camZ = hz + dist * 0.8;

      // 注视点：象身中心与驭象师之间、略偏向驭象师（飞得越高，保持其在画面中上部）
      const bodyX = me.x * S, bodyY = (pose.bob + me.y) * S + 1.0;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(
        bodyX * 0.4 + riderX * 0.6,
        bodyY * 0.4 + riderY * 0.6,
        hz * 0.4 + riderZ * 0.6,
      );
      // 镜头微倾斜带出滑稽特写戏剧感
      this.camera.up.set(Math.sin(me.riderFlyRot * 2) * 0.12, 1, 0);
    } else if (view === "first" && !spectating) {
      this.camera.up.set(0, 1, 0);
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
      this.camera.up.set(0, 1, 0);
      // 第三人称上帝视角：跟随自己的大象；观战时跟随领跑者
      const myTargetX = Math.min(leader.x, TRACK_LEN) * S;
      const myTargetZ = leader.z;

      this.cameraX += (myTargetX - this.cameraX) * Math.min(1, dt * 5 + 0.1);
      this.cameraZ += (myTargetZ - this.cameraZ) * Math.min(1, dt * 4 + 0.08);

      if (this.camera.aspect < 1) {
        // 竖屏（手机）：横向视野窄、底部有 HUD，相机抬高并退到斜后方，
        // 让自己的大象落在画面中部偏上而不是被底部面板遮住
        this.camera.position.set(this.cameraX - 11, 11, this.cameraZ + 9);
        this.camera.lookAt(this.cameraX + 4, 0.6, this.cameraZ);
      } else {
        this.camera.position.set(this.cameraX - 10, 7.5, this.cameraZ + 14);
        this.camera.lookAt(this.cameraX + 5, 1.2, this.cameraZ * 0.4);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.elephants.forEach(h => {
      h.rig.dispose();
      h.spriteTex.dispose();
      h.spriteCanvas.remove?.();
    });
    this.disposables.forEach(d => d.dispose());
    this.materials.dispose();
    this.renderer.dispose();
  }
}

