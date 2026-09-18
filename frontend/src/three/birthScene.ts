// birthScene.ts —— three.js 诞生仪式舞台：旋转放大登场、慢速自转、全自由 360° 球面轨道拖拽观察与滚轮缩放。
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
  private lastInteraction = performance.now();
  private dragging = false;
  private lx = 0; private ly = 0;
  // 球面坐标系：theta 为水平方位角（全周 360°），phi 为垂直极角（顶部到俯视再到仰视），radius 为距离
  private theta = 0;
  private phi = Math.PI / 2 - 0.22;
  private radius = CAM_RADIUS;
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

  // Pointer 拖拽与滚轮全自由 360° 球面观察（支持触控双指缩放）
  attachDrag(el: HTMLElement): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let initialPinchDist = 0;
    let initialRadius = this.radius;

    const down = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragging = true;
      this.lastInteraction = performance.now();
      this.lx = e.clientX;
      this.ly = e.clientY;
      if (pointers.size === 2) {
        const [p1, p2] = Array.from(pointers.values());
        initialPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        initialRadius = this.radius;
      }
    };

    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastInteraction = performance.now();

      if (pointers.size >= 2) {
        const [p1, p2] = Array.from(pointers.values());
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (initialPinchDist > 0) {
          const factor = initialPinchDist / Math.max(dist, 1);
          this.radius = Math.max(3.2, Math.min(10.0, initialRadius * factor));
        }
      } else if (pointers.size === 1) {
        const dx = e.clientX - this.lx;
        const dy = e.clientY - this.ly;
        // 水平方向（方位角）：自由 360° 连续无界旋转
        this.theta -= dx * 0.008;
        // 垂直方向（极角）：允许从俯视鸟瞰（近天顶 0.05 弧度）到仰视（130° 仰角），全方位多轴自由观察
        this.phi = Math.max(0.05, Math.min(Math.PI * 0.72, this.phi - dy * 0.008));
        this.lx = e.clientX;
        this.ly = e.clientY;
      }
    };

    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        this.dragging = false;
      } else if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        this.lx = p.x;
        this.ly = p.y;
      }
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.lastInteraction = performance.now();
      this.radius = Math.max(3.2, Math.min(10.0, this.radius + e.deltaY * 0.006));
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    this.disposables.push({
      dispose: () => {
        el.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        el.removeEventListener("wheel", wheel);
      },
    });
  }

  private loop = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const t = performance.now() - this.startTime;

    // 登场动画：4s 内 360° 旋转放大登场
    const k = Math.min(1, t / INTRO_MS);
    const ease = 1 - Math.pow(1 - k, 3);
    const introSpin = (1 - ease) * Math.PI * 2;

    this.rig.group.scale.setScalar(this.scale * (0.2 + 0.8 * ease));

    if (k < 1) {
      this.rig.group.rotation.y = introSpin;
    } else {
      this.rig.group.rotation.y = 0;
      // 登场完毕且用户静置超过 2.5 秒时，缓慢水平自动环视展台
      if (!this.dragging && performance.now() - this.lastInteraction > 2500) {
        this.theta += 0.004;
      }
    }

    // 球面全自由坐标转换 (目标中心为 CAM_TARGET_Y)
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    this.camera.position.set(
      sinPhi * sinTheta * this.radius,
      CAM_TARGET_Y + cosPhi * this.radius,
      sinPhi * cosTheta * this.radius,
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
