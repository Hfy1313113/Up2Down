// game.ts —— 全局游戏状态（阶段机：大厅 → 绘制 → 诞生 → 等待 → 赛跑），
// 用轻量 external store + useSyncExternalStore，不引入额外状态库。
// 联机模型：房主客户端为协调者（开赛判定 + 汇总画作），Worker 只做控制面与兜底转发。
import { useSyncExternalStore } from "react";
import { transport } from "../net/transport";
import type { LinkState, NetMessage } from "../net/transport";
import { Recognize } from "../game/recognize";
import type { ElephantModel, PartStrokes } from "../game/types";

export type Phase = "lobby" | "draw" | "birth" | "waiting" | "race";
/** 服务端广播的本轮状态：idle 大厅 / draw 绘制中 / race 已开赛 */
export type RoundState = "idle" | "draw" | "race";

export interface PlayerInfo {
  id: string;
  name: string;
  done?: boolean;
}

export interface ElephantEntry {
  id: string;
  name: string;
  model: ElephantModel;
}

interface GameState {
  phase: Phase;
  myName: string;
  myId: string | null;
  room: string | null;
  host: string | null;
  players: PlayerInfo[];
  round: RoundState;         // 服务端本轮状态
  roundSeq: number;          // 开局时的 pid 序号水位：pid 序号 ≤ roundSeq 的成员才是本轮参与者
  doneNames: string[];
  links: LinkState;
  partLeft: number;          // 当前部位剩余秒
  currentPart: string;
  myModel: ElephantModel | null;    // 本地识别结果（诞生屏/赛跑用）
  myStrokes: PartStrokes | null; // 自己提交的画作
  elephants: ElephantEntry[] | null;   // race 阶段的全部马
  error: string | null;
}

const PART_SECONDS = 50;

let state: GameState = {
  phase: "lobby", myName: "", myId: null, room: null, host: null,
  players: [], round: "idle", roundSeq: 0, doneNames: [], links: { p2p: 0, relay: 0 },
  partLeft: PART_SECONDS, currentPart: "legs",
  myModel: null, myStrokes: null, elephants: null, error: null,
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

const pidNum = (id: string) => Number(id.slice(1)) || 0;

/** 本轮参与者：空闲时为全体成员；对局进行中则只算开局前已在房间里的成员（中途加入者等下一局） */
export function roundParticipants(g: Pick<GameState, "players" | "round" | "roundSeq"> = state): PlayerInfo[] {
  if (g.round === "idle") return g.players;
  return g.players.filter(p => pidNum(p.id) <= g.roundSeq);
}
export function isRoundParticipant(id: string | null, g: Pick<GameState, "players" | "round" | "roundSeq"> = state): boolean {
  return id != null && roundParticipants(g).some(p => p.id === id);
}

/** 只有房主发出的流程消息才被接受；`_from` 由传输层按到达通道标注，本地直发（无 _from）视为可信 */
const fromHost = (msg: NetMessage) => msg._from == null || msg._from === state.host;

let partTimer: ReturnType<typeof setInterval> | null = null;

// ---------- 大厅 ----------
export async function join(name: string, room: string): Promise<void> {
  const cleanRoom = room.trim();
  if (!/^\d{4}$/.test(cleanRoom)) {
    const msg = "房间号仅允许 4 位纯数字";
    setState({ error: msg });
    throw new Error(msg);
  }
  setState({ error: null });
  try {
    await transport.connect(name, cleanRoom);
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

// 部位计时结束/手动完成：由 DrawScreen 调用，返回下一部位名或 null。
// 每个部位都重新起一轮 50s 计时：无论上一部位是手动完成还是超时结束，
// 下一部位都从完整的 PART_SECONDS 开始倒数。
export function finishCurrentPart(): string | null {
  const order = ["legs", "head", "butt"];
  const idx = order.indexOf(state.currentPart);
  const next = order[idx + 1] ?? null;
  if (next) {
    setState({ currentPart: next, partLeft: PART_SECONDS });
    startPartTimer();
  } else {
    clearInterval(partTimer!);
  }
  return next;
}

// ---------- 提交与房主协调 ----------
// 画完三部位：本地识别 → 进入诞生仪式（本端先观赏自己的马）
export function prepareBirth(strokes: PartStrokes, model: ElephantModel): void {
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
  const roster = roundParticipants();
  if (roster.length > 0 && roster.every(p => doneIds.has(p.id))) {
    broadcastRace();
  }
}

// 本轮参与者全部提交（或服务端超时）→ 房主用本地汇总的画作开赛
function broadcastRace(): void {
  const elephants = roundParticipants().map(p => ({
    id: p.id, name: p.name,
    strokes: strokeArchive.get(p.id) ?? null,
  }));
  transport.send({ t: "race", elephants });
  transport.notify({ t: "round_over" });           // 取消服务端超时兜底
  enterRace({ t: "race", elephants } as NetMessage);
}

// ---------- 赛跑 ----------
export function enterRace(msg: NetMessage): void {
  const elephants = (msg.elephants as { id: string; name: string; strokes?: PartStrokes | null }[]) || [];
  // 自己不在本局名单（中途加入者）：留在大厅等待下一局，不进入赛跑
  if (!elephants.some(h => h.id === transport.id)) return;
  clearInterval(partTimer!);
  const entries: ElephantEntry[] = elephants.map(h => {
    if (h.id === transport.id && state.myModel) return { id: h.id, name: h.name, model: state.myModel };
    const hasStrokes = h.strokes && (h.strokes.legs?.length || h.strokes.head?.length || h.strokes.butt?.length);
    return {
      id: h.id, name: h.name,
      model: hasStrokes ? Recognize.analyzeParts(h.strokes!) : Recognize.analyzeParts({ legs: [], head: [], butt: [] }),
    };
  });
  setState({ phase: "race", elephants: entries });
}

// ---------- dev-only：demo 模式直接灌入赛跑状态 ----------
export function loadDemoRace(entries: ElephantEntry[]): void {
  setState({ phase: "race", elephants: entries });
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
        // 服务端的 done 只在控制面路径下才会置位；本地已收到 done 的成员保持 done=true，不被覆盖
        const players = ((msg.players as PlayerInfo[]) || []).map(p => ({
          ...p, done: !!p.done || doneIds.has(p.id),
        }));
        const wasDraw = state.phase === "draw" || state.phase === "waiting";
        setState({
          room: msg.room as string, host: msg.host as string, players,
          round: (msg.round as RoundState) ?? "idle",
          roundSeq: Number(msg.roundSeq) || 0,
        });
        if (wasDraw) maybeStartRace();
        break;
      }
      case "done": {
        // 其他玩家的提交（P2P 或兜底通道）；只接受本人发出的 done
        const id = msg.id as string;
        if (msg._from != null && msg._from !== id) break;
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
        if (fromHost(msg)) enterDrawPhase();
        break;
      case "race_timeout": {
        // 服务端兜底：房主据本地汇总开赛，其余端等待 race
        if (isHost()) broadcastRace();
        break;
      }
      case "race":
        if (fromHost(msg)) enterRace(msg);
        break;
      case "again":
        if (fromHost(msg)) resetRoundState();
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
  maybeStartRace();   // 内部自行判断是否房主
}

function resetRoundState(): void {
  doneIds.clear();
  strokeArchive.clear();
  setState({ phase: "lobby", elephants: null, doneNames: [], myStrokes: null, myModel: null });
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
    phase: "lobby", room: null, host: null, players: [], round: "idle", roundSeq: 0, doneNames: [],
    links: { p2p: 0, relay: 0 },
    myStrokes: null, myModel: null, elephants: null, error: error ?? null,
  });
}

export const PART_SECONDS_TOTAL = PART_SECONDS;
