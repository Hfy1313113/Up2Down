/* birth.js —— 小马诞生仪式：旋转放大登场、喷射彩带、特殊音效、
   全方向拖拽观察（CSS 3D），观察期结束后进入比赛 */
const Birth = (() => {
  const OBSERVE_SECONDS = 15;

  let raf = null;
  let audioCtx = null;

  // ---------- 音效（WebAudio 合成，无需音频文件） ----------
  function fanfare() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        const t = t0 + i * 0.13;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.9 : 0.22));
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 1);
      });
      // 彩带喷射的“砰砰”声
      for (let i = 0; i < 5; i++) {
        const t = t0 + 0.15 + i * 0.28;
        const noise = audioCtx.createBufferSource();
        const buf = audioCtx.createBuffer(1, 2205, 22050);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
        noise.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        noise.connect(g).connect(audioCtx.destination);
        noise.start(t);
      }
    } catch (e) { /* 音频不可用时静默 */ }
  }

  // ---------- 彩带 ----------
  function startConfetti(canvas) {
    const ctx = canvas.getContext("2d");
    const colors = ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c", "#b06ad4", "#ffe27a"];
    const parts = [];
    for (let i = 0; i < 160; i++) {
      const fromLeft = i % 2 === 0;
      parts.push({
        x: fromLeft ? -10 : canvas.width + 10,
        y: canvas.height * (0.25 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7),
        vy: -(4 + Math.random() * 6),
        g: 0.18,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length],
        life: 999,
      });
    }
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        p.vx *= 0.99;
        if (p.y > canvas.height + 20) continue;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.sin(p.rot * 2)));
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    tick();
  }

  // ---------- 主流程 ----------
  // model: 马模型, color: 颜色, onDone: 观察结束回调
  function show(model, color, onDone) {
    const screen = document.getElementById("screen-birth");
    const flip = document.getElementById("birth-flip");
    const cv = document.getElementById("birth-canvas");
    const confCv = document.getElementById("birth-confetti");
    const btn = document.getElementById("btn-to-race");
    const timerEl = document.getElementById("birth-timer");
    const textEl = document.getElementById("birth-text");

    screen.classList.remove("hidden");
    confCv.width = screen.clientWidth;
    confCv.height = screen.clientHeight;

    // 马画到透明画布上
    cv.width = 560; cv.height = 460;
    const cctx = cv.getContext("2d");
    cctx.clearRect(0, 0, cv.width, cv.height);
    const pose = Horse.computePose(model, 0.18);
    Horse.draw(cctx, model, pose, cv.width / 2, cv.height * 0.82, 1.15, color,
      { phase: 0.18, showJoints: true, jointColor: "#ffe27a" });

    // 旋转放大登场动画
    textEl.classList.remove("hidden");
    textEl.style.animation = "none";
    void textEl.offsetWidth;
    flip.style.animation = "none";
    void flip.offsetWidth;
    flip.style.animation = "";
    flip.style.transform = "";

    fanfare();
    setTimeout(() => startConfetti(confCv), 400);

    // 观察期倒计时 + 手动提前
    let remain = OBSERVE_SECONDS;
    timerEl.textContent = `${remain}s 后进入等待…`;
    const iv = setInterval(() => {
      remain--;
      timerEl.textContent = remain > 0 ? `${remain}s 后可进入比赛` : "可以进入比赛了！";
      if (remain <= 0) { clearInterval(iv); btn.disabled = false; }
    }, 1000);
    btn.disabled = true;
    btn.textContent = "进入比赛 →";

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(iv);
      cancelAnimationFrame(raf);
      screen.classList.add("hidden");
      flip.style.transform = "";
      flip.style.animation = "";
      onDone();
    };
    btn.onclick = finish;
    const guard = setInterval(() => {
      if (finished) { clearInterval(guard); return; }
      if (remain <= 0) { clearInterval(guard); finish(); }   // 观察期结束自动进入
    }, 1000);

    // 拖拽 360° 观察（CSS 3D）
    let dragging = false, lx = 0, ly = 0, ry = 0, rx = 0;
    const stage = document.getElementById("birth-stage");
    stage.onpointerdown = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    window.onpointermove = (e) => {
      if (!dragging) return;
      ry += (e.clientX - lx) * 0.5;
      rx = Math.max(-30, Math.min(30, rx - (e.clientY - ly) * 0.3));
      lx = e.clientX; ly = e.clientY;
      flip.style.animation = "none";
      flip.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    window.onpointerup = () => { dragging = false; };
  }

  return { show, OBSERVE_SECONDS };
})();
