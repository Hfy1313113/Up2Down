// game.ts —— 全局游戏状态（阶段机：大厅 → 绘制 → 诞生(占位) → 等待 → 赛跑(占位)），
// 用轻量 external store + useSyncExternalStore，不引入额外状态库。
import { useSyncExternalStore } from "react";
import { transport } from "../net/transport";
import type { NetMessage } from "../net/transport";
import { Recognize } from "../game/recognize";
import type { HorseModel, PartStrokes } from "../game/types";

export type Phase = "lobby" | "draw" | "birth" | "waiting" | "race";

export interface PlayerInfo {
  id: string;
  name: string;
  done?: boolean;
}

export interface HorseEntry {
  id: string;
  name: string;
  model: HorseModel;
}

interface GameState {
  phase: Phase;
  myName: string;
  myId: string | null;
  room: string | null;
  host: string | null;
  players: PlayerInfo[];
  doneNames: string[];
  partLeft: number;          // 当前部位剩余秒
  currentPart: string;
  myModel: HorseModel | null;    // 本地识别结果（诞生屏/赛跑用）
  myStrokes: PartStrokes | null; // 自己提交的画作
  horses: HorseEntry[] | null;   // race 阶段的全部马
  error: string | null;
}

const PART_SECONDS = 50;

let state: GameState = {
  phase: "lobby", myName: "", myId: null, room: null, host: null,
  players: [], doneNames: [], partLeft: PART_SECONDS, currentPart: "legs",
  myModel: null, myStrokes: null, horses: null, error: null,
};

const listeners = new Set<() => void>();
function setState(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn());
}
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function useGame(): GameState {
  return useSyncExternalStore(subscribe, () => state);
}

export const isHost = () => state.host != null && state.host === transport.id;
const hostOf = (players: PlayerInfo[]) => players.find(p => p.id === transport.id) != null;

let partTimer: ReturnType<typeof setInterval> | null = null;

// ---------- 大厅 ----------
export async function join(name: string, room: string): Promise<void> {
  setState({ error: null });
  try {
    await transport.connect(name, room);
  } catch (e) {
    setState({ error: (e as Error).message });
    throw e;
  }
  setState({ myName: name, myId: transport.id });
}

export function startGame(): void {
  // 房主：广播开始 → 各端本地进入绘制阶段（server 也会原样转发）
  transport.send({ t: "relay_all", data: { t: "draw_phase" } });
  enterDrawPhase();
}

// ---------- 绘制阶段 ----------
export function enterDrawPhase(): void {
  clearInterval(partTimer!);
  setState({ phase: "draw", doneNames: [], currentPart: "legs", partLeft: PART_SECONDS });
  startPartTimer();
}

function startPartTimer(): void {
  clearInterval(partTimer!);
  const end = Date.now() + PART_SECONDS * 1000;
  partTimer = setInterval(() => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    setState({ partLeft: left });
    if (left <= 0) clearInterval(partTimer!);
  }, 200);
}

// 部位计时结束/手动完成：由 DrawScreen 调用，返回下一部位名或 null
export function finishCurrentPart(): string | null {
  const order = ["legs", "head", "butt"];
  const idx = order.indexOf(state.currentPart);
  const next = order[idx + 1] ?? null;
  if (next) {
    setState({ currentPart: next, partLeft: PART_SECONDS });
  }
  return next;
}

// ---------- 提交与房主协调 ----------
// 画完三部位：本地识别 → 进入诞生仪式（本端先观赏自己的马）
export function prepareBirth(strokes: PartStrokes, model: HorseModel): void {
  clearInterval(partTimer!);
  setState({ myStrokes: strokes, myModel: model, phase: "birth" });
}

// 诞生仪式结束 → 提交画作，等待其他玩家
export function sendDone(): void {
  if (!state.myStrokes) return;
  transport.send({ t: "done", strokes: state.myStrokes });
  setState({ phase: "waiting" });
}

export function maybeStartRace(): void {
  // 房主在收到 player_done 后调用：全员提交则立即开赛
  if (!isHost()) return;
  if (state.players.length > 0 && state.players.every(p => p.done)) {
    broadcastRace();
  }
}

// 全员已提交 → 房主立即开赛（服务端仍会补全/兜底超时）
function broadcastRace(): void {
  const horses = state.players.map(p => ({
    id: p.id, name: p.name, strokes: null,
  }));
  transport.send({ t: "race", horses });
  enterRace({ t: "race", horses } as NetMessage);
}


// ---------- 赛跑 ----------
export function enterRace(msg: NetMessage): void {
  clearInterval(partTimer!);
  const horses = (msg.horses as { id: string; name: string; strokes?: PartStrokes | null }[]) || [];
  const entries: HorseEntry[] = horses.map(h => {
    if (h.id === transport.id && state.myModel) return { id: h.id, name: h.name, model: state.myModel };
    const hasStrokes = h.strokes && (h.strokes.legs?.length || h.strokes.head?.length || h.strokes.butt?.length);
    return { id: h.id, name: h.name, model: hasStrokes ? Recognize.analyzeParts(h.strokes!) : Recognize.analyzeParts({ legs: [], head: [], butt: [] }) };
  });
  setState({ phase: "race", horses: entries });
}

// ---------- dev-only：demo 模式直接灌入赛跑状态 ----------
export function loadDemoRace(entries: HorseEntry[]): void {
  setState({ phase: "race", horses: entries });
}

// ---------- 网络消息注册（App 启动时调用一次） ----------
let wired = false;
export function wireTransport(): void {
  if (wired) return;
  wired = true;
  transport.on((msg: NetMessage) => {
    switch (msg.t) {
      case "room_state": {
        const players = (msg.players as PlayerInfo[]) || [];
        const wasDraw = state.phase === "draw" || state.phase === "waiting";
        setState({ room: msg.room as string, host: msg.host as string, players });
        if (isHost() && wasDraw) maybeStartRace();
        break;
      }
      case "relay_all":
      case "relay": {
        // 兜底通道：解包 data 并分派
        const inner = msg.data as NetMessage | undefined;
        if (inner && typeof inner === "object") dispatch(inner);
        break;
      }
      case "draw_phase":
        enterDrawPhase();
        break;
      case "player_done": {
        const doneNames = [...state.doneNames, msg.name as string];
        setState({ doneNames, players: state.players.map(p => p.id === msg.id ? { ...p, done: true } : p) });
        if (isHost()) maybeStartRace();
        break;
      }
      case "race":
        enterRace(msg);
        break;
      case "room_closed":
      case "_close": {
        resetToLobby("连接已断开，请重新加入");
        break;
      }
    }
  });
}

function dispatch(inner: NetMessage): void {
  // 兜底通道内层消息复用同一分派逻辑（简化：直接触发关键类型）
  if (inner.t === "draw_phase") enterDrawPhase();
  else if (inner.t === "race") enterRace(inner);
  else if (inner.t === "again") {
    resetRoundState();
  }
}

function resetRoundState(): void {
  setState({ phase: "lobby", horses: null, doneNames: [], myStrokes: null, myModel: null });
}

export function playAgain(): void {
  transport.send({ t: "relay_all", data: { t: "again" } });
  resetRoundState();
}

export function resetToLobby(error?: string): void {
  clearInterval(partTimer!);
  transport.close();
  setState({
    phase: "lobby", room: null, host: null, players: [], doneNames: [],
    myStrokes: null, myModel: null, horses: null, error: error ?? null,
  });
}

export const PART_SECONDS_TOTAL = PART_SECONDS;
