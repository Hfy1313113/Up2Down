// timeout-verify.mjs —— 服务端计时兜底：phase_start/draw_phase(带 timeoutMs) → 超时后服务端广播
// race_timeout（不含画作，画作由房主端本地汇总后广播），房主中途断线也能触发。
const BASE = `ws://localhost:8787/rooms/`;
const RUN = Date.now() % 100000;
const log = [];
const ok = (cond, name) => { log.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

function client(room, name) {
  const ws = new WebSocket(BASE + room);
  const c = { ws, name, msgs: [], id: null };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    c.msgs.push(m);
    if (m.t === "joined") c.id = m.id;
    if (m.t === "relay_all" && m.data?.t) c.msgs.push(m.data);
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
  return c;
}

// --- 场景1：超时兜底事件广播（画作不经服务端） ---
const a = client(`tout1-${RUN}`, "甲"), b = client(`tout1-${RUN}`, "乙");
await sleep(500);
a.ws.send(JSON.stringify({ t: "relay_all", data: { t: "draw_phase", timeoutMs: 900 } }));
await sleep(200);
a.ws.send(JSON.stringify({ t: "done", strokes: { legs: [{ points: [[1,1],[2,2],[3,3]] }], head: [], butt: [] } }));
await sleep(1600);   // 超过 900ms 超时
const tout = last(b, "race_timeout");
ok(tout, "超时后服务端广播 race_timeout（乙收到）");
ok(tout && !("horses" in tout), "race_timeout 不含画作载荷（由房主端本地组赛）");

// --- 场景2：房主断线后超时仍触发（新房主据此开赛） ---
const a2 = client(`tout2-${RUN}`, "丙"), b2 = client(`tout2-${RUN}`, "丁");
await sleep(500);
a2.ws.send(JSON.stringify({ t: "relay_all", data: { t: "draw_phase", timeoutMs: 900 } }));
await sleep(200);
a2.ws.close();       // 房主立即断线
await sleep(1600);
ok(last(b2, "race_timeout"), "房主断线后幸存玩家仍收到 race_timeout");

// --- 场景3：round_over 取消兜底计时（房主已开赛则不再广播 race_timeout） ---
const a3 = client(`tout3-${RUN}`, "戊"), b3 = client(`tout3-${RUN}`, "己");
await sleep(500);
a3.ws.send(JSON.stringify({ t: "phase_start", timeoutMs: 900 }));
await sleep(150);
a3.ws.send(JSON.stringify({ t: "round_over" }));
await sleep(1600);
ok(!last(b3, "race_timeout"), "开赛后不再收到 race_timeout");

b.ws.close(); b2.ws.close(); b3.ws.close();
console.log(log.join("\n"));
process.exit();
