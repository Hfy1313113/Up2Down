// e2e-verify.mjs —— 模拟前端完整流程：join → draw_phase → done×2 → 房主 race → 控制面透传校验
// 注意：画作与开赛载荷不再经过 Worker（走 WebRTC P2P），Worker 只做控制面与兜底转发。
const URL = `ws://localhost:8787/rooms/e2e99-${Date.now() % 100000}`;
const log = [];
const ok = (cond, name) => { log.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, msgs: [], id: null };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    c.msgs.push(m);
    if (m.t === "joined") c.id = m.id;
    if (m.t === "relay_all" && m.data?.t) { c.msgs.push(m.data); } // 前端解包逻辑
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
  return c;
}

const strokesA = { legs: [{ points: [[1, 2], [3, 4], [5, 6]] }], head: [], butt: [] };
const strokesB = { legs: [], head: [{ points: [[9, 9], [8, 8], [7, 7]] }], butt: [] };

const a = client("房主甲"), b = client("乙");
await sleep(500);

// 房主开始 → 两端 draw_phase
a.ws.send(JSON.stringify({ t: "relay_all", data: { t: "draw_phase" } }));
await sleep(200);
ok(!last(a, "draw_phase") && last(b, "draw_phase"), "draw_phase 到达乙（发送者不回发，房主本地进入）");

// 双方 done
a.ws.send(JSON.stringify({ t: "done", strokes: strokesA }));
await sleep(200);
b.ws.send(JSON.stringify({ t: "done", strokes: strokesB }));
await sleep(200);
ok(last(a, "player_done")?.name === "乙", "player_done 到达房主");

// 房主 race：画作由房主端本地汇总，Worker 不持有 strokes，只原样转发
a.ws.send(JSON.stringify({ t: "race", horses: [
  { id: a.id, name: "房主甲", strokes: strokesA },
  { id: b.id, name: "乙", strokes: strokesB },
] }));
await sleep(300);
const raceB = last(b, "race");
ok(raceB, "race 到达乙");
ok(raceB?.horses?.find(h => h.id === a.id)?.strokes?.legs?.length === 1, "画作由房主端携带（甲）");
ok(raceB?.horses?.find(h => h.id === b.id)?.strokes?.head?.length === 1, "画作由房主端携带（乙）");
ok(!("strokes" in (last(b, "player_done") ?? {})), "player_done 不含画作载荷（控制面保持轻量）");

// 再来一局
a.ws.send(JSON.stringify({ t: "relay_all", data: { t: "again" } }));
await sleep(200);
ok(last(b, "again"), "again 到达乙");

console.log(log.join("\n"));
process.exit();
