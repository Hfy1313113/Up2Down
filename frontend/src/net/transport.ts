// transport.ts —— 网络传输抽象：本步实现 WsMode（连接 Cloudflare Worker 信令服务）。
// 协议消息沿用 legacy 的 t 字段：join/room_state/draw_phase/start/done/player_done/race/again，
// 游戏内消息先全走 relay_all 兜底通道（服务端原样广播并附 from 字段）。
export interface NetMessage {
  t: string;
  [k: string]: unknown;
}

export type MsgHandler = (msg: NetMessage) => void;

export interface Transport {
  connect(name: string, room: string): Promise<void>;
  send(msg: NetMessage): void;
  on(handler: MsgHandler): void;
  close(): void;
  readonly id: string | null;
  readonly room: string | null;
}

const SIGNAL_URL: string =
  (import.meta.env.VITE_SIGNAL_URL as string | undefined) ?? "ws://localhost:8787";

export class WsMode implements Transport {
  private ws: WebSocket | null = null;
  private handlers: MsgHandler[] = [];
  private myId: string | null = null;
  private myRoom: string | null = null;

  get id() { return this.myId; }
  get room() { return this.myRoom; }

  connect(name: string, room: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const code = room || "default";
      const ws = new WebSocket(`${SIGNAL_URL}/rooms/${encodeURIComponent(code)}`);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
      ws.onmessage = (ev) => {
        let msg: NetMessage;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (msg.t === "joined") {
          this.myId = msg.id as string;
          this.myRoom = (msg.room as string) ?? code;
          resolve();
        }
        for (const h of this.handlers) h(msg);
      };
      ws.onerror = () => reject(new Error("无法连接到信令服务"));
      ws.onclose = () => {
        for (const h of this.handlers) h({ t: "_close" });
      };
    });
  }

  send(msg: NetMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: MsgHandler): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const transport: Transport = new WsMode();
