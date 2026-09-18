// birthScene.ts —— three.js 诞生仪式舞台：旋转放大登场、慢速自转、Pointer 拖拽 360° 观察。
import * as THREE from "three";
import { computePose } from "../game/gait";
import type { HorseModel } from "../game/types";
import { buildHorse, WORLD_SCALE, type HorseRig } from "./horseMesh";

const INTRO_MS = 4000;
const STAGE_HORSE_HEIGHT = 3.0;
const CAM_TARGET_Y = 1.5;
const CAM_RADIUS = 6.2;

export class BirthScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rig: HorseRig;
  private disposables: { dispose(): void }[] = [];
  private startTime = performance.now();
  private dragging = false;
  private lx = 0; private ly = 0;
  private rotY = 0; private rotX = 0.15;
  private scale = WORLD_SCALE * 2.2;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, model: HorseModel, color: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.track(this.camera);

    const hemi = new THREE.HemisphereLight("#eaf6ff", "#8a6f55", 1.1);
    const key = new THREE.DirectionalLight("#fff4d6", 1.8);
    key.position.set(4, 6, 5);
    this.scene.add(hemi, key);

    // 圆形展台
    const discGeo = this.track(new THREE.CylinderGeometry(2.6, 2.9, 0.4, 40));
    const discMat = this.track(new THREE.MeshStandardMaterial({ color: "#e8d9b0", roughness: 0.9 }));
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.2;
    this.scene.add(disc);

    // 展台虚线环（提示可旋转）
    const ringGeo = this.track(new THREE.TorusGeometry(2.72, 0.045, 8, 60));
    const ringMat = this.track(new THREE.MeshBasicMaterial({ color: "#e2703a" }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    this.rig = buildHorse(model, color);
    const baseScale = WORLD_SCALE * 2.2;
    this.rig.group.scale.setScalar(baseScale);
    this.rig.setPose(computePose(model, 0.18));   // 定格奔跑姿态登场
    this.scene.add(this.rig.group);

    // 按实际包围盒把马缩放到展台合适高度，并据其高度定相机
    const box = new THREE.Box3().setFromObject(this.rig.group);
    const size = box.getSize(new THREE.Vector3());
    const fit = STAGE_HORSE_HEIGHT / Math.max(size.y, 1e-3);
    this.scale = baseScale * fit;
    this.rig.group.scale.setScalar(this.scale);

    this.resize();
    this.loop();
  }

  private track<T extends { dispose(): void }>(x: T): T { this.disposables.push(x); return x; }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 560;
    const h = canvas.clientHeight || 460;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Pointer 拖拽 360°（自实现轨道：水平转 Y，垂直 ±30°）
  attachDrag(el: HTMLElement): void {
    const down = (e: PointerEvent) => { this.dragging = true; this.lx = e.clientX; this.ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.rotY += (e.clientX - this.lx) * 0.01;
      this.rotX = Math.max(-0.5, Math.min(0.5, this.rotX + (e.clientY - this.ly) * 0.006));
      this.lx = e.clientX; this.ly = e.clientY;
    };
    const up = () => { this.dragging = false; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.disposables.push({ dispose: () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    } });
  }

  private loop = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const t = performance.now() - this.startTime;
    // 登场：4s 内 360°→0 旋转 + 0.2→1 缩放（easeOutCubic）
    const k = Math.min(1, t / INTRO_MS);
    const ease = 1 - Math.pow(1 - k, 3);
    const spin = (1 - ease) * Math.PI * 2;
    if (!this.dragging && k >= 1) this.rotY += 0.003;   // 登场后慢速自转
    this.rig.group.rotation.y = this.rotY + spin;
    this.rig.group.scale.setScalar(this.scale * (0.2 + 0.8 * ease));
    // 相机轨道
    this.camera.position.set(
      Math.sin(this.rotY + spin) * CAM_RADIUS,
      CAM_TARGET_Y + 1.2 + this.rotX * 6,
      Math.cos(this.rotY + spin) * CAM_RADIUS,
    );
    this.camera.lookAt(0, CAM_TARGET_Y, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    this.rig.dispose();
    this.disposables.forEach(d => d.dispose());
    this.renderer.dispose();
  }
}
