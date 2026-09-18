/* index.ts —— up2down 信令 Worker：控制面服务端（房间成员/信令/计时）。
   每个房间一个 Durable Object（Room），玩家各挂一条 WebSocket，消息为 JSON、字段 t。
   画作等游戏数据走 WebRTC P2P 直连，Worker 只在无法直连时做 relay 兜底；
   Worker 自身不保存 strokes，出口流量保持 KB 级。 */

interface Player {
  pid: string;
  name: string;
  ws: WebSocket;
  done: boolean;
}

interface RoomState {
  players: Map<string, Player>;   // 插入顺序 = 加入顺序
  hostId: string | null;
  seq: number;
}

const encoder = new TextEncoder();

const DRAW_TIMEOUT_MS = 200_000;   // 绘制阶段总时限，到点服务端自动开赛

function send(ws: WebSocket, obj: unknown) {
  try { ws.send(JSON.stringify(obj)); } catch { /* closed */ }
}

function broadcast(state: RoomState, obj: unknown, except?: WebSocket) {
  const data = JSON.stringify(obj);
  for (const p of state.players.values()) {
    if (p.ws === except) continue;
    try { p.ws.send(data); } catch { /* closed */ }
  }
}

function roomStateMsg(state: RoomState, code: string) {
  return {
    t: "room_state",
    room: code,
    host: state.hostId,
    players: [...state.players.values()].map(p => ({ id: p.pid, name: p.name, done: p.done })),
  };
}

export class Room {
  state: DurableObjectState;
  code = "";
  roomState: RoomState;
  raceDeadline: number | null = null;   // 绘制阶段截止（epoch ms）
  raceStarted = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.roomState = { players: new Map(), hostId: null, seq: 0 };
  }

  // 进入绘制阶段：服务端计时，到点未开赛则由 alarm 自动开赛（房主断线也安全）
  private beginDrawPhase(timeoutMs: number) {
    this.raceDeadline = Date.now() + timeoutMs;
    this.raceStarted = false;
    this.state.storage.setAlarm(this.raceDeadline);
  }

  private cancelRaceTimer() {
    this.raceDeadline = null;
    this.state.storage.deleteAlarm();
  }

  // 超时兜底事件不需要马匹载荷，由房主端本地组装

  // 超时兜底：服务端不持有画作，只广播超时事件，由房主端据此用本地收集到的画作开赛
  async alarm(): Promise<void> {
    if (this.raceDeadline == null || this.raceStarted) return;
    if (Date.now() < this.raceDeadline) {   // 防御：提前唤醒则重新定
      this.state.storage.setAlarm(this.raceDeadline);
      return;
    }
    this.raceStarted = true;
    this.cancelRaceTimer();
    broadcast(this.roomState, { t: "race_timeout" });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    if (request.method === "GET" && /^\/rooms\/[A-Za-z0-9_-]{1,32}$/.test(url.pathname)) {
      this.code = url.pathname.split("/")[2];
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket upgrade", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleSocket(server as WebSocket);
      return new Response(null, { status: 101, webSocket: client as WebSocket });
    }
    return new Response("not found", { status: 404 });
  }

  handleSocket(ws: WebSocket) {
    ws.accept();
    let pid: string | null = null;

    ws.addEventListener("message", (ev) => {
      let msg: any;
      try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      const rs = this.roomState;

      switch (msg.t) {
        case "join": {
          if (rs.players.size >= 4) { send(ws, { t: "error", msg: "房间已满" }); return; }
          pid = "p" + (++rs.seq);
          const player: Player = {
            pid, name: String(msg.name || "玩家").slice(0, 24),
            ws, done: false, strokes: null,
          };
          rs.players.set(pid, player);
          if (!rs.hostId) rs.hostId = pid;
          send(ws, { t: "joined", id: pid, room: this.code });
          broadcast(rs, roomStateMsg(rs, this.code));
          break;
        }
        case "done": {
          const p = pid && rs.players.get(pid);
          if (!p) return;
          p.done = true;
          broadcast(rs, { t: "player_done", id: pid, name: p.name });
          broadcast(rs, roomStateMsg(rs, this.code));
          break;
        }
        case "ping": {
          send(ws, { t: "pong" });
          break;
        }
        // 房主通知服务端绘制阶段开始（只计时，不广播）
        case "phase_start": {
          this.beginDrawPhase(Number(msg.timeoutMs) || DRAW_TIMEOUT_MS);
          break;
        }
        // 房主通知服务端本轮已开赛（取消超时兜底，不广播）
        case "round_over": {
          this.raceStarted = true;
          this.cancelRaceTimer();
          break;
        }
        // 纯转发：signal / relay → 目标玩家（不存在则回 error）；relay_all → 广播
        case "signal":
        case "relay": {
          const to = rs.players.get(String(msg.to));
          if (to) send(to.ws, { ...msg, from: pid });
          else send(ws, { t: "error", msg: `目标玩家 ${msg.to} 不存在`, for: msg.t, to: msg.to });
          break;
        }
        case "relay_all": {
          broadcast(rs, { ...msg, from: pid }, ws);
          // 房主经兜底通道广播 draw_phase = 绘制阶段开始 → 服务端计时
          if (msg.data?.t === "draw_phase") this.beginDrawPhase(msg.data.timeoutMs ?? DRAW_TIMEOUT_MS);
          break;
        }
        default: {
          if (msg.t === "start") this.beginDrawPhase(DRAW_TIMEOUT_MS);
          if (msg.t === "again") { this.raceStarted = false; this.cancelRaceTimer(); }
          if (msg.t === "race") { this.raceStarted = true; this.cancelRaceTimer(); }
          broadcast(rs, { ...msg, from: pid }, ws);
        }
      }
    });

    ws.addEventListener("close", () => this.leave(pid));
    ws.addEventListener("error", () => this.leave(pid));
  }

  private leave(pid: string | null) {
    if (!pid) return;
    const rs = this.roomState;
    const p = rs.players.get(pid);
    if (!p) return;
    rs.players.delete(pid);
    if (rs.hostId === pid) {
      // 房主移交最早加入者
      rs.hostId = rs.players.size ? [...rs.players.keys()][0] : null;
    }
    if (rs.players.size === 0) {
      // 房间空 → 状态自然随 DO 空闲销毁
      return;
    }
    broadcast(rs, roomStateMsg(rs, this.code));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9_-]{1,32})$/);
    if (m) {
      const id = env.ROOM.idFromName(m[1]);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }
    // 其余路径交给静态产物（frontend/dist），未命中的前端路由由 SPA 回落返回 index.html
    return env.ASSETS.fetch(request);
  },
};

interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}
