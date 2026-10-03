// LobbyScreen.tsx —— 大厅：加入房间（四位数字房间号）、玩家列表（房主标记）、风格选择与预览、房主开始按钮
import { useState, useRef } from "react";
import { useGame, join, startGame, isRoundParticipant } from "../state/game";
import { StyleSelector } from "./StyleSelector";
import { AudioToggle } from "./AudioToggle";
import { NavLink } from "../pages/Shell";
import { unlockAudio } from "../audio/context";
import { playSfx } from "../audio/sfx";

function randomFourDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const RANDOM_NAMES = ["抽象派", "印象派", "具象派", "象征主义", "超现实象", "野兽派象夫"];

export function LobbyScreen() {
  const g = useGame();
  const [name, setName] = useState("");
  const [room, setRoom] = useState(() => randomFourDigits());
  const [joining, setJoining] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const joined = g.players.length > 0;
  const iAmHost = g.host != null && g.host === g.myId;
  const roundBusy = g.round !== "idle";
  const myIndex = Math.max(0, g.players.findIndex(p => p.id === g.myId));

  const digits = [room[0] || "", room[1] || "", room[2] || "", room[3] || ""];

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setRoom(newDigits.join(""));
    if (char && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    setRoom(pasted);
    inputRefs.current[Math.min(pasted.length - 1, 3)]?.focus();
  };

  const onJoin = async () => {
    if (room.length !== 4) return;
    unlockAudio();
    playSfx("uiTap");
    setJoining(true);
    try {
      const fallback = `${RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]}${Math.floor(Math.random() * 99)}`;
      await join(name.trim() || fallback, room);
    } catch {
      // 错误文案已由 state 层写入 g.error 并在上方展示
    } finally {
      setJoining(false);
    }
  };

  const rollNewRoom = () => {
    setRoom(randomFourDigits());
    inputRefs.current[0]?.focus();
  };

  const btnPrimary = "w-full py-2.5 sm:py-3 px-4 border-2 border-(--ui-ink) rounded-lg text-white font-bold text-sm sm:text-base shadow-[3px_3px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ui-ink)] disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 disabled:cursor-not-allowed transition-all";

  return (
    <div className="w-full max-w-lg mx-auto bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[5px_5px_0_var(--ui-ink)] p-4 sm:p-7 md:p-8 text-center my-auto transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-(--ui-accent) tracking-tight mb-0.5">
            抽象 <span className="text-base sm:text-lg md:text-xl text-(--ui-ink) opacity-70">· Up2Down</span>
          </h1>
          <div className="text-base sm:text-lg md:text-xl font-extrabold text-(--ui-ink) my-1">
            牛来象翻，边画边瘫
          </div>
          <div className="inline-block text-[10px] sm:text-xs font-bold tracking-[0.45em] text-(--ui-accent) border border-(--ui-accent) rounded px-2 py-0.5 mb-2">
            横批：抽象
          </div>
        </div>
        <AudioToggle compact />
      </div>

      {g.error && <p className="text-red-600 font-bold my-2 text-sm sm:text-base">{g.error}</p>}

      {!joined ? (
        <div className="w-full max-w-xs sm:max-w-sm mx-auto flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="抽象派代号（选填，默认随机）"
            maxLength={12}
            className="w-full px-3.5 py-2.5 sm:py-3 border-2 border-(--ui-ink) rounded-lg text-sm sm:text-base bg-white shadow-[2px_2px_0_var(--ui-ink)] focus:outline-none focus:border-(--ui-accent) focus:shadow-[2px_2px_0_var(--ui-accent)] transition-all"
          />

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-(--ui-ink) px-1">
              <span>四位象限号（房间号）</span>
              <button
                type="button"
                className="bg-transparent border-[1.5px] border-(--ui-ink) px-2 py-0.5 sm:px-2.5 sm:py-1 text-(--ui-ink) text-xs font-bold rounded shadow-[1.5px_1.5px_0_var(--ui-ink)] hover:bg-(--ui-accent)/15 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                onClick={rollNewRoom}
              >
                🎲 随机换号
              </button>
            </div>
            <div className="flex gap-2 sm:gap-3 justify-between w-full">
              {[0, 1, 2, 3].map(i => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digits[i]}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="digit-box w-12 h-14 sm:w-16 sm:h-16 flex-1 min-w-0 max-w-[4.2rem] text-center text-2xl sm:text-3xl font-black text-(--ui-ink) border-2 border-(--ui-ink) rounded-lg bg-white shadow-[3px_3px_0_var(--ui-ink)] focus:outline-none focus:border-(--ui-accent) focus:shadow-[3px_3px_0_var(--ui-accent)] focus:-translate-y-0.5 transition-all p-0"
                />
              ))}
            </div>
          </div>

          <button
            onClick={onJoin}
            disabled={joining || room.length !== 4}
            className={`${btnPrimary} bg-(--ui-accent) hover:bg-(--ui-accent-hover)`}
          >
            {joining ? "正在连接…" : "进入象限"}
          </button>

          <StyleSelector styleId={g.styleId} canEdit playerIndex={0} />
        </div>
      ) : (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-2.5 sm:gap-3 text-sm sm:text-base">
          <p className="text-(--ui-ink)">
            象限 <b className="text-(--ui-accent) text-lg sm:text-xl font-black">{g.room}</b> · 集合 <b>{g.players.length}/4</b> 位抽象派
          </p>
          <ul className="players list-none p-0 my-1 flex flex-col gap-2 w-full text-left">
            {g.players.map(p => (
              <li
                key={p.id}
                className={`px-3.5 py-2 sm:py-2.5 rounded-lg border-[1.5px] border-(--ui-ink) shadow-[2px_2px_0_var(--ui-ink)] text-xs sm:text-sm font-semibold flex items-center justify-between ${
                  p.id === g.host ? "bg-(--ui-accent)/15 text-(--ui-ink)" : "bg-white/70 text-(--ui-ink)"
                }`}
              >
                <span>
                  {p.name}{p.id === g.myId ? "（你）" : ""}
                  {roundBusy && (
                    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isRoundParticipant(p.id, g) ? "bg-(--ui-go) text-white" : "bg-slate-300 text-slate-700"
                    }`}>
                      {isRoundParticipant(p.id, g) ? (g.round === "draw" ? "抽象中" : "狂奔中") : "候场"}
                    </span>
                  )}
                </span>
                {p.id === g.host && (
                  <span className="bg-(--ui-accent) text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded">
                    房主
                  </span>
                )}
              </li>
            ))}
          </ul>

          <StyleSelector styleId={g.styleId} canEdit={iAmHost && !roundBusy} playerIndex={myIndex} />

          {roundBusy ? (
            <p className="text-(--ui-ink) bg-(--ui-accent)/10 border border-(--ui-accent) rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold">
              本象限对局进行中（{g.round === "draw" ? "抽象阶段" : "狂奔阶段"}），你已候场，本局结束后自动进入下一局
            </p>
          ) : (
            <p className="text-(--ui-ink) opacity-70 text-xs sm:text-sm">
              {iAmHost ? "你是房主，选好风格、人齐就发车" : "等待房主发车…"}
            </p>
          )}
          <p className="links text-(--ui-ink) opacity-60 text-[11px] sm:text-xs">
            链路状态：P2P × {g.links.p2p} 直连
            {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
          </p>
          {iAmHost && !roundBusy && (
            <button
              onClick={() => { playSfx("uiTap"); startGame(); }}
              className={`primary ${btnPrimary} bg-(--ui-go) hover:bg-(--ui-go-hover) mt-1`}
            >
              开始抽象 (全员发车)
            </button>
          )}
        </div>
      )}

      <nav className="mt-4 flex flex-wrap items-center justify-center gap-1 text-[11px] sm:text-xs opacity-80">
        <NavLink route="landing">首页</NavLink>
        <NavLink route="about">关于</NavLink>
        <NavLink route="privacy">隐私</NavLink>
        <NavLink route="terms">条款</NavLink>
      </nav>
    </div>
  );
}
