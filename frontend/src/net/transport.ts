/* transport.ts —— 项目唯一的网络层，一条控制面 + 一条数据面：
   - 控制面：Cloudflare Worker（Durable Object 房间）上的 WebSocket。
     只承担 加入/房间成员状态/信令/保活/服务端计时通知，流量为 KB 级。
   - 数据面：WebRTC DataChannel 网状直连（≤4 人）。画作与开赛载荷全走这里，
     完全不经过 Cloudflare。与某个 peer 建连失败时，该 peer 的消息自动回落
     控制面 relay（消息极小），上层无感。
   消息统一带 _id 去重，避免同一消息经两条通道重复投递。 */
export interface NetMessage {
  t: string;
  [k: string]: unknown;
}

export type MsgHandler = (msg: NetMessage) => void;

/** 与各 peer 的通道状态（UI 用于显示"P2P ×n / 兜底 ×m"） */
export interface LinkState {
  p2p: number;
  relay: number;
}

export interface Transport {
  connect(name: string, room: string): Promise<void>;
  /** 广播游戏消息：已建 P2P 的 peer 走 DataChannel，未建的走 Worker 兜底 */
  send(msg: NetMessage): void;
  /** 只发给 Worker 的控制面消息（不广播给其他玩家），如服务端绘制计时通知 */
  notify(msg: NetMessage): void;
  on(handler: MsgHandler): void;
  onLinkState(handler: (s: LinkState) => void): void;
  close(): void;
  readonly id: string | null;
  readonly room: string | null;
}

// 控制面地址：
// - 开发态（vite dev，5173）：默认连本机 wrangler dev 的 8787 端口
// - 生产态（由同一个 Worker 托管静态产物）：同源，无需任何构建期变量
// - 仍可用 VITE_SIGNAL_URL 覆盖（例如前端单独挂 Pages、控制面在别处时）
const SIGNAL_URL: string =
  (import.meta.env.VITE_SIGNAL_URL as string | undefined) ??
  (import.meta.env.DEV
    ? `ws://${location.hostname}:8787`
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const SEEN_LIMIT = 512;        // 消息去重窗口
const PING_MS = 25_000;        // 控制面保活，兼作断线探测
const RETRY_MS = 4_000;        // P2P 建连失败后的重试间隔

interface Peer {
  id: string;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  /** 由 id 较小者发起 offer 与数据通道，天生无 glare */
  initiator: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  retryTimer: ReturnType<typeof setTimeout> | null;
}

let seq = 0;
const nextMsgId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}`;

class P2PTransport implements Transport {
  private ws: WebSocket | null = null;
  private handlers: MsgHandler[] = [];
  private linkHandlers: ((s: LinkState) => void)[] = [];
  private peers = new Map<string, Peer>();
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private myId: string | null = null;
  private myRoom: string | null = null;
  private myName = "";
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private rtcSupported = typeof RTCPeerConnection !== "undefined";

  get id() { return this.myId; }
  get room() { return this.myRoom; }

  connect(name: string, room: string): Promise<void> {
    this.myName = name;
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      const code = room || "default";
      const ws = new WebSocket(`${SIGNAL_URL}/rooms/${encodeURIComponent(code)}`);
      this.ws = ws;
      let settled = false;
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
      ws.onmessage = (ev) => {
        let msg: NetMessage;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (msg.t === "joined") {
          this.myId = msg.id as string;
          this.myRoom = (msg.room as string) ?? code;
          this.startPing();
          if (!settled) { settled = true; resolve(); }
        }
        this.handleServerMessage(msg);
      };
      ws.onerror = () => {
        if (!settled) { settled = true; reject(new Error("无法连接到信令服务")); }
      };
      ws.onclose = () => {
        this.stopPing();
        if (!settled) { settled = true; reject(new Error("信令连接已关闭")); return; }
        if (this.closedByUser) return;
        // P2P 仍在工作时不断线：控制面掉线只降级，重连后恢复
        if (this.p2pCount() > 0) this.scheduleReconnect();
        else this.emit({ t: "_close" });
      };
    });
  }

  // ---------- 发送 ----------
  send(msg: NetMessage): void {
    const framed = { ...msg, _id: nextMsgId() };
    const others = [...this.peers.values()];
    if (others.length === 0) {
      // 还不知道有哪些 peer（刚加入）：交给服务端广播
      this.wsSend({ t: "relay_all", data: framed });
      return;
    }
    for (const peer of others) {
      if (peer.dc && peer.dc.readyState === "open") {
        try { peer.dc.send(JSON.stringify(framed)); continue; } catch { /* 落到兜底 */ }
      }
      this.wsSend({ t: "relay", to: peer.id, data: framed });
    }
    this.emitLinkState();
  }

  notify(msg: NetMessage): void {
    this.wsSend(msg);
  }

  // ---------- 订阅 ----------
  on(handler: MsgHandler): void { this.handlers.push(handler); }
  onLinkState(handler: (s: LinkState) => void): void {
    this.linkHandlers.push(handler);
    handler(this.linkState());
  }

  close(): void {
    this.closedByUser = true;
    this.stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    for (const peer of this.peers.values()) this.dropPeer(peer);
    this.peers.clear();
    this.ws?.close();
    this.ws = null;
  }

  // ---------- 服务端消息 ----------
  private handleServerMessage(msg: NetMessage): void {
    switch (msg.t) {
      case "room_state": {
        const players = (msg.players as { id: string }[]) ?? [];
        this.syncPeers(players.map(p => p.id));
        this.emit(msg);
        break;
      }
      case "signal": {
        void this.handleSignal(msg.from as string, msg.data as SignalData);
        break;
      }
      case "relay": {
        const inner = msg.data as NetMessage | undefined;
        if (inner) this.deliver(inner);
        break;
      }
      case "relay_all": {
        const inner = msg.data as NetMessage | undefined;
        if (inner) this.deliver(inner);
        break;
      }
      default:
        this.emit(msg);
    }
  }

  private emit(msg: NetMessage): void {
    for (const h of this.handlers) h(msg);
  }

  /** 数据面/兜底统一入口：按 _id 去重后交给上层 */
  private deliver(msg: NetMessage): void {
    const id = msg._id as string | undefined;
    if (id) {
      if (this.seen.has(id)) return;
      this.seen.add(id);
      this.seenOrder.push(id);
      if (this.seenOrder.length > SEEN_LIMIT) {
        const old = this.seenOrder.shift()!;
        this.seen.delete(old);
      }
    }
    this.emit(msg);
  }

  private wsSend(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // ---------- 保活与重连 ----------
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.wsSend({ t: "ping" }), PING_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.closedByUser) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const code = this.myRoom;
      if (!code) return;
      const ws = new WebSocket(`${SIGNAL_URL}/rooms/${encodeURIComponent(code)}`);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", name: this.myName }));
      ws.onmessage = (ev) => {
        let msg: NetMessage;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (msg.t === "joined") {
          this.myId = msg.id as string;
          this.startPing();
          this.emit({ t: "_rejoined", id: msg.id as string });
        }
        this.handleServerMessage(msg);
      };
      ws.onclose = () => {
        this.stopPing();
        if (this.closedByUser) return;
        if (this.p2pCount() > 0) this.scheduleReconnect();
        else this.emit({ t: "_close" });
      };
      ws.onerror = () => { /* onclose 统一处理 */ };
    }, RETRY_MS);
  }

  // ---------- P2P ----------
  private syncPeers(ids: string[]): void {
    const mine = this.myId;
    if (!mine) return;
    const want = new Set(ids.filter(id => id !== mine));
    for (const [id, peer] of this.peers) {
      if (!want.has(id)) { this.dropPeer(peer); this.peers.delete(id); }
    }
    for (const id of want) {
      if (!this.peers.has(id)) this.addPeer(id);
    }
    this.emitLinkState();
  }

  private addPeer(id: string): void {
    const initiator = mine(this.myId) < id;
    const peer: Peer = { id, pc: null, dc: null, initiator, pendingCandidates: [], retryTimer: null };
    this.peers.set(id, peer);
    if (this.rtcSupported) this.openPeer(peer);
  }

  private openPeer(peer: Peer): void {
    if (this.peers.get(peer.id) !== peer) return;
    if (peer.pc) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peer.pc = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.signal(peer.id, { kind: "candidate", candidate: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.retryPeer(peer);
      }
    };
    pc.ondatachannel = (ev) => this.adoptChannel(peer, ev.channel);

    if (peer.initiator) {
      pc.onnegotiationneeded = () => {
        void (async () => {
          try {
            await pc.setLocalDescription();
            if (pc.localDescription) this.signal(peer.id, { kind: "offer", sdp: pc.localDescription });
          } catch { /* 交给连接状态处理 */ }
        })();
      };
      this.adoptChannel(peer, pc.createDataChannel("game", { ordered: true }));
    }
  }

  private adoptChannel(peer: Peer, dc: RTCDataChannel): void {
    peer.dc = dc;
    dc.onopen = () => this.emitLinkState();
    dc.onmessage = (ev) => {
      let msg: NetMessage;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      this.deliver(msg);
    };
    dc.onclose = () => {
      if (peer.dc === dc) peer.dc = null;
      this.emitLinkState();
    };
  }

  private retryPeer(peer: Peer): void {
    if (peer.pc) { try { peer.pc.close(); } catch { /* noop */ } }
    peer.pc = null;
    peer.dc = null;
    this.emitLinkState();
    if (peer.retryTimer) return;
    peer.retryTimer = setTimeout(() => {
      peer.retryTimer = null;
      if (this.closedByUser || !this.peers.has(peer.id)) return;
      this.openPeer(peer);
    }, RETRY_MS);
  }

  private dropPeer(peer: Peer): void {
    if (peer.retryTimer) { clearTimeout(peer.retryTimer); peer.retryTimer = null; }
    try { peer.dc?.close(); } catch { /* noop */ }
    try { peer.pc?.close(); } catch { /* noop */ }
    peer.pc = null;
    peer.dc = null;
  }

  private signal(to: string, data: SignalData): void {
    this.wsSend({ t: "signal", to, data });
  }

  private async handleSignal(from: string | undefined, data: SignalData): Promise<void> {
    if (!from || !data || !this.rtcSupported) return;
    let peer = this.peers.get(from);
    if (!peer) { this.addPeer(from); peer = this.peers.get(from); }
    if (!peer) return;
    if (!peer.pc) this.openPeer(peer);
    const pc = peer.pc;
    if (!pc) return;

    if (data.kind === "candidate") {
      if (pc.remoteDescription) { try { await pc.addIceCandidate(data.candidate); } catch { /* 忽略过期候选 */ } }
      else peer.pendingCandidates.push(data.candidate);
      return;
    }
    if (data.kind === "offer" || data.kind === "answer") {
      try {
        await pc.setRemoteDescription(data.sdp);
      } catch {
        // 冲突（双方同时 offer）：发起方重试一次即可
        this.retryPeer(peer);
        return;
      }
      for (const c of peer.pendingCandidates.splice(0)) {
        try { await pc.addIceCandidate(c); } catch { /* 忽略过期候选 */ }
      }
      if (data.kind === "offer") {
        try {
          await pc.setLocalDescription();
          if (pc.localDescription) this.signal(peer.id, { kind: "answer", sdp: pc.localDescription });
        } catch { /* 交给连接状态处理 */ }
      }
    }
  }

  // ---------- 状态 ----------
  private p2pCount(): number {
    let n = 0;
    for (const peer of this.peers.values()) {
      if (peer.dc && peer.dc.readyState === "open") n++;
    }
    return n;
  }

  private linkState(): LinkState {
    const p2p = this.p2pCount();
    return { p2p, relay: Math.max(0, this.peers.size - p2p) };
  }

  private emitLinkState(): void {
    const s = this.linkState();
    for (const h of this.linkHandlers) h(s);
  }
}

type SignalData =
  | { kind: "offer" | "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

const mine = (id: string | null) => id ?? "";

export const transport: Transport = new P2PTransport();
