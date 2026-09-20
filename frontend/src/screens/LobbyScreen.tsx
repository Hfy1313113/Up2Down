// LobbyScreen.tsx —— 大厅：加入房间（四位数字房间号）、玩家列表（房主标记）、房主开始按钮
import { useState, useRef } from "react";
import { useGame, join, startGame } from "../state/game";

function randomFourDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function LobbyScreen() {
  const g = useGame();
  const [name, setName] = useState("");
  const [room, setRoom] = useState(() => randomFourDigits());
  const [joining, setJoining] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const joined = g.players.length > 0;
  const iAmHost = g.host != null && g.host === g.myId;

  const digits = [room[0] || "", room[1] || "", room[2] || "", room[3] || ""];

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const nextRoom = newDigits.join("");
    setRoom(nextRoom);
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
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
    const targetIdx = Math.min(pasted.length - 1, 3);
    inputRefs.current[targetIdx]?.focus();
  };

  const onJoin = async () => {
    if (room.length !== 4) return;
    setJoining(true);
    try {
      await join(name.trim() || `骑手${Math.floor(Math.random() * 99)}`, room);
    } finally {
      setJoining(false);
    }
  };

  const rollNewRoom = () => {
    const fresh = randomFourDigits();
    setRoom(fresh);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white border-2 border-[#233140] rounded-xl shadow-[5px_5px_0_rgba(35,49,64,0.9)] p-4 sm:p-7 md:p-8 text-center my-auto transition-all">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#e2703a] tracking-tight mb-1">
        奔跑即故障 · Up2Down
      </h1>
      <div className="text-base sm:text-lg md:text-xl font-extrabold text-[#e2703a] my-1">
        牛来马翻，边画边瘫
      </div>
      <sub className="inline-block text-xs sm:text-sm text-slate-500 mb-3 opacity-80">
        <del>不能只让作者一个人吃上这种细糠</del>
      </sub>

      {g.error && <p className="text-red-600 font-bold my-2 text-sm sm:text-base">{g.error}</p>}

      {!joined ? (
        <div className="w-full max-w-xs sm:max-w-sm mx-auto flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="选手代号（选填，默认随机）"
            maxLength={12}
            className="w-full px-3.5 py-2.5 sm:py-3 border-2 border-[#233140] rounded-lg text-sm sm:text-base bg-[#fcfcfb] shadow-[2px_2px_0_rgba(35,49,64,0.2)] focus:outline-none focus:border-[#e2703a] focus:shadow-[2px_2px_0_#e2703a] transition-all"
          />

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-700 px-1">
              <span>四位房间号</span>
              <button
                type="button"
                className="bg-transparent border-[1.5px] border-[#233140] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[#233140] text-xs font-bold rounded shadow-[1.5px_1.5px_0_#233140] hover:bg-amber-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
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
                  className="digit-box w-12 h-14 sm:w-16 sm:h-16 flex-1 min-w-0 max-w-[4.2rem] text-center text-2xl sm:text-3xl font-black text-[#233140] border-2 border-[#233140] rounded-lg bg-white shadow-[3px_3px_0_#233140] focus:outline-none focus:border-[#e2703a] focus:shadow-[3px_3px_0_#e2703a] focus:-translate-y-0.5 transition-all p-0"
                />
              ))}
            </div>
          </div>

          <button
            onClick={onJoin}
            disabled={joining || room.length !== 4}
            className="w-full py-2.5 sm:py-3 px-4 border-2 border-[#233140] rounded-lg bg-[#e2703a] hover:bg-[#d4632f] text-white font-bold text-sm sm:text-base shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#233140] disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 disabled:cursor-not-allowed transition-all"
          >
            {joining ? "正在连接…" : "进入房间"}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-2.5 sm:gap-3 text-sm sm:text-base">
          <p className="text-slate-700">
            房间号 <b className="text-[#e2703a] text-lg sm:text-xl font-black">{g.room}</b> · 集合 <b>{g.players.length}/4</b> 人
          </p>
          <ul className="players list-none p-0 my-2 flex flex-col gap-2 w-full text-left">
            {g.players.map(p => (
              <li
                key={p.id}
                className={`px-3.5 py-2 sm:py-2.5 rounded-lg border-[1.5px] border-[#233140] shadow-[2px_2px_0_#233140] text-xs sm:text-sm font-semibold flex items-center justify-between ${
                  p.id === g.host ? "bg-amber-100 border-[#e2703a] shadow-[2px_2px_0_#e2703a] text-[#b45309]" : "bg-slate-100 text-[#233140]"
                }`}
              >
                <span>
                  {p.name}{p.id === g.myId ? "（你）" : ""}
                </span>
                {p.id === g.host && (
                  <span className="bg-[#e2703a] text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded">
                    房主
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-slate-500 text-xs sm:text-sm">
            {iAmHost ? "你是房主，全员就绪后点击起跑发车" : "等待房主开赛…"}
          </p>
          <p className="links text-slate-500 text-[11px] sm:text-xs">
            链路状态：P2P × {g.links.p2p} 直连
            {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
          </p>
          {iAmHost && (
            <button
              onClick={startGame}
              className="primary w-full py-2.5 sm:py-3 px-4 rounded-lg border-2 border-[#233140] bg-[#2ea043] hover:bg-[#278839] text-white font-bold text-sm sm:text-base shadow-[3px_3px_0_#233140] active:translate-x-0.5 active:translate-y-0.5 transition-all mt-1"
            >
              开始比赛 (全员起跑发车)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
