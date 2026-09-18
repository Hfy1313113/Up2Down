/* main.js —— 状态机：大厅 → 分部位绘制(每部位50s) → 诞生仪式 → 等待 → 赛跑(可切视角) → 结算 */
(() => {
  const $ = (id) => document.getElementById(id);
  const screens = {
    lobby: $("screen-lobby"), draw: $("screen-draw"),
    birth: $("screen-birth"), race: $("screen-race"),
  };
  function show(name) {
    for (const k in screens) screens[k].classList.toggle("hidden", k !== name);
  }

  const PART_SECONDS = 50;
  const PART_HINTS = {
    legs: "腿部：画出<b>四条向下伸出的长线</b>，中间带明显弯折（弯折处就是膝关节）。大腿:小腿≈1:1 跑得最快！",
    head: "头部：画出<b>马的头部和脖子</b>（朝上前方）。大小和位置会成为小马的脑袋！",
    butt: "屁股：画出<b>屁股和后腿上方/尾巴</b>。尾巴会挂在躯干后端～",
  };

  let isHost = false;
  let partTimer = null;
  let race = null;
  let raceAnim = null;
  let doneNames = [];
  let myIndex = 0;             // 我在房间玩家列表中的序号（决定颜色）
  let myColor = Race.COLORS[0];
  let lastParts = null;        // 自己绘制的部位数据（诞生仪式用）

  // ---------- 大厅 ----------
  $("btn-join").onclick = () => {
    const name = $("inp-name").value.trim() || "玩家" + Math.floor(Math.random() * 99);
    const room = $("inp-room").value.trim() || "default";
    $("btn-join").disabled = true;
    Net.connect(name, room, () => {
      $("join-form").classList.add("hidden");
      $("lobby-wait").classList.remove("hidden");
    }, (err) => {
      $("lobby-error").textContent = err;
      $("lobby-error").classList.remove("hidden");
      $("btn-join").disabled = false;
    });
  };
  $("btn-start").onclick = () => Net.send({ t: "start" });

  function renderRoom(msg) {
    $("lobby-room").textContent = msg.room;
    $("lobby-count").textContent = msg.players.length;
    const ul = $("lobby-players");
    ul.innerHTML = "";
    msg.players.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = p.name + (p.id === Net.id ? "（你）" : "");
      if (p.id === msg.host) li.classList.add("host");
      ul.appendChild(li);
      if (p.id === Net.id) { myIndex = i; myColor = Race.COLORS[i % 4]; }
    });
    isHost = msg.host === Net.id;
    $("lobby-hint").textContent = isHost ? "你是房主，人满或就绪后即可开始" : "等待房主开始比赛…";
    $("btn-start").classList.toggle("hidden", !isHost);
  }

  Net.on("room_state", (msg) => {
    if (msg.phase === "lobby") {
      show("lobby");
      renderRoom(msg);
      stopRace();
    }
  });

  // ---------- 分部位绘制 ----------
  Net.on("draw_phase", () => {
    show("draw");
    doneNames = [];
    Draw.reset();
    document.querySelectorAll(".part-tab").forEach(t => t.classList.remove("finished", "active"));
    document.querySelector('.part-tab[data-part="legs"]').classList.add("active");
    $("draw-hint").innerHTML = PART_HINTS.legs;
    $("draw-status").textContent = "先画腿部！完成后点「完成本部位」";
    startPartTimer("legs");
  });

  Net.on("player_done", (msg) => {
    doneNames.push(msg.name);
    $("draw-status").textContent = `已提交：${doneNames.join("、")}（等待 ${doneNames.length} 人…）`;
  });

  function setActiveTab(part) {
    document.querySelectorAll(".part-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.part === part);
    });
  }
  function markFinished(part) {
    const tab = document.querySelector(`.part-tab[data-part="${part}"]`);
    if (tab) tab.classList.add("finished");
  }

  function startPartTimer(part) {
    clearInterval(partTimer);
    const end = Date.now() + PART_SECONDS * 1000;
    const el = $("draw-countdown");
    el.textContent = PART_SECONDS;
    el.classList.remove("urgent");
    partTimer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      el.textContent = left;
      el.classList.toggle("urgent", left <= 10);
      if (left <= 0) {
        clearInterval(partTimer);
        finishCurrentPart();      // 超时自动进入下一部位
      }
    }, 200);
  }

  function finishCurrentPart() {
    const part = Draw.currentPart;
    markFinished(part);
    const next = Draw.finishPart();   // 归档并切换
    if (next) {
      setActiveTab(next);
      $("draw-hint").innerHTML = PART_HINTS[next];
      $("draw-status").textContent = `接下来画「${Draw.PART_LABEL[next]}」！`;
      startPartTimer(next);
    } else {
      // 三个部位都画完 → 诞生仪式
      clearInterval(partTimer);
      lastParts = Draw.collectAll();
      const model = Recognize.analyzeParts(lastParts);
      show("birth");
      Birth.show(model, myColor, () => {
        // 诞生结束 → 提交画作，等待其他玩家
        show("draw");
        $("draw-status").textContent = "已提交！等待其他玩家的小马诞生…";
        document.querySelector(".draw-tools").style.opacity = "0.4";
        Net.send({ t: "done", strokes: lastParts });
      });
      document.querySelector(".draw-tools").style.opacity = "1";
    }
  }

  Draw.init($("draw-canvas"), () => {});
  $("btn-undo").onclick = () => Draw.undo();
  $("btn-clear").onclick = () => Draw.clear();
  $("chk-preview").onchange = (e) => Draw.setPreview(e.target.checked);
  $("btn-part-done").onclick = () => finishCurrentPart();

  // ---------- 赛跑 ----------
  Net.on("race", (msg) => {
    clearInterval(partTimer);
    document.querySelector(".draw-tools").style.opacity = "1";
    show("race");
    const canvas = $("race-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const withStrokes = msg.horses.filter(h => h.strokes && (h.strokes.length !== 0 || h.strokes.legs));
    const entries = withStrokes.map(h => ({
      id: h.id, name: h.name,
      model: Array.isArray(h.strokes) ? Recognize.analyze(h.strokes) : Recognize.analyzeParts(h.strokes),
    }));
    if (entries.length === 0) {
      msg.horses.forEach(h => entries.push({ id: h.id, name: h.name, model: Recognize.analyze([]) }));
    }
    const myPos = entries.findIndex(e => e.id === Net.id);
    race = Race.create(canvas, entries, { playerIndex: myPos >= 0 ? myPos : 0 });
    setView("third");
    startCountdown(() => {
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        race.update(dt);
        race.render();
        if (race.over) { showResults(); return; }
        raceAnim = requestAnimationFrame(loop);
      };
      raceAnim = requestAnimationFrame(loop);
    });
  });

  // ---------- 视角切换 ----------
  function setView(v) {
    if (race) race.setView(v);
    $("btn-view-third").classList.toggle("active", v === "third");
    $("btn-view-first").classList.toggle("active", v === "first");
  }
  $("btn-view-third").onclick = () => setView("third");
  $("btn-view-first").onclick = () => setView("first");
  window.addEventListener("keydown", (e) => {
    if (e.key === "v" || e.key === "V") {
      if (screens.race.classList.contains("hidden")) return;
      setView(race && race.view === "first" ? "third" : "first");
    }
  });

  function startCountdown(go) {
    const el = $("race-countdown");
    el.classList.remove("hidden");
    const seq = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      if (i < seq.length) {
        el.textContent = seq[i];
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
        i++;
        setTimeout(tick, i === seq.length ? 500 : 800);
      } else {
        el.classList.add("hidden");
        go();
      }
    };
    tick();
  }

  function showResults() {
    const rank = race.ranking();
    $("race-result-title").textContent = `🏆 ${rank[0].name} 获胜！`;
    const ol = $("race-podium");
    ol.innerHTML = "";
    rank.forEach((r, i) => {
      const li = document.createElement("li");
      const t = r.finishTime != null ? `（${r.finishTime.toFixed(1)} 秒）` : "（未完赛）";
      li.textContent = `${["🥇", "🥈", "🥉", "4️⃣"][i]} ${r.name} ${t}`;
      ol.appendChild(li);
    });
    $("race-banner").classList.remove("hidden");
  }

  function stopRace() {
    if (raceAnim) cancelAnimationFrame(raceAnim);
    raceAnim = null;
    race = null;
    $("race-banner").classList.add("hidden");
  }

  $("btn-again").onclick = () => {
    Net.send({ t: "again" });
    $("race-banner").classList.add("hidden");
  };

  Net.on("_close", () => {
    stopRace();
    show("lobby");
    $("join-form").classList.remove("hidden");
    $("lobby-wait").classList.add("hidden");
    $("btn-join").disabled = false;
    $("lobby-error").textContent = "连接已断开，请重新加入";
    $("lobby-error").classList.remove("hidden");
  });
})();
