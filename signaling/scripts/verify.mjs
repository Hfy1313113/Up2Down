// 手动验证脚本：模拟 2 个客户端走完 join → room_state → relay_all → done → race → 房主断线移交
const URL = "ws://localhost:8787/rooms/test42";
const log = [];
const ok = (cond, name) => { log.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, msgs: [], id: null };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    c.msgs.push(m);
    if (m.t === "joined") c.id = m.id;
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
  return c;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

const a = client("甲"), b = client("乙");
await sleep(500);

ok(a.id === "p1" && b.id === "p2", `joined 分配 pid (${a.id},${b.id})`);
ok(last(a, "room_state")?.host === "p1" && last(a, "room_state")?.players.length === 2, "room_state: 2 玩家, host=p1");
ok(last(a, "room_state")?.players[0].name === "甲", "players 按加入顺序");

// 房主广播 start → 乙收到（relay_all 兜底通道）
a.ws.send(JSON.stringify({ t: "start" }));
await sleep(200);
ok(last(b, "start")?.from === "p1" && !last(a, "start")?.from, "start 经 relay 到达乙、不回发房主");

// done 收集
b.ws.send(JSON.stringify({ t: "done", strokes: { legs: [], head: [], butt: [] } }));
await sleep(200);
ok(last(a, "player_done")?.name === "乙", "player_done 广播");
ok(last(a, "room_state")?.players.find(p => p.id === "p2")?.done === true, "done 状态进入 room_state");

// 定向 relay
a.ws.send(JSON.stringify({ t: "relay", to: "p2", data: { x: 1 } }));
await sleep(200);
ok(last(b, "relay")?.data?.x === 1 && last(b, "relay")?.from === "p1", "relay 定向转发");

// 房主断线 → 移交 p2
a.ws.close();
await sleep(400);
ok(last(b, "room_state")?.host === "p2" && last(b, "room_state")?.players.length === 1, "房主断线移交 p2");

b.ws.close();
await sleep(200);
console.log(log.join("\n"));
process.exit();
