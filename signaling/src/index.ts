/* index.ts —— up2down 信令 Worker：唯一的房间/中继服务端。
   每个房间一个 Durable Object（Room），玩家各挂一条 WebSocket，
   消息为 JSON、字段 t。Worker 只校验/转发，不解释 strokes 内容。 */

interface Player {
  pid: string;
  name: string;
  ws: WebSocket;
  done: boolean;
  strokes: unknown;
}

interface RoomState {
  players: Map<string, Player>;   // 插入顺序 = 加入顺序
  hostId: string | null;
  seq: number;
}

const encoder = new TextEncoder();

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

  constructor(state: DurableObjectState) {
    this.state = state;
    this.roomState = { players: new Map(), hostId: null, seq: 0 };
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
          p.strokes = msg.strokes ?? null;
          broadcast(rs, { t: "player_done", id: pid, name: p.name });
          broadcast(rs, roomStateMsg(rs, this.code));
          break;
        }
        // 纯转发：signal / relay → 目标玩家；relay_all → 广播
        case "signal":
        case "relay": {
          const to = rs.players.get(String(msg.to));
          if (to) send(to.ws, { ...msg, from: pid });
          break;
        }
        case "relay_all": {
          broadcast(rs, { ...msg, from: pid }, ws);
          break;
        }
        // 房主协调消息原样广播；race 由服务端补全各玩家已存的 strokes（房主只知自己的）
        default: {
          if (msg.t === "race" && Array.isArray(msg.horses)) {
            msg.horses = msg.horses.map((h: any) => {
              const p = rs.players.get(String(h.id));
              return { ...h, strokes: p?.done ? p.strokes : (h.strokes ?? null) };
            });
          }
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
    return new Response("not found", { status: 404 });
  },
};

interface Env {
  ROOM: DurableObjectNamespace;
}
