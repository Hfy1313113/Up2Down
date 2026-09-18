// game.ts —— 全局游戏状态（阶段机：大厅 → 绘制 → 诞生 → 等待 → 赛跑），
// 用轻量 external store + useSyncExternalStore，不引入额外状态库。
// 联机模型：房主客户端为协调者（开赛判定 + 汇总画作），Worker 只做控制面与兜底转发。
import { useSyncExternalStore } from "react";
import { transport } from "../net/transport";
import type { LinkState, NetMessage } from "../net/transport";
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
  links: LinkState;
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
  players: [], doneNames: [], links: { p2p: 0, relay: 0 },
  partLeft: PART_SECONDS, currentPart: "legs",
  myModel: null, myStrokes: null, horses: null, error: null,
};

// 房主侧汇总的画作（不进 React 状态：体积大且渲染不需要）
const strokeArchive = new Map<string, PartStrokes>();
const doneIds = new Set<string>();

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

const isHost = () => state.host != null && state.host === transport.id;
const isHostId = (id: string | null) => id != null && state.host === id;

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
  transport.notify({ t: "phase_start" });          // 服务端启动超时兜底计时
  transport.send({ t: "draw_phase" });             // 各端进入绘制阶段
  enterDrawPhase();
}

// ---------- 绘制阶段 ----------
export function enterDrawPhase(): void {
  clearInterval(partTimer!);
  doneIds.clear();
  strokeArchive.clear();
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
  const myId = transport.id;
  if (myId) {
    strokeArchive.set(myId, state.myStrokes);
    doneIds.add(myId);
  }
  transport.send({ t: "done", id: myId, name: state.myName, strokes: state.myStrokes });
  setState({ phase: "waiting" });
  maybeStartRace();
}

export function maybeStartRace(): void {
  if (!isHost()) return;
  if (state.players.length > 0 && state.players.every(p => doneIds.has(p.id))) {
    broadcastRace();
  }
}

// 全员已提交（或服务端超时）→ 房主用本地汇总的画作开赛
function broadcastRace(): void {
  const horses = state.players.map(p => ({
    id: p.id, name: p.name,
    strokes: strokeArchive.get(p.id) ?? null,
  }));
  transport.send({ t: "race", horses });
  transport.notify({ t: "round_over" });           // 取消服务端超时兜底
  enterRace({ t: "race", horses } as NetMessage);
}

// ---------- 赛跑 ----------
export function enterRace(msg: NetMessage): void {
  clearInterval(partTimer!);
  const horses = (msg.horses as { id: string; name: string; strokes?: PartStrokes | null }[]) || [];
  const entries: HorseEntry[] = horses.map(h => {
    if (h.id === transport.id && state.myModel) return { id: h.id, name: h.name, model: state.myModel };
    const hasStrokes = h.strokes && (h.strokes.legs?.length || h.strokes.head?.length || h.strokes.butt?.length);
    return {
      id: h.id, name: h.name,
      model: hasStrokes ? Recognize.analyzeParts(h.strokes!) : Recognize.analyzeParts({ legs: [], head: [], butt: [] }),
    };
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

  transport.onLinkState(links => setState({ links }));

  transport.on((msg: NetMessage) => {
    switch (msg.t) {
      case "room_state": {
        const players = (msg.players as PlayerInfo[]) || [];
        const wasDraw = state.phase === "draw" || state.phase === "waiting";
        setState({ room: msg.room as string, host: msg.host as string, players });
        if (wasDraw) maybeStartRace();
        break;
      }
      case "done": {
        // 其他玩家的提交（P2P 或兜底通道）
        const id = msg.id as string;
        const strokes = msg.strokes as PartStrokes;
        if (id && strokes) strokeArchive.set(id, strokes);
        if (id) doneIds.add(id);
        markDone(id, msg.name as string);
        break;
      }
      case "player_done": {
        // 控制面路径的提交通知（无画作载荷）
        markDone(msg.id as string, msg.name as string);
        break;
      }
      case "draw_phase":
        enterDrawPhase();
        break;
      case "race_timeout": {
        // 服务端兜底：房主据本地汇总开赛，其余端等待 race
        if (isHost()) broadcastRace();
        break;
      }
      case "race":
        enterRace(msg);
        break;
      case "again":
        resetRoundState();
        break;
      case "room_closed":
      case "_close": {
        resetToLobby("连接已断开，请重新加入");
        break;
      }
      case "_rejoined": {
        // 控制面断线重连后拿到新 id：只更新自身标识，比赛继续
        setState({ myId: msg.id as string });
        break;
      }
    }
  });
}

function markDone(id: string, name: string) {
  if (id) doneIds.add(id);
  const doneNames = name && !state.doneNames.includes(name)
    ? [...state.doneNames, name]
    : state.doneNames;
  setState({
    doneNames,
    players: state.players.map(p => p.id === id ? { ...p, done: true } : p),
  });
  if (isHostId(state.host)) maybeStartRace();
}

function resetRoundState(): void {
  doneIds.clear();
  strokeArchive.clear();
  setState({ phase: "lobby", horses: null, doneNames: [], myStrokes: null, myModel: null });
}

export function playAgain(): void {
  transport.notify({ t: "again" });
  transport.send({ t: "again" });
  resetRoundState();
}

export function resetToLobby(error?: string): void {
  clearInterval(partTimer!);
  doneIds.clear();
  strokeArchive.clear();
  transport.close();
  setState({
    phase: "lobby", room: null, host: null, players: [], doneNames: [],
    links: { p2p: 0, relay: 0 },
    myStrokes: null, myModel: null, horses: null, error: error ?? null,
  });
}

export const PART_SECONDS_TOTAL = PART_SECONDS;
